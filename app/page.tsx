import { Suspense } from "react";
import { Run } from "./components/Run";

async function RunWithParams({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const { mock } = await searchParams;
  return <Run mock={typeof mock === "string" ? mock : undefined} />;
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs tracking-[0.25em] text-muted">PAY-ON-GREEN</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        The agent only gets paid if your tests go green.
      </h1>
      <p className="mt-4 max-w-2xl text-pretty text-muted">
        We put a $5 hold on your card. An AI agent writes a fix for your failing test and runs it inside a locked-down
        CreateOS sandbox. Green tests capture the $5. If it fails three times, the hold is released and you pay nothing.
      </p>
      <Suspense fallback={<div className="mt-10 h-96" />}>
        <RunWithParams searchParams={searchParams} />
      </Suspense>
      <footer className="mt-16 border-t border-line pt-6 text-sm text-muted">
        Built with Stripe Projects: payments on Stripe (test mode), code runs in a CreateOS Sandbox, the model comes from
        OpenRouter.
      </footer>
    </main>
  );
}
