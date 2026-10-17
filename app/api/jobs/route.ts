import { startJob } from "@/lib/jobs";
import { githubRepoUrl, safeTestPath } from "@/lib/repo";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) return Response.json({ error: "Invalid request" }, { status: 400 });
  let source: string | { repoUrl: string; testPath?: string };
  if ("repoUrl" in body) {
    const repoUrl = githubRepoUrl(body.repoUrl);
    if (!repoUrl) return Response.json({ error: "Use a GitHub repository URL like https://github.com/owner/repo" }, { status: 400 });
    const testPath = "testPath" in body ? safeTestPath(body.testPath) : undefined;
    if ("testPath" in body && !testPath) return Response.json({ error: "Invalid testPath" }, { status: 400 });
    source = { repoUrl, ...(testPath ? { testPath } : {}) };
  } else {
    if (!("taskId" in body) || typeof body.taskId !== "string") return Response.json({ error: "Invalid taskId" }, { status: 400 });
    source = body.taskId;
  }
  const result = startJob(source);
  if (result === "full") return Response.json({ error: "The queue is full. Try again in a minute." }, { status: 429 });
  if (result === "unknown") return Response.json({ error: "Unknown task" }, { status: 404 });
  return Response.json({ jobId: result }, { status: 202 });
}
