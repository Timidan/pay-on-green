import type { Task } from "../contract";
import { splitBill, splitBillFiles } from "./split-bill";
import { dateRange, dateRangeFiles } from "./date-range";
import { unfixable, unfixableFiles } from "./unfixable";

export const taskRegistry: Record<string, { task: Task; files: Record<string, string>; expectedTests: number }> = {
  [splitBill.id]: { task: splitBill, files: splitBillFiles, expectedTests: 1 },
  [dateRange.id]: { task: dateRange, files: dateRangeFiles, expectedTests: 1 },
  [unfixable.id]: { task: unfixable, files: unfixableFiles, expectedTests: 1 },
};
