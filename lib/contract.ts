// The interface between the UI and the job runner. Frozen: change it only by agreement.

export type Task = {
  id: string;
  title: string;
  blurb: string;
  priceCents: number;
  testCmd: string;
};

export type JobEvent =
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
