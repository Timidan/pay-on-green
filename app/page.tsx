import { Suspense } from "react";
import { Hero } from "./components/Hero";
import { Run } from "./components/Run";

async function RunWithParams({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const { mock } = await searchParams;
  return <Run mock={typeof mock === "string" ? mock : undefined} />;
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto w-full max-w-6xl overflow-x-clip px-4 pb-16 sm:px-6">
      <Hero />
      <section id="run" className="scroll-mt-6 pt-14">
        <p className="font-mono text-xs tracking-[0.14em] text-muted uppercase">Try it</p>
        <h2 className="mt-2 text-[clamp(1.75rem,3vw,2.5rem)] leading-tight font-semibold tracking-[-0.03em]">Pick a failing test. Pay only for green.</h2>
        <p className="mt-2 max-w-2xl text-pretty text-muted">
          The $5 is a real Stripe hold in test mode. The fix runs in a CreateOS sandbox that can reach one host and nothing else.
        </p>
        <Suspense fallback={<div className="mt-10 h-96" />}>
          <RunWithParams searchParams={searchParams} />
        </Suspense>
      </section>
      <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-sm text-muted">
        <span>Stack set up with Stripe Projects: Stripe (test mode) · CreateOS Sandbox · OpenRouter</span>
        <a className="underline decoration-line underline-offset-4 hover:text-fg" href="https://github.com/Timidan/pay-on-green">GitHub</a>
      </footer>
    </main>
  );
}
