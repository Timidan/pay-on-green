import type { JobEvent, Task } from "@/lib/contract";

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const shortModel = (m: string) => m.split("/").pop()!.replace(/:free$/, "");
const shortId = (id: string) => (id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id);
const stripeUrl = (pi: string) => `https://dashboard.stripe.com/test/payments/${pi}`;

function Line({ label, children, tone }: { label: string; children: React.ReactNode; tone?: "pass" | "fail" | "warn" }) {
  const color = tone === "pass" ? "text-pass" : tone === "fail" ? "text-fail" : tone === "warn" ? "text-warn" : "";
  return (
    <li className="print-in grid grid-cols-[6.5rem_1fr] gap-2 py-1">
      <span className="text-ink-muted">{label}</span>
      <span className={color}>{children}</span>
    </li>
  );
}

function row(ev: JobEvent, i: number) {
  switch (ev.t) {
    case "hold":
      return (
        <Line key={i} label="HOLD">
          {usd(ev.amountCents)} on card ·{" "}
          <a className="underline decoration-dotted underline-offset-2" href={stripeUrl(ev.paymentIntentId)} target="_blank" rel="noreferrer">
            {shortId(ev.paymentIntentId)}
          </a>
        </Line>
      );
    case "sandbox":
      return (
        <Line key={i} label="SANDBOX">
          CreateOS {ev.image} · {ev.reused ? "reused" : "new"} · {ev.ms} ms
        </Line>
      );
    case "egress":
      return (
        <Line key={i} label="NETWORK">
          {ev.rules?.length ? `only ${ev.rules.join(", ")}` : "open"}
        </Line>
      );
    case "tests":
      return (
        <Line key={i} label={`TESTS #${ev.attempt}`} tone={ev.pass ? "pass" : "fail"}>
          {ev.pass ? "✓" : "✗"} {ev.summary}
          {ev.attempt === 0 && " (before the agent)"}
        </Line>
      );
    case "attempt":
      return ev.rejected ? (
        <Line key={i} label={`PATCH #${ev.attempt}`} tone="warn">
          rejected: {ev.rejected}
        </Line>
      ) : (
        <Line key={i} label={`PATCH #${ev.attempt}`}>
          {shortModel(ev.model)}
        </Line>
      );
    case "repo":
      return (
        <Line key={i} label="REPO">
          {ev.url.replace("https://github.com/", "")} @ {ev.commit.slice(0, 7)} · {ev.runner}
        </Line>
      );
    case "setup":
      return (
        <Line key={i} label={ev.step.toUpperCase()} tone={ev.ok ? undefined : "fail"}>
          {ev.ok ? "✓" : "✗"}{" "}
          {ev.step === "clone" ? "cloned" : ev.step === "install" ? "dependencies installed" : "network locked to npm only"}
          {ev.ms ? ` · ${(ev.ms / 1000).toFixed(1)} s` : ""}
          {ev.detail ? ` · ${ev.detail}` : ""}
        </Line>
      );
    case "patch":
      return (
        <Line key={i} label="PATCH" tone="pass">
          ready · {ev.files.length} file{ev.files.length === 1 ? "" : "s"}
        </Line>
      );
    case "queued":
      return (
        <Line key={i} label="IN LINE" tone="warn">
          {ev.position === 1 ? "next up" : `#${ev.position}`} · waiting for the sandbox
        </Line>
      );
    case "error":
      return (
        <Line key={i} label="ERROR" tone="fail">
          {ev.message}
        </Line>
      );
    default:
      return null;
  }
}

export function Receipt({ task, events, running }: { task?: Task; events: JobEvent[]; running: boolean }) {
  // Show only the latest queue position, and drop it once the job starts.
  const started = events.some((e) => e.t === "hold");
  const lastQueued = events.findLast((e) => e.t === "queued");
  const shown = events.filter((e) => e.t !== "queued" || (!started && e === lastQueued));
  const settled = events.find((e) => e.t === "settled");
  const hold = events.find((e) => e.t === "hold");
  const amount = hold?.t === "hold" ? hold.amountCents : (task?.priceCents ?? 500);

  return (
    <section aria-label="Receipt" className="receipt relative self-start px-6 pt-6 pb-10 font-mono text-[13px] leading-snug">
      <header className="flex items-baseline justify-between border-b border-dashed border-ink/30 pb-3">
        <span className="font-semibold tracking-[0.2em]">PAY-ON-GREEN</span>
        <span className="text-ink-muted">{usd(amount)} if green</span>
      </header>
      <p className="mt-3 text-ink-muted">Fix: {task?.title ?? "—"}</p>

      <ol aria-live="polite" className="mt-2 min-h-40">
        {shown.length === 0 && <li className="py-1 text-ink-muted">Your receipt prints here.</li>}
        {shown.map(row)}
        {running && !settled && (
          <li className="py-1 text-ink-muted">
            <span className="blink">▍</span>
          </li>
        )}
      </ol>

      <footer className="mt-3 flex items-baseline justify-between border-t border-dashed border-ink/30 pt-3 text-[15px] font-semibold">
        <span>TOTAL</span>
        <span>{settled?.t === "settled" ? (settled.outcome === "captured" ? usd(amount) : "$0.00") : "pending"}</span>
      </footer>

      {settled?.t === "settled" && <div aria-hidden className="h-24" />}
      {settled?.t === "settled" && (
        <a
          href={stripeUrl(settled.paymentIntentId)}
          target="_blank"
          rel="noreferrer"
          className={`stamp ${settled.outcome === "captured" ? "stamp-pass" : "stamp-neutral"}`}
          title="Open in the Stripe dashboard (test mode)"
        >
          {settled.outcome === "captured" ? (
            <>
              CAPTURED
              <small>{usd(amount)} · tests green</small>
            </>
          ) : (
            <>
              RELEASED
              <small>you paid $0</small>
            </>
          )}
        </a>
      )}
    </section>
  );
}
