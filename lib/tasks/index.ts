import type { Task } from "../contract";
import { splitBill, splitBillFiles } from "./split-bill";
import { dateRange, dateRangeFiles } from "./date-range";
import { unfixable, unfixableFiles } from "./unfixable";

export const taskRegistry: Record<string, { task: Task; files: Record<string, string> }> = {
  [splitBill.id]: { task: splitBill, files: splitBillFiles },
  [dateRange.id]: { task: dateRange, files: dateRangeFiles },
  [unfixable.id]: { task: unfixable, files: unfixableFiles },
};
