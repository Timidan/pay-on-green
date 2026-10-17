// The interface between the UI and the job runner. Frozen: change it only by agreement.

export type Task = {
  id: string;
  title: string;
  blurb: string;
  priceCents: number;
  testCmd: string;
};

export type JobEvent =
  | { t: "queued"; at: number; position: number }
  | { t: "repo"; at: number; url: string; commit: string; testCmd: string; runner: "node" | "jest" | "vitest" | "npm" }
  | { t: "setup"; at: number; step: "clone" | "install" | "lock"; ok: boolean; ms: number; detail?: string }
  | { t: "patch"; at: number; diff: string; files: string[] }
  | { t: "hold"; at: number; paymentIntentId: string; amountCents: number; status: "requires_capture" }
  | { t: "sandbox"; at: number; sandboxId: string; image: string; reused: boolean; ms: number }
  | { t: "egress"; at: number; rules: string[] | null }
  | { t: "tests"; at: number; attempt: number; pass: boolean; summary: string; output: string; ms: number }
  | {
      t: "attempt";
      at: number;
      attempt: number;
      model: string;
      note: string;
      diff: string;
      tokens?: number;
      rejected?: string;
    }
  | {
      t: "settled";
      at: number;
      outcome: "captured" | "released";
      paymentIntentId: string;
      status: "succeeded" | "canceled";
    }
  | { t: "error"; at: number; message: string }
  | { t: "done"; at: number };

// `attempt: 0` is the red baseline run, before the agent writes anything.
// `queued` is sent while the job waits for the shared sandbox; position 1 means next.
// Repo jobs (POST {repoUrl, testPath?}) add `repo` and `setup` events before the red run,
// and a final `patch` (the cumulative diff against the original commit) when captured.
