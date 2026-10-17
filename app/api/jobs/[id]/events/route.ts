import { getJob } from "@/lib/jobs";
import type { JobEvent } from "@/lib/contract";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = getJob(id);
  if (!job) return Response.json({ error: "Unknown job" }, { status: 404 });
  const encoder = new TextEncoder();
  let listener: ((event: JobEvent) => void) | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: JobEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        if (event.t === "done") {
          if (listener) job.listeners.delete(listener);
          controller.close();
        }
      };
      for (const event of job.events) send(event);
      if (job.running) {
        listener = send;
        job.listeners.add(listener);
      }
    },
    cancel() {
      if (listener) job.listeners.delete(listener);
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" },
  });
}
