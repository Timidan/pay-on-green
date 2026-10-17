import { randomUUID } from "node:crypto";
import { createTwoFilesPatch } from "diff";
import type { JobEvent } from "./contract";
import { complete, patchPath } from "./agent";
import { sharedSandbox, uploadFiles, wipeWork, restoreTests, runTests } from "./sandbox";
import { hold, capture, release } from "./stripe";
import { splitBill, splitBillFiles } from "./tasks/split-bill";

type Job = {
  events: JobEvent[];
  listeners: Set<(event: JobEvent) => void>;
  running: boolean;
};

const root = globalThis as typeof globalThis & { payOnGreenJobs?: Map<string, Job> };
export const jobs = (root.payOnGreenJobs ??= new Map<string, Job>());

function emit(job: Job, event: JobEvent) {
  job.events.push(event);
  for (const listener of job.listeners) {
    try { listener(event); } catch { job.listeners.delete(listener); }
  }
}

function errorMessage(error: unknown) {
  let message = error instanceof Error ? error.message : String(error);
  for (const [name, value] of Object.entries(process.env)) {
    if (/(KEY|TOKEN|SECRET|CREDENTIAL|PASSWORD)/i.test(name) && value && value.length >= 8) {
      message = message.replaceAll(value, "[redacted]");
    }
  }
  return message.slice(0, 500);
}

function summary(output: string, pass: boolean) {
  const passed = Number(output.match(/^ℹ pass (\d+)/m)?.[1]);
  const failed = Number(output.match(/^ℹ fail (\d+)/m)?.[1]);
  const total = passed + failed;
  return total > 0 ? `${pass ? passed : failed} of ${total} ${pass ? "passing" : "failing"}`
    : pass ? "Tests passed" : "Tests failed";
}

export function startJob(taskId: string): string | "busy" | "unknown" {
  if (taskId !== splitBill.id) return "unknown";
  if ([...jobs.values()].some((job) => job.running)) return "busy";
  const jobId = randomUUID();
  const job: Job = { events: [], listeners: new Set(), running: true };
  jobs.set(jobId, job);
  void runJob(jobId, job);
  return jobId;
}

export function getJob(jobId: string) {
  return jobs.get(jobId);
}

async function runJob(jobId: string, job: Job) {
  const signal = AbortSignal.timeout(240_000);
  let paymentIntentId: string | undefined;
  let sandbox: Awaited<ReturnType<typeof sharedSandbox>>["sandbox"] | undefined;
  let green = false;
  try {
    const paymentIntent = await hold(jobId, splitBill.id, splitBill.priceCents);
    paymentIntentId = paymentIntent.id;
    if (paymentIntent.status !== "requires_capture") throw new Error("Stripe hold was not authorized");
    emit(job, {
      t: "hold", at: Date.now(), paymentIntentId, amountCents: splitBill.priceCents,
      status: "requires_capture",
    });

    const shared = await sharedSandbox(signal);
    sandbox = shared.sandbox;
    emit(job, {
      t: "sandbox", at: Date.now(), sandboxId: sandbox.id,
      image: "devbox:1", reused: shared.reused, ms: shared.ms,
    });
    emit(job, { t: "egress", at: Date.now(), rules: shared.egress });

    const files: Record<string, string> = { ...splitBillFiles };
    const tests = Object.fromEntries(Object.entries(splitBillFiles).filter(([path]) => path.startsWith("test/")));
    await wipeWork(sandbox, signal);
    await uploadFiles(sandbox, files, signal);

    const test = async (attempt: number) => {
      await restoreTests(sandbox!, tests, signal);
      const started = Date.now();
      const result = await runTests(sandbox!, splitBill.testCmd, signal);
      const output = `${result.result.stdout}${result.result.stderr}`;
      const pass = result.result.exit_code === 0 && !result.result.error;
      emit(job, { t: "tests", at: Date.now(), attempt, pass, summary: summary(output, pass), output, ms: Date.now() - started });
      return { pass, output };
    };

    let last = await test(0);
    if (last.pass) throw new Error("Seeded test unexpectedly passed");
    for (let attempt = 1; attempt <= 3 && !signal.aborted; attempt++) {
      let attemptEmitted = false;
      try {
        const prompt = `Fix the failing source code. Test files are read-only. Return JSON with files [{path,content}] and note.\nFiles: ${JSON.stringify(files)}\nLast test output:\n${last.output}`;
        const patch = await complete(prompt, signal);
        const paths = patch.files.map((file) => patchPath(file.path));
        const rejected = paths.find((item) => item.rejected)?.rejected;
        if (rejected) {
          emit(job, { t: "attempt", at: Date.now(), attempt, model: patch.model,
            note: patch.note, diff: "", tokens: patch.tokens, rejected });
          continue;
        }
        const diff = patch.files.map((file, index) =>
          createTwoFilesPatch(paths[index].path, paths[index].path,
            files[paths[index].path] ?? "", file.content)).join("\n");
        for (const [index, file] of patch.files.entries()) {
          const path = paths[index].path;
          await uploadFiles(sandbox, { [path]: file.content }, signal);
          files[path] = file.content;
        }
        emit(job, { t: "attempt", at: Date.now(), attempt, model: patch.model,
          note: patch.note, diff, tokens: patch.tokens });
        attemptEmitted = true;
        last = await test(attempt);
        if (last.pass) { green = true; break; }
      } catch (error) {
        const message = errorMessage(error);
        if (!attemptEmitted) {
          emit(job, { t: "attempt", at: Date.now(), attempt,
            model: process.env.MODEL_BACKEND === "codex" ? "gpt-6-sol" : "openrouter",
            note: message, diff: "", rejected: "attempt failed" });
        }
        emit(job, { t: "error", at: Date.now(), message });
      }
    }
    if (signal.aborted) throw new Error("Job timed out after 4 minutes");
  } catch (error) {
    emit(job, { t: "error", at: Date.now(), message: errorMessage(error) });
  } finally {
    if (paymentIntentId) {
      try {
        const settled = green ? await capture(jobId, paymentIntentId) : await release(jobId, paymentIntentId);
        if (settled.status !== (green ? "succeeded" : "canceled")) {
          throw new Error(`Stripe settlement returned ${settled.status}`);
        }
        emit(job, { t: "settled", at: Date.now(), outcome: green ? "captured" : "released",
          paymentIntentId, status: green ? "succeeded" : "canceled" });
      } catch (error) {
        emit(job, { t: "error", at: Date.now(), message: errorMessage(error) });
      }
    }
    if (sandbox) {
      try { await wipeWork(sandbox); }
      catch (error) { emit(job, { t: "error", at: Date.now(), message: errorMessage(error) }); }
    }
    job.running = false;
    emit(job, { t: "done", at: Date.now() });
  }
}
