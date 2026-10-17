"use client";

import { useEffect, useRef, useState } from "react";
import type { JobEvent, Task } from "@/lib/contract";
import { MOCK_TASKS, mockSteps } from "@/lib/mock";
import { Receipt } from "./Receipt";

function DiffView({ diff }: { diff: string }) {
  return (
    <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed">
      {diff.split("\n").map((l, i) => {
        const cls =
          l.startsWith("+++") || l.startsWith("---")
            ? "text-muted"
            : l.startsWith("+")
              ? "bg-pass-soft text-pass"
              : l.startsWith("-")
                ? "bg-fail-soft text-fail"
                : l.startsWith("@@")
                  ? "text-muted"
                  : "";
        return (
          <div key={i} className={`-mx-4 px-4 ${cls}`}>
            {l || " "}
          </div>
        );
      })}
    </pre>
  );
}

export function Run({ mock }: { mock?: string }) {
  const [tasks, setTasks] = useState<Task[]>(mock ? MOCK_TASKS : []);
  const [taskId, setTaskId] = useState<string>("split-bill");
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cleanup = useRef<() => void>(() => {});

  useEffect(() => {
    if (mock) return;
    fetch("/api/tasks")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`tasks: ${r.status}`))))
      .then((t: Task[]) => setTasks(t))
      .catch(() => setError("Couldn't load the tasks. Is the server running?"));
  }, [mock]);

  useEffect(() => () => cleanup.current(), []);

  const done = events.some((e) => e.t === "done");
  const running = busy && !done;
  const queued = running && !events.some((e) => e.t === "hold") && events.some((e) => e.t === "queued");
  const task = tasks.find((t) => t.id === taskId);
  const tests = events.filter((e): e is Extract<JobEvent, { t: "tests" }> => e.t === "tests");
  const attempts = events.filter((e): e is Extract<JobEvent, { t: "attempt" }> => e.t === "attempt");
  const lastTests = tests.at(-1);
  const lastAttempt = attempts.at(-1);

  async function start() {
    cleanup.current();
    setEvents([]);
    setError(null);
    setBusy(true);

    if (mock) {
      const t0 = Date.now();
      const timers = mockSteps(taskId === "unfixable" ? "fail" : mock).map(({ delay, ev }) =>
        setTimeout(() => setEvents((xs) => [...xs, { ...ev, at: t0 + delay } as JobEvent]), delay),
      );
      cleanup.current = () => timers.forEach(clearTimeout);
      return;
    }

    const r = await fetch("/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
    if (!r.ok) {
      setBusy(false);
      const body = (await r.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? `Couldn't start the job (${r.status}). Try again in a moment.`);
      return;
    }
    const { jobId } = (await r.json()) as { jobId: string };
    const es = new EventSource(`/api/jobs/${jobId}/events`);
    // The server replays every event on (re)connect, so start from empty each time.
    es.onopen = () => setEvents([]);
    es.onmessage = (m) => {
      const ev = JSON.parse(m.data) as JobEvent;
      setEvents((xs) => [...xs, ev]);
      if (ev.t === "done") es.close();
    };
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) setError("Lost the connection to the job.");
    };
    cleanup.current = () => es.close();
  }

  return (
    <>
      <section aria-label="Pick a failing test" className="mt-8">
        <div role="radiogroup" className="grid gap-3 sm:grid-cols-3">
          {tasks.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={t.id === taskId}
              disabled={running}
              onClick={() => setTaskId(t.id)}
              className={`rounded-xl border p-4 text-left transition-[border-color,box-shadow] duration-200 disabled:opacity-60 ${
                t.id === taskId ? "border-fg bg-card shadow-[0_0_0_3px_var(--sunken)]" : "border-line bg-card hover:border-input"
              }`}
            >
              <span className="block font-medium">{t.title}</span>
              <span className="mt-1 block text-sm text-muted">{t.blurb}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            onClick={start}
            disabled={running || !task}
            className="h-12 rounded-full bg-fg px-6 font-medium text-white transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgb(34_197_94/0.25)] active:translate-y-0 active:scale-[0.98] disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
          >
            {queued ? "Waiting in line…" : running ? "Fixing…" : done ? "Run again" : `Fix it for $${((task?.priceCents ?? 500) / 100).toFixed(0)}`}
          </button>
          {mock ? (
            <span className="rounded-full border border-warn/40 bg-warn-soft px-3 py-1 font-mono text-xs text-warn">
              Replay: an example run, not live
            </span>
          ) : (
            <span className="text-sm text-muted">Stripe test mode. Use it freely; no real money moves.</span>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-fail">
            {error}
          </p>
        )}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]">
        <Receipt task={task} events={events} running={running} />

        <div className="flex min-w-0 flex-col gap-6">
          <article className={`panel ${lastTests ? (lastTests.pass ? "panel-pass" : "panel-fail") : ""}`}>
            <header className="panel-head">
              <span>Tests{lastTests ? ` · ${lastTests.attempt === 0 ? "before the agent" : `after patch #${lastTests.attempt}`}` : ""}</span>
              {lastTests && (
                <span className={`pill ${lastTests.pass ? "pill-pass" : "pill-fail"}`}>{lastTests.pass ? "GREEN" : "RED"}</span>
              )}
            </header>
            {lastTests ? (
              <pre className="max-h-72 overflow-auto p-4 font-mono text-[12.5px] leading-relaxed">{lastTests.output}</pre>
            ) : (
              <p className="p-4 text-sm text-muted">
                {running ? "Running the tests inside the sandbox…" : "Pick a failing test and press the button. The test output shows up here."}
              </p>
            )}
          </article>

          <article className={`panel ${lastAttempt?.rejected ? "panel-warn" : ""}`}>
            <header className="panel-head">
              <span>{lastAttempt ? `Agent's patch #${lastAttempt.attempt}` : "Agent's patch"}</span>
              {lastAttempt && <span className="font-mono text-xs text-muted">{lastAttempt.model}</span>}
            </header>
            {lastAttempt ? (
              <>
                {lastAttempt.rejected && (
                  <p className="border-b border-line bg-warn-soft px-4 py-2 text-sm text-warn">
                    Rejected: the agent {lastAttempt.rejected}. It can&apos;t make tests pass by editing them.
                  </p>
                )}
                {lastAttempt.note && <p className="px-4 pt-3 text-sm text-muted">{lastAttempt.note}</p>}
                <DiffView diff={lastAttempt.diff} />
              </>
            ) : (
              <p className="p-4 text-sm text-muted">{running ? "The agent is writing a patch…" : "The agent's code change shows up here."}</p>
            )}
          </article>
        </div>
      </section>
    </>
  );
}
