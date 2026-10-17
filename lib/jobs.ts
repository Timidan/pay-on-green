import { randomUUID } from "node:crypto";
import { createTwoFilesPatch } from "diff";
import type { JobEvent } from "./contract";
import { complete, patchPath } from "./agent";
import { sharedSandbox, uploadFiles, wipeWork, restoreTests, runTests, testsPassed } from "./sandbox";
import { hold, capture, release } from "./stripe";
import { taskRegistry } from "./tasks";
import { CreateosSandboxNotFoundError } from "@nodeops-createos/sandbox";
import { cloneRepo, installRepo, repoContext, repoPatch, repoRunner, restoreProtected,
  runRepoTests, setRepoEgress, testCounts, writeRepoFile } from "./repo";

type Source = { taskId: string } | { repoUrl: string; testPath?: string };

type Job = {
  source: Source;
  events: JobEvent[];
  listeners: Set<(event: JobEvent) => void>;
  running: boolean;
};

const root = globalThis as typeof globalThis & {
  payOnGreenJobs?: Map<string, Job>;
  payOnGreenQueue?: string[];
  payOnGreenActive?: boolean;
};
export const jobs = (root.payOnGreenJobs ??= new Map<string, Job>());
const queue = (root.payOnGreenQueue ??= []);

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

export function startJob(source: string | Source): string | "full" | "unknown" {
  const selected: Source = typeof source === "string" ? { taskId: source } : source;
  if ("taskId" in selected && !Object.hasOwn(taskRegistry, selected.taskId)) return "unknown";
  if (root.payOnGreenActive && queue.length >= 5) return "full";
  const jobId = randomUUID();
  const job: Job = { source: selected, events: [], listeners: new Set(), running: true };
  jobs.set(jobId, job);
  if (root.payOnGreenActive) {
    queue.push(jobId);
    emit(job, { t: "queued", at: Date.now(), position: queue.length });
  } else {
    root.payOnGreenActive = true;
    void runJob(jobId, job);
  }
  return jobId;
}

export function getJob(jobId: string) {
  return jobs.get(jobId);
}

async function runRepoJob(job: Job, sandbox: Awaited<ReturnType<typeof sharedSandbox>>["sandbox"],
  url: string, testPath: string | undefined, signal: AbortSignal) {
  const setup = async (step: "clone" | "install" | "lock", action: () => Promise<unknown>) => {
    const started = Date.now();
    try {
      await action();
      emit(job, { t: "setup", at: Date.now(), step, ok: true, ms: Date.now() - started });
    } catch (error) {
      emit(job, { t: "setup", at: Date.now(), step, ok: false, ms: Date.now() - started, detail: errorMessage(error) });
      throw error;
    }
  };
  let commit = "";
  let paths: string[] = [];
  let runner: "node" | "jest" | "vitest" | "npm" = "npm";
  let testCmd = "";
  try {
    await wipeWork(sandbox, signal);
    const rules = await setRepoEgress(sandbox, true, signal);
    emit(job, { t: "egress", at: Date.now(), rules });
    await setup("clone", async () => { ({ commit, paths } = await cloneRepo(sandbox, url, signal)); });
    ({ runner, testCmd } = await repoRunner(sandbox, paths, testPath, signal));
    emit(job, { t: "repo", at: Date.now(), url: url.replace(/\.git$/, ""), commit, runner, testCmd });
    await setup("install", () => installRepo(sandbox, paths, signal));
  } finally {
    await setup("lock", async () => {
      const rules = await setRepoEgress(sandbox, false);
      emit(job, { t: "egress", at: Date.now(), rules });
    });
  }

  const test = async (attempt: number, baselineTotal?: number) => {
    await restoreProtected(sandbox, signal);
    const started = Date.now();
    const result = await runRepoTests(sandbox, testCmd, signal);
    const output = `${result.result.stdout}${result.result.stderr}`;
    const counts = testCounts(output);
    const pass = !result.result.error && result.result.exit_code === 0 && !!counts &&
      counts.failed === 0 && counts.total >= (baselineTotal ?? 1);
    emit(job, { t: "tests", at: Date.now(), attempt, pass,
      summary: counts ? `${counts.passed} passed, ${counts.failed} failed, ${counts.total} total` : "Could not count tests",
      output: output.slice(-20_000), ms: Date.now() - started });
    return { output, counts, pass };
  };

  let last = await test(0);
  if (!last.counts?.total) throw new Error("Could not count baseline tests");
  if (last.pass) throw new Error("Your tests already pass, so there's nothing to fix and nothing to charge.");
  const baselineTotal = last.counts.total;
  const written = new Set<string>();
  for (let attempt = 1; attempt <= 3 && !signal.aborted; attempt++) {
    try {
      const prompt = await repoContext(sandbox, paths, last.output, signal);
      const patch = await complete(prompt, signal);
      const resolved = patch.files.map((file) => patchPath(file.path, true));
      const rejected = resolved.find((path) => path.rejected)?.rejected ||
        (patch.files.some((file) => /process\.(?:exitCode|reallyExit|exit|kill)\b/.test(file.content))
          ? "used forbidden process control" : undefined);
      if (rejected) {
        emit(job, { t: "attempt", at: Date.now(), attempt, model: patch.model, note: patch.note,
          diff: "", tokens: patch.tokens, rejected });
        continue;
      }
      for (const [index, file] of patch.files.entries()) {
        await writeRepoFile(sandbox, resolved[index].path, file.content, signal);
        written.add(resolved[index].path);
      }
      const candidate = await repoPatch(sandbox, [...written], signal);
      emit(job, { t: "attempt", at: Date.now(), attempt, model: patch.model, note: patch.note,
        diff: candidate.diff, tokens: patch.tokens });
      last = await test(attempt, baselineTotal);
      if (last.pass) {
        const finalPatch = await repoPatch(sandbox, [...written], signal);
        if (!written.size || !finalPatch.diff) throw new Error("Tests passed without a source patch");
        emit(job, { t: "patch", at: Date.now(), ...finalPatch });
        return true;
      }
    } catch (error) {
      const message = errorMessage(error);
      emit(job, { t: "attempt", at: Date.now(), attempt,
        model: process.env.MODEL_BACKEND === "codex" ? "gpt-6-sol" : "openrouter",
        note: message, diff: "", rejected: "attempt failed" });
      emit(job, { t: "error", at: Date.now(), message });
    }
  }
  if (signal.aborted) throw new Error("Job timed out after 8 minutes");
  return false;
}

