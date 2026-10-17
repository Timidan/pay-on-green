import { startJob } from "@/lib/jobs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const taskId = typeof body === "object" && body !== null && "taskId" in body
    ? body.taskId : undefined;
  if (typeof taskId !== "string") return Response.json({ error: "Invalid taskId" }, { status: 400 });
  const result = startJob(taskId);
  if (result === "busy") return Response.json({ error: "A job is running" }, { status: 409 });
  if (result === "unknown") return Response.json({ error: "Unknown task" }, { status: 404 });
  return Response.json({ jobId: result }, { status: 202 });
}
