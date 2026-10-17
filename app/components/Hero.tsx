"use client";

import PixelFlowField from "./fx/PixelFlowField";
import { ShimmerButton } from "./fx/ShimmerButton";

export function Hero() {
  return (
    <section className="pt-6 pb-4">
      <PixelFlowField
        text="$5"
        shape="square"
        cellSize={6}
        gap={2}
        speed={0.55}
        colors={["var(--sunken)", "var(--line)", "color-mix(in oklab, var(--accent) 22%, var(--line))"]}
        className="rounded-2xl border border-line bg-card"
      >
        <div className="flex min-h-[min(78dvh,40rem)] flex-col items-center justify-center gap-6 px-5 py-16 text-center">
          <p className="rise font-mono text-[0.75rem] tracking-[0.14em] text-muted uppercase" style={{ "--i": 0 } as React.CSSProperties}>
            Pay-on-Green · CreateOS × Stripe Projects
          </p>
          <h1
            className="rise max-w-[16ch] text-[clamp(2.5rem,6.4vw,5.75rem)] leading-[0.95] font-semibold tracking-[-0.045em] text-balance"
            style={{ "--i": 1 } as React.CSSProperties}
          >
            The agent only gets paid if your tests go{" "}
            <span className="relative whitespace-nowrap text-pass">
              green
              <span aria-hidden className="absolute inset-x-0 -bottom-1 h-[0.12em] rounded-full bg-accent/70" />
            </span>
            .
          </h1>
          <p className="rise text-[clamp(1.125rem,1.8vw,1.5rem)] font-medium text-ink-2" style={{ "--i": 2 } as React.CSSProperties}>
            <span className="cycle" aria-label="Hold $5. Fix the test. Green captures, red releases.">
              <span>$5 held on your card.</span>
              <span>The agent writes the fix.</span>
              <span>Green captures. Red releases.</span>
            </span>
          </p>
          <div className="rise" style={{ "--i": 3 } as React.CSSProperties}>
            <ShimmerButton
              shimmerColor="#22c55e"
              background="#0f1214"
              className="h-12 px-6 text-[0.9375rem] font-medium"
              onClick={() => document.getElementById("run")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              Watch it fix a test
            </ShimmerButton>
          </div>
        </div>
      </PixelFlowField>
    </section>
  );
}
