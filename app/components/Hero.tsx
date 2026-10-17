"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Box, CircleCheck, Lock, Undo2 } from "lucide-react";
import type { JobEvent } from "@/lib/contract";
import { MOCK_TASKS, mockSteps } from "@/lib/mock";
import { Receipt } from "./Receipt";
import { ShimmerButton } from "./fx/ShimmerButton";

// Loops two recorded runs, a capture then a release, on the hero receipt.
function useReplay(paused: boolean) {
  const [round, setRound] = useState(0);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const script = round % 2 === 0 ? "fix" : "fail";

  useEffect(() => {
    if (paused) return;
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
  }, [script, round, paused]);

  return { events, task: MOCK_TASKS[script === "fix" ? 0 : 2], running: !events.some((e) => e.t === "done") };
}

const rise = (i: number) => ({ "--i": i }) as React.CSSProperties;

export function Hero() {
  const [paused, setPaused] = useState(false);
  const replay = useReplay(paused);
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
        <ul className="rise mt-7 flex flex-wrap gap-2" style={rise(2)} aria-label="How it pays">
          {[
            { icon: Lock, text: "$5 held" },
            { icon: Box, text: "Fixed in a sandbox" },
            { icon: CircleCheck, text: "Green = paid" },
            { icon: Undo2, text: "Red = $0" },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-2 text-sm font-medium text-ink-2">
              <Icon aria-hidden size={16} strokeWidth={1.75} className="text-pass" />
              {text}
            </li>
          ))}
        </ul>
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
        <div className="rise mt-10 flex flex-wrap items-center gap-x-6 gap-y-3" style={rise(4)}>
          <span className="font-mono text-[0.7rem] tracking-[0.14em] text-muted uppercase">Powered by</span>
          <a href="https://docs.stripe.com/projects" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 opacity-80 transition-opacity hover:opacity-100" aria-label="Stripe Projects">
            <Image src="/brand/stripe-mark.svg" alt="" width={22} height={22} unoptimized />
            <span className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[#635BFF]">Stripe</span>
          </a>
          <a href="https://createos.sh" target="_blank" rel="noreferrer" className="opacity-80 transition-opacity hover:opacity-100" aria-label="CreateOS">
            <Image src="/brand/createos.svg" alt="" width={130} height={45} unoptimized className="-my-2" />
          </a>
        </div>
      </div>

      <figure className="rise relative mx-auto min-h-[600px] w-full max-w-[380px] lg:translate-y-10 lg:rotate-[1.5deg]" style={rise(2)}>
        <div aria-hidden className="absolute -inset-6 -z-10 rounded-[28px] bg-[radial-gradient(closest-side,rgb(34_197_94/0.14),transparent)]" />
        <div aria-hidden inert className="pointer-events-none">
          <Receipt task={replay.task} events={replay.events} running={replay.running} />
        </div>
        <figcaption className="mt-4 flex items-center justify-center gap-3 font-mono text-[0.7rem] tracking-[0.08em] text-muted uppercase">
          An example run, replayed
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="rounded-full border border-line px-2.5 py-1 tracking-normal normal-case hover:border-input focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
          >
            {paused ? "Play" : "Pause"}
          </button>
        </figcaption>
      </figure>
    </section>
  );
}
