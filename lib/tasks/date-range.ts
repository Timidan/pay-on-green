import type { Task } from "../contract";

export const dateRange: Task = {
  id: "date-range",
  title: "Count the days",
  blurb: "An inclusive date range drops its last day.",
  priceCents: 500,
  testCmd: "node --test 'test/*.test.js'",
};

export const dateRangeFiles = {
  "src/days.js": `function countDays(start, end) {
  const from = Date.parse(start + 'T00:00:00Z');
  const to = Date.parse(end + 'T00:00:00Z');
  return Math.floor((to - from) / 86400000);
}

module.exports = { countDays };
`,
  "test/days.test.js": `const { test } = require('node:test');
const assert = require('node:assert/strict');
const { countDays } = require('../src/days');

test('an inclusive date range counts the last day', () => {
  assert.strictEqual(countDays('2026-10-01', '2026-10-03'), 3);
});
`,
};
