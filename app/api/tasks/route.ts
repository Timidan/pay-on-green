import { splitBill } from "@/lib/tasks/split-bill";

export function GET() {
  return Response.json([splitBill]);
}
