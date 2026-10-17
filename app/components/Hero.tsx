"use client";

import { useEffect, useState } from "react";
import type { JobEvent } from "@/lib/contract";
import { MOCK_TASKS, mockSteps } from "@/lib/mock";
import { Receipt } from "./Receipt";
import { ShimmerButton } from "./fx/ShimmerButton";

// Loops two recorded runs, a capture then a release, on the hero receipt.
function useReplay() {
  const [round, setRound] = useState(0);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const script = round % 2 === 0 ? "fix" : "fail";

  useEffect(() => {
    const steps = mockSteps(script);
    const t0 = Date.now();
    const timers = steps.map(({ delay, ev }) =>
      setTimeout(() => setEvents((xs) => [...xs, { ...ev, at: t0 + delay } as JobEvent]), delay + 600),
    );
    const last = steps.at(-1)!.delay + 600;
    timers.push(
      setTimeout(() => {
        setEvents([]);
        setRound((r) => r + 1);
      }, last + 3800),
    );
    return () => timers.forEach(clearTimeout);
  }, [script, round]);

  return { events, task: MOCK_TASKS[script === "fix" ? 0 : 2], running: !events.some((e) => e.t === "done") };
}

const rise = (i: number) => ({ "--i": i }) as React.CSSProperties;

export function Hero() {
  const replay = useReplay();
  return (
    <section className="grid min-h-[min(88dvh,52rem)] items-center gap-12 py-12 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
      <div className="lg:self-center">
        <p className="rise font-mono text-[0.75rem] tracking-[0.14em] text-muted uppercase" style={rise(0)}>
          Pay-on-Green
        </p>
        <h1
          className="rise mt-5 text-[clamp(3rem,7.2vw,7rem)] leading-[0.9] font-semibold tracking-[-0.055em] text-balance"
          style={rise(1)}
        >
          Pay the agent only when it&apos;s{" "}
          <span className="relative whitespace-nowrap text-pass">
            green
            <span aria-hidden className="absolute inset-x-0 -bottom-[0.06em] h-[0.1em] rounded-full bg-accent/70" />
          </span>
          .
        </h1>
        <p className="rise mt-7 max-w-[42ch] text-[clamp(1.0625rem,1.3vw,1.25rem)] leading-relaxed text-ink-2" style={rise(2)}>
          Stripe holds $5. The agent fixes your failing test in a locked CreateOS sandbox. Green captures it. Red releases it.
        </p>
        <div className="rise mt-9" style={rise(3)}>
          <ShimmerButton
            shimmerColor="#22c55e"
            background="#0f1214"
            className="h-12 px-7 text-[0.9375rem] font-medium"
            onClick={() => document.getElementById("run")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            Try a live fix
          </ShimmerButton>
        </div>
      </div>

      <figure className="rise relative mx-auto min-h-[600px] w-full max-w-[380px] lg:translate-y-10 lg:rotate-[1.5deg]" style={rise(2)}>
        <div aria-hidden className="absolute -inset-6 -z-10 rounded-[28px] bg-[radial-gradient(closest-side,rgb(34_197_94/0.14),transparent)]" />
        <div aria-hidden className="pointer-events-none">
          <Receipt task={replay.task} events={replay.events} running={replay.running} />
        </div>
        <figcaption className="mt-4 text-center font-mono text-[0.7rem] tracking-[0.08em] text-muted uppercase">
          An example run, replayed
        </figcaption>
      </figure>
    </section>
  );
}