async function runJob(jobId: string, job: Job) {
  const source = job.source;
  const repo = "repoUrl" in source;
  // Reserve 20 seconds for settlement and cleanup.
  const signal = AbortSignal.timeout(repo ? 460_000 : 220_000);
  let paymentIntentId: string | undefined;
  let sandbox: Awaited<ReturnType<typeof sharedSandbox>>["sandbox"] | undefined;
  let green = false;
  try {
    const amountCents = "repoUrl" in source ? 500 : taskRegistry[source.taskId].task.priceCents;
    const paymentIntent = await hold(jobId, "repoUrl" in source ? "repo" : source.taskId, amountCents);
    paymentIntentId = paymentIntent.id;
    if (paymentIntent.status !== "requires_capture") throw new Error("Stripe hold was not authorized");
    emit(job, {
      t: "hold", at: Date.now(), paymentIntentId, amountCents,
      status: "requires_capture",
    });

    const shared = await sharedSandbox(signal);
    sandbox = shared.sandbox;
    emit(job, {
      t: "sandbox", at: Date.now(), sandboxId: sandbox.id,
      image: "devbox:1", reused: shared.reused, ms: shared.ms,
    });
    emit(job, { t: "egress", at: Date.now(), rules: shared.egress });

    if ("repoUrl" in source) {
      green = await runRepoJob(job, sandbox, source.repoUrl, source.testPath, signal);
    } else {
    const { task, files: seedFiles, expectedTests } = taskRegistry[source.taskId];

    const files: Record<string, string> = { ...seedFiles };
    const tests = Object.fromEntries(Object.entries(seedFiles).filter(([path]) => path.startsWith("test/")));
    let healed = false;
    const inSandbox = async <T>(operation: (current: NonNullable<typeof sandbox>) => Promise<T>): Promise<T> => {
      try { return await operation(sandbox!); }
      catch (error) {
        if (healed || signal.aborted) throw error;
        if (!(error instanceof CreateosSandboxNotFoundError)) {
          let gone = false;
          try { await sandbox!.refresh({ timeoutMs: 10_000, signal }); }
          catch (refreshError) {
            if (!(refreshError instanceof CreateosSandboxNotFoundError)) throw error;
            gone = true;
          }
          if (!gone && sandbox!.status === "running") throw error;
        }
        healed = true;
        const replacement = await sharedSandbox(signal, sandbox);
        sandbox = replacement.sandbox;
        emit(job, { t: "sandbox", at: Date.now(), sandboxId: sandbox.id,
          image: "devbox:1", reused: false, ms: replacement.ms });
        emit(job, { t: "egress", at: Date.now(), rules: replacement.egress });
        await wipeWork(sandbox, signal);
        await uploadFiles(sandbox, files, signal);
        return operation(sandbox);
      }
    };
    await inSandbox((current) => wipeWork(current, signal));
    await inSandbox((current) => uploadFiles(current, files, signal));

    const test = async (attempt: number) => {
      await inSandbox((current) => restoreTests(current, tests, signal));
      const started = Date.now();
      const result = await inSandbox((current) => runTests(current, task.testCmd, signal));
      const output = `${result.result.stdout}${result.result.stderr}`;
      const pass = !result.result.error && testsPassed(result.result.exit_code, output, expectedTests);
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
        const diff = patch.files.map((file, index) =>
          createTwoFilesPatch(paths[index].path, paths[index].path,
            files[paths[index].path] ?? "", file.content)).join("\n");
        const rejected = paths.find((item) => item.rejected)?.rejected ??
          (patch.files.some((file) => /process\.(?:exitCode|reallyExit|exit|kill)\b/.test(file.content))
            ? "used forbidden process control" : undefined);
        if (rejected) {
          emit(job, { t: "attempt", at: Date.now(), attempt, model: patch.model,
            note: patch.note, diff, tokens: patch.tokens, rejected });
          continue;
        }
        for (const [index, file] of patch.files.entries()) {
          const path = paths[index].path;
          await inSandbox((current) => uploadFiles(current, { [path]: file.content }, signal));
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
    }
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
      if (repo) {
        try {
          const rules = await setRepoEgress(sandbox, false);
          emit(job, { t: "egress", at: Date.now(), rules });
        } catch (error) { emit(job, { t: "error", at: Date.now(), message: errorMessage(error) }); }
      }
      try { await wipeWork(sandbox); }
      catch (error) { emit(job, { t: "error", at: Date.now(), message: errorMessage(error) }); }
    }
    job.running = false;
    emit(job, { t: "done", at: Date.now() });
    const nextId = queue.shift();
    for (const [index, waitingId] of queue.entries()) {
      emit(jobs.get(waitingId)!, { t: "queued", at: Date.now(), position: index + 1 });
    }
    if (nextId) void runJob(nextId, jobs.get(nextId)!);
    else root.payOnGreenActive = false;
  }
}
