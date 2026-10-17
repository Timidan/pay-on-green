import { randomUUID } from "node:crypto";
import type { JobEvent } from "./contract";
import { sharedSandbox, uploadFiles, wipeWork, runTests } from "./sandbox";
import { hold, release } from "./stripe";
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
  for (const listener of job.listeners) listener(event);
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
  let paymentIntentId: string | undefined;
  let sandbox: Awaited<ReturnType<typeof sharedSandbox>>["sandbox"] | undefined;
  try {
    const paymentIntent = await hold(jobId, splitBill.id, splitBill.priceCents);
    paymentIntentId = paymentIntent.id;
    if (paymentIntent.status !== "requires_capture") throw new Error("Stripe hold was not authorized");
    emit(job, {
      t: "hold", at: Date.now(), paymentIntentId, amountCents: splitBill.priceCents,
      status: "requires_capture",
    });

    const shared = await sharedSandbox();
    sandbox = shared.sandbox;
    emit(job, {
      t: "sandbox", at: Date.now(), sandboxId: sandbox.id,
      image: "devbox:1", reused: shared.reused, ms: shared.ms,
    });
    emit(job, { t: "egress", at: Date.now(), rules: shared.egress });

    await wipeWork(sandbox);
    await uploadFiles(sandbox, splitBillFiles);
    const started = Date.now();
    const test = await runTests(sandbox, splitBill.testCmd);
    const pass = test.result.exit_code === 0;
    emit(job, {
      t: "tests", at: Date.now(), attempt: 0, pass,
      summary: pass ? "Tests passed" : "Tests failed",
      output: `${test.result.stdout}${test.result.stderr}`,
      ms: Date.now() - started,
    });
    if (pass) throw new Error("Seeded test unexpectedly passed");
  } catch {
    emit(job, { t: "error", at: Date.now(), message: "Job failed before settlement" });
  } finally {
    if (paymentIntentId) {
      try {
        const canceled = await release(jobId, paymentIntentId);
        if (canceled.status !== "canceled") throw new Error("Stripe did not cancel the hold");
        emit(job, {
          t: "settled", at: Date.now(), outcome: "released", paymentIntentId,
          status: "canceled",
        });
      } catch {
        emit(job, { t: "error", at: Date.now(), message: "Could not confirm hold release" });
      }
    }
    if (sandbox) {
      try {
        await wipeWork(sandbox);
      } catch {
        emit(job, { t: "error", at: Date.now(), message: "Could not clean sandbox work directory" });
      }
    }
    job.running = false;
    emit(job, { t: "done", at: Date.now() });
  }
}
