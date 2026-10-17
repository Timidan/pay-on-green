import type { Task } from "../contract";

export const unfixable: Task = {
  id: "unfixable",
  title: "Contradictory test",
  blurb: "Two assertions that can't both pass. The agent should fail, and you should pay nothing.",
  priceCents: 500,
  testCmd: "node --test 'test/*.test.js'",
};

export const unfixableFiles = {
  "src/f.js": `function f(x) {
  return x * 2;
}

module.exports = { f };
`,
  "test/f.test.js": `const { test } = require('node:test');
const assert = Object.freeze({ strictEqual: require('node:assert/strict').strictEqual });
const { f } = require('../src/f');

test('f(2) is both 4 and 5', () => {
  const a = f(2);
  assert.strictEqual(a, 4);
  assert.strictEqual(a, 5);
});
`,
};
