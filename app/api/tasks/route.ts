import { taskRegistry } from "@/lib/tasks";

export function GET() {
  return Response.json(Object.values(taskRegistry).map(({ task }) => task));
}
