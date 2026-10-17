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

const SAMPLE_REPO = "https://github.com/Timidan/pay-on-green-sample";
const GITHUB_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+?(\.git)?\/?$/;
const REPO_TASK: Task = {
  id: "repo",
  title: "Your repo",
  blurb: "Paste a public GitHub repo with a failing test. Node: Vitest, Jest or node:test.",
  priceCents: 500,
  testCmd: "detected",
};

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/x-diff" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

export function Run({ mock }: { mock?: string }) {
  const [tasks, setTasks] = useState<Task[]>(mock ? MOCK_TASKS : []);
  const [taskId, setTaskId] = useState<string>("split-bill");
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [repoUrl, setRepoUrl] = useState(SAMPLE_REPO);
  const [testPath, setTestPath] = useState("");
  const [copied, setCopied] = useState(false);
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
  const isRepo = taskId === "repo";
  const repoOk = GITHUB_RE.test(repoUrl.trim());
  const repoName = repoUrl.trim().replace(/^https:\/\/github\.com\//, "").replace(/(\.git)?\/?$/, "");
  const task = isRepo ? { ...REPO_TASK, title: repoOk ? repoName : "Your repo" } : tasks.find((t) => t.id === taskId);
  const finalPatch = events.findLast((e): e is Extract<JobEvent, { t: "patch" }> => e.t === "patch");
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
      const timers = mockSteps(isRepo ? "repo" : taskId === "unfixable" ? "fail" : mock).map(({ delay, ev }) =>
        setTimeout(() => setEvents((xs) => [...xs, { ...ev, at: t0 + delay } as JobEvent]), delay),
      );
      cleanup.current = () => timers.forEach(clearTimeout);
      return;
    }

    const r = await fetch("/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(isRepo ? { repoUrl: repoUrl.trim(), testPath: testPath.trim() || undefined } : { taskId }),
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
      if (es.readyState === EventSource.CLOSED) setError("Lost the connection to the job. The hold still settles; refresh to run another fix.");
    };
    cleanup.current = () => es.close();
  }

  return (
    <>
      <section aria-label="Pick a failing test" className="mt-8">
        <div role="group" aria-label="Failing test to fix" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[...tasks, REPO_TASK].map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={t.id === taskId}
              disabled={running}
              onClick={() => setTaskId(t.id)}
              className={`rounded-xl border p-4 text-left transition-[border-color,box-shadow] duration-200 disabled:opacity-60 ${
                t.id === taskId ? "border-fg bg-card shadow-[0_0_0_3px_var(--sunken)]" : "border-line bg-card hover:border-input"
              }`}
            >
              <span className="flex items-center gap-2 font-medium">
                {t.title}
                {t.id === "repo" && <span className="rounded-full bg-pass-soft px-2 py-0.5 font-mono text-[10px] text-pass uppercase">yours</span>}
              </span>
              <span className="mt-1 block text-sm text-muted">{t.blurb}</span>
            </button>
          ))}
        </div>

        {isRepo && (
          <div className="mt-4 grid gap-3 rounded-xl border border-line bg-card p-4 sm:grid-cols-[1fr_16rem]">
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted">Public GitHub repository</span>
              <input
                type="url"
                inputMode="url"
                spellCheck={false}
                value={repoUrl}
                disabled={running}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                aria-invalid={!repoOk}
                aria-describedby={repoOk ? undefined : "repo-url-error"}
                className={`h-11 rounded-lg border bg-bg px-3 font-mono text-base outline-offset-2 focus-visible:outline-2 focus-visible:outline-fg sm:text-[13px] ${repoOk ? "border-input" : "border-fail"}`}
              />
              {!repoOk && (
                <span id="repo-url-error" className="text-xs text-fail">
                  Use a public GitHub link like https://github.com/owner/repo
                </span>
              )}
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted">Test file (optional)</span>
              <input
                value={testPath}
                disabled={running}
                spellCheck={false}
                onChange={(e) => setTestPath(e.target.value)}
                placeholder="test/money.test.js"
                className="h-11 rounded-lg border border-input bg-bg px-3 font-mono text-base outline-offset-2 focus-visible:outline-2 focus-visible:outline-fg sm:text-[13px]"
              />
            </label>
            <p className="text-xs text-muted sm:col-span-2">
              The sandbox clones and installs with GitHub and npm reachable, then locks the network before the agent writes code. Your test
              files, package.json, lockfile and test config are protected.{" "}
              {repoUrl !== SAMPLE_REPO && (
                <button type="button" className="underline underline-offset-2 hover:text-fg" onClick={() => setRepoUrl(SAMPLE_REPO)}>
                  Use the sample repo
                </button>
              )}
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            onClick={start}
            disabled={running || !task || (isRepo && !repoOk)}
            className="h-12 rounded-full bg-fg px-6 font-medium text-white transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgb(34_197_94/0.25)] active:translate-y-0 active:scale-[0.96] disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
          >
            {queued ? "Waiting in line…" : running ? "Fixing…" : done ? "Run again" : isRepo ? "Fix my repo for $5" : `Fix it for $${((task?.priceCents ?? 500) / 100).toFixed(0)}`}
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

          {finalPatch && (
            <article className="panel panel-pass">
              <header className="panel-head">
                <span className="min-w-0">Your patch · {finalPatch.files.length} file{finalPatch.files.length === 1 ? "" : "s"} · tests green</span>
                <div className="flex shrink-0 gap-2 whitespace-nowrap">
                  <button
                    onClick={() => download("pay-on-green.patch", finalPatch.diff)}
                    className="rounded-full bg-fg px-3 py-1 text-xs font-medium text-white hover:opacity-90"
                  >
                    Download .patch
                  </button>
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText("git apply pay-on-green.patch");
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    className="rounded-full border border-input px-3 py-1 font-mono text-xs hover:border-fg"
                  >
                    {copied ? "copied" : "git apply pay-on-green.patch"}
                  </button>
                </div>
              </header>
              <DiffView diff={finalPatch.diff} />
            </article>
          )}
        </div>
      </section>
    </>
  );
}
