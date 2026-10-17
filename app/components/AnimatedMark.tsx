"use client";

import { useId } from "react";

export function AnimatedMark({ size = 80, play = "static" }: { size?: number; play?: "intro" | "loop" | "static" }) {
  const slot = useId();
  const motion = play === "static" ? "" : `pog-${play}`;

  return (
    <svg width={size} height={size} viewBox="0 0 80 80" role="img" aria-label="Pay-on-Green" className={motion}>
      <style>{`
        .pog-intro .pog-paper { animation: pog-feed 1.6s both; }
        .pog-intro .pog-line-one { animation: pog-print-one 1.6s both; }
        .pog-intro .pog-line-two { animation: pog-print-two 1.6s both; }
        .pog-intro .pog-red { animation: pog-red 1.6s both; }
        .pog-intro .pog-edge { animation: pog-fill 1.6s both; }
        .pog-intro .pog-teeth { animation: pog-teeth 1.6s both; }
        .pog-intro .pog-check { animation: pog-stamp 1.6s both; transform-origin: 39px 38px; }
        .pog-loop .pog-edge { animation: pog-refill 6s linear infinite; }
        .pog-loop .pog-check { animation: pog-restamp 6s infinite; transform-origin: 39px 38px; }
        @keyframes pog-feed { 0% {transform:translateY(34px)} 8% {transform:translateY(37px)} 47% {transform:translateY(-2px)} 59%,100% {transform:translateY(0)} }
        @keyframes pog-print-one { 0%,29% {stroke-dashoffset:26} 57%,100% {stroke-dashoffset:0} }
        @keyframes pog-print-two { 0%,40% {stroke-dashoffset:18} 67%,100% {stroke-dashoffset:0} }
        @keyframes pog-red { 0%,61%,65%,71%,77%,100% {opacity:0} 63%,68%,74% {opacity:1} }
        @keyframes pog-fill { 0%,70% {stroke-dashoffset:46} 89%,100% {stroke-dashoffset:0} }
        @keyframes pog-teeth { 0%,82% {opacity:0} 94%,100% {opacity:1} }
        @keyframes pog-stamp { 0%,79% {opacity:0;transform:translateY(-11px) scale(.85,1.14)} 88% {opacity:1;transform:translateY(2px) scale(1.15,.82)} 95% {transform:translateY(-1px) scale(.96,1.04)} 100% {opacity:1;transform:translateY(0) scale(1)} }
        @keyframes pog-refill { 0%,9% {stroke-dashoffset:0} 12% {stroke-dashoffset:46} 25%,100% {stroke-dashoffset:0} }
        @keyframes pog-restamp { 0%,13%,100% {transform:translateY(0) scale(1)} 16% {transform:translateY(-5px) scale(.9,1.1)} 20% {transform:translateY(2px) scale(1.12,.85)} 24% {transform:translateY(0) scale(1)} }
        @media (prefers-reduced-motion: reduce) { .pog-intro *, .pog-loop * { animation:none!important; transform:none!important; opacity:1!important; stroke-dashoffset:0!important; } .pog-red { opacity:0!important; } }
      `}</style>
      <defs><clipPath id={slot}><rect x="17" y="11" width="46" height="54" /></clipPath></defs>
      <rect width="80" height="80" rx="16" fill="#0F1214" />
      <g clipPath={`url(#${slot})`}>
        <g className="pog-paper">
          <path d="M17 11H63V59L58 65L53 59L48 65L43 59L38 65L33 59L28 65L23 59L17 65Z" fill="#FBF8F1" />
          <path className="pog-line-one" d="M25 22H51" stroke="#0F1214" opacity=".38" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="26" />
          <path className="pog-line-two" d="M25 28H43" stroke="#0F1214" opacity=".38" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="18" />
          <path className="pog-red" d="M17 56H63" stroke="#AF3526" strokeWidth="5" opacity="0" />
          <path className="pog-edge" d="M17 56H63" stroke="#22C55E" strokeWidth="5" strokeDasharray="46" />
          <path className="pog-teeth" d="M17 59V65L23 59L28 65L33 59L38 65L43 59L48 65L53 59L58 65L63 59Z" fill="#22C55E" />
          <path className="pog-check" d="M26 39L34 47L53 28" fill="none" stroke="#0F1214" strokeWidth="6" strokeLinecap="square" strokeLinejoin="miter" />
        </g>
      </g>
    </svg>
  );
}
