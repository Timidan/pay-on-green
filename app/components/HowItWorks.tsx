"use client";

import "./iso/iso.css";
import { useEffect, useRef, useState } from "react";
import { Banknote, Box, CircleCheck, CircleX, Lock, PenLine, ShieldCheck, Undo2 } from "lucide-react";
import { BASIS, CARRIAGE, COIN, FIGURE_SVG, GATE_TRAVEL } from "./anatomy-figure";

type Ending = "green" | "red";
type Vec = readonly [number, number, number] | number[];

const STEPS = (ending: Ending) => [
  { at: 0, icon: Lock, title: "Hold $5", sub: "Authorized, not charged" },
  { at: 0.14, icon: Box, title: "Sandbox", sub: "Clone, install, test: red" },
  { at: 0.32, icon: ShieldCheck, title: "Lock", sub: "Network shut before the agent writes" },
  { at: 0.44, icon: PenLine, title: "Patch", sub: "Tests stay read-only" },
  ending === "green"
    ? { at: 0.66, icon: CircleCheck, title: "Green", sub: "The runner's own counts" }
    : { at: 0.66, icon: CircleX, title: "Still red", sub: "Three tries, no green" },
  ending === "green"
    ? { at: 0.8, icon: Banknote, title: "Captured", sub: "$5 paid" }
    : { at: 0.8, icon: Undo2, title: "Released", sub: "You pay $0" },
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const span = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const lerp = (a: Vec, b: Vec, t: number) => a.map((v, i) => v + (b[i] - v) * t);
const screen = ([x, y, z]: Vec) =>
  `translate(${(x * BASIS.x[0] + y * BASIS.y[0] + z * BASIS.z[0]).toFixed(2)} ${(x * BASIS.x[1] + y * BASIS.y[1] + z * BASIS.z[1]).toFixed(2)})`;

function coinAt(p: number, ending: Ending): Vec {
  if (ending === "green") {
    if (p < 0.8) return COIN.hold;
    if (p < 0.86) return lerp(COIN.hold, COIN.lift, ease(span(p, 0.8, 0.86)));
    if (p < 0.95) return lerp(COIN.lift, COIN.over, ease(span(p, 0.86, 0.95)));
    return lerp(COIN.over, COIN.paid, ease(span(p, 0.95, 1)));
  }
  if (p < 0.8) return COIN.hold;
  if (p < 0.9) return lerp(COIN.hold, COIN.refundUp, ease(span(p, 0.8, 0.9)));
  return lerp(COIN.refundUp, COIN.refund, ease(span(p, 0.9, 1)));
}

export function HowItWorks() {
  const section = useRef<HTMLElement>(null);
  const figure = useRef<HTMLDivElement>(null);
  const [ending, setEnding] = useState<Ending>("green");
  const [step, setStep] = useState(0);
  const endingRef = useRef(ending);

  useEffect(() => {
    const root = figure.current!;
    const svg = root.querySelector("svg")!;
    const coin = svg.querySelector('[data-part="coin"]')!;
    const carriage = svg.querySelector('[data-part="carriage"]')!;
    const gate = svg.querySelector('[data-part="gate"]')!;
    const net = svg.querySelector('[data-part="netlamp"]')!;
    const patch = svg.querySelector<SVGPathElement>('[data-part="patchline"]')!;
    const lamps = [...svg.querySelectorAll("[data-lamp]")];
    let frame = 0;

    const draw = () => {
      frame = 0;
      const box = section.current!.getBoundingClientRect();
      const travel = box.height - window.innerHeight;
      const p = travel > 0 ? clamp01(-box.top / travel) : 1;
      const end = endingRef.current;

      coin.setAttribute("transform", screen(coinAt(p, end)));
      carriage.setAttribute("transform", screen([CARRIAGE.from + (CARRIAGE.to - CARRIAGE.from) * ease(span(p, 0.44, 0.64)), 0, 0]));
      gate.setAttribute("transform", screen([GATE_TRAVEL * ease(span(p, 0.32, 0.42)), 0, 0]));
      net.setAttribute("data-state", p >= 0.36 ? "closed" : "open");
      patch.style.strokeDashoffset = String(80 * (1 - span(p, 0.46, 0.64)));
      lamps.forEach((lamp, i) => {
        const state = p < 0.14 ? "off" : end === "green" && p >= 0.66 + i * 0.025 ? "green" : "red";
        lamp.setAttribute("data-state", state);
      });
      const steps = STEPS(end);
      setStep(steps.reduce((acc, s, i) => (p >= s.at ? i : acc), 0));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    draw();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    endingRef.current = ending;
    window.dispatchEvent(new Event("scroll"));
  }, [ending]);

  const steps = STEPS(ending);
  return (
    <section ref={section} id="how" aria-label="How it works" className="relative h-[320vh]">
      <div className="sticky top-0 flex min-h-[100dvh] flex-col justify-center gap-6 py-10 lg:grid lg:grid-cols-[17rem_1fr] lg:items-center lg:gap-10">
        <div>
          <p className="font-mono text-xs tracking-[0.14em] text-muted uppercase">How it works</p>
          <ol className="mt-5 grid grid-cols-3 gap-2 lg:grid-cols-1 lg:gap-1">
            {steps.map(({ icon: Icon, title, sub }, i) => (
              <li
                key={title}
                aria-current={i === step ? "step" : undefined}
                className={`flex items-start gap-3 rounded-xl p-2 transition-[background-color,opacity] duration-300 lg:p-3 ${
                  i === step ? "bg-card shadow-[0_0_0_1px_var(--line)]" : i < step ? "opacity-70" : "opacity-40"
                }`}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-lg transition-colors duration-300 ${
                    i === step ? (ending === "red" && i >= 4 ? "bg-fail-soft text-fail" : "bg-pass-soft text-pass") : "bg-sunken text-muted"
                  }`}
                >
                  <Icon aria-hidden size={18} strokeWidth={1.75} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="hidden text-xs text-muted sm:block">{sub}</span>
                </span>
              </li>
            ))}
          </ol>
          <div role="group" aria-label="Ending" className="mt-5 inline-flex rounded-full border border-line bg-card p-1 text-xs font-medium">
            {(["green", "red"] as const).map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={ending === e}
                onClick={() => setEnding(e)}
                className={`rounded-full px-3 py-1.5 transition-colors ${ending === e ? (e === "green" ? "bg-pass text-white" : "bg-fail text-white") : "text-muted hover:text-fg"}`}
              >
                {e === "green" ? "Tests pass" : "Tests fail"}
              </button>
            ))}
          </div>
        </div>

        <figure className="iso min-w-0 rounded-2xl border border-line bg-card p-3 sm:p-5" data-theme="light">
          <div className="flex items-baseline justify-between font-mono text-[11px] text-muted">
            <span>Fig 1</span>
            <span>Escrow test bench</span>
          </div>
          <div ref={figure} className="anatomy mt-2" dangerouslySetInnerHTML={{ __html: FIGURE_SVG }} />
          <figcaption className="mt-2 flex items-baseline justify-between gap-3 font-mono text-[11px] text-muted">
            <span>Scroll to run it</span>
            <span aria-live="polite" className="text-fg">
              {steps[step].title}
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
