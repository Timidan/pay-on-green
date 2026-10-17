import type { Task } from "../contract";

export const splitBill: Task = {
  id: "split-bill",
  title: "Split the bill",
  blurb: "Splitting $10 three ways loses a cent. Fix the rounding.",
  priceCents: 500,
  testCmd: "node --test 'test/*.test.js'",
};

export const splitBillFiles = {
  "src/split.js": `function splitBill(cents, people) {
  return Array(people).fill(Math.floor(cents / people));
}

module.exports = { splitBill };
`,
  "test/split.test.js": `const { test } = require('node:test');
const assert = require('node:assert/strict');
const { splitBill } = require('../src/split');

test('a split bill keeps every cent', () => {
  assert.deepEqual(splitBill(1000, 3), [334, 333, 333]);
});
`,
};
