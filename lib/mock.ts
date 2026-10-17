// Scripted job events so the UI can be built and demoed without the backend (?mock=fix or ?mock=fail).
import type { JobEvent, Task } from "./contract";

export const MOCK_TASKS: Task[] = [
  { id: "split-bill", title: "Split a bill", blurb: "Splitting $10 three ways loses a cent.", priceCents: 500, testCmd: "node --test 'test/*.test.js'" },
  { id: "date-range", title: "Count the days", blurb: "An inclusive date range drops its last day.", priceCents: 500, testCmd: "node --test 'test/*.test.js'" },
  { id: "unfixable", title: "Contradictory test", blurb: "Two assertions that can't both pass. The agent should fail, and you should pay nothing.", priceCents: 500, testCmd: "node --test 'test/*.test.js'" },
];

const RED = `✖ splits $10 three ways (1.1ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    [
  +   333,
  -   334,
      333,
      333
    ]
ℹ tests 2
ℹ pass 1
ℹ fail 1`;

const GREEN = `✔ splits $10 three ways (0.9ms)
✔ never loses a cent (0.3ms)
ℹ tests 2
ℹ pass 2
ℹ fail 0`;

const FIX_DIFF = `--- a/src/split.js
+++ b/src/split.js
@@ -1 +1,5 @@
-export const split = (cents, n) => Array(n).fill(Math.floor(cents / n));
+export const split = (cents, n) => {
+  const base = Math.floor(cents / n);
+  const rem = cents % n;
+  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
+};`;

const CHEAT_DIFF = `--- a/test/f.test.js
+++ b/test/f.test.js
@@ -3,3 +3,2 @@
   const a = f(2);
   assert.strictEqual(a, 4);
-  assert.strictEqual(a, 5);`;

const NOPE = `✖ f(2) is 4 and 5 (0.8ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

  4 !== 5

ℹ tests 1
ℹ pass 0
ℹ fail 1`;

const MODEL = "nvidia/nemotron-3-super-120b-a12b:free";
const PI = "pi_3URU0jDIML7PcSls0dFiQPmI";

type NoAt<T> = T extends unknown ? Omit<T, "at"> : never;
type Step = { delay: number; ev: NoAt<JobEvent> };

const opening: Step[] = [
  { delay: 300, ev: { t: "hold", paymentIntentId: PI, amountCents: 500, status: "requires_capture" } },
  { delay: 1100, ev: { t: "sandbox", sandboxId: "sb-01m53gysq6524smxy6026eb0fb", image: "devbox:1", reused: true, ms: 140 } },
  { delay: 1500, ev: { t: "egress", rules: ["registry.npmjs.org:443"] } },
];

const scripts: Record<string, Step[]> = {
  fix: [
    ...opening,
    { delay: 2400, ev: { t: "tests", attempt: 0, pass: false, summary: "1 of 2 failing", output: RED, ms: 390 } },
    { delay: 6500, ev: { t: "attempt", attempt: 1, model: MODEL, note: "Hand the leftover cents to the first people in line.", diff: FIX_DIFF } },
    { delay: 7600, ev: { t: "tests", attempt: 1, pass: true, summary: "2 of 2 passing", output: GREEN, ms: 310 } },
    { delay: 8800, ev: { t: "settled", outcome: "captured", paymentIntentId: PI, status: "succeeded" } },
    { delay: 9000, ev: { t: "done" } },
  ],
  fail: [
    ...opening,
    { delay: 2400, ev: { t: "tests", attempt: 0, pass: false, summary: "1 of 1 failing", output: NOPE, ms: 380 } },
    { delay: 5600, ev: { t: "attempt", attempt: 1, model: MODEL, note: "Remove the second assertion.", diff: CHEAT_DIFF, rejected: "touched a test file" } },
    { delay: 8800, ev: { t: "attempt", attempt: 2, model: MODEL, note: "Return 4 first, then 5.", diff: "--- a/src/f.js\n+++ b/src/f.js\n@@ -1 +1,2 @@\n-export const f = (x) => x * 2;\n+let n = 0;\n+export const f = (x) => (n++ ? 5 : 4);" } },
    { delay: 9800, ev: { t: "tests", attempt: 2, pass: false, summary: "1 of 1 failing", output: NOPE, ms: 300 } },
    { delay: 12800, ev: { t: "attempt", attempt: 3, model: MODEL, note: "No value can equal both 4 and 5.", diff: "--- a/src/f.js\n+++ b/src/f.js\n@@ -1,2 +1 @@\n-let n = 0;\n-export const f = (x) => (n++ ? 5 : 4);\n+export const f = (x) => x * 2;" } },
    { delay: 13700, ev: { t: "tests", attempt: 3, pass: false, summary: "1 of 1 failing", output: NOPE, ms: 290 } },
    { delay: 14600, ev: { t: "settled", outcome: "released", paymentIntentId: PI, status: "canceled" } },
    { delay: 14800, ev: { t: "done" } },
  ],
};

const VITEST_RED = ` ❯ test/money.test.js (5 tests | 3 failed) 9ms
   × formatCents > formats whole dollars
     → expected '$5.0' to be '$5.00'
   × formatCents > pads single-digit cents
     → expected '$19.5' to be '$19.05'
   × splitCents > never loses a cent
     → expected 999 to be 1000

 Test Files  1 failed (1)
      Tests  3 failed | 2 passed (5)`;

const VITEST_GREEN = ` ✓ test/money.test.js (5 tests) 4ms

 Test Files  1 passed (1)
      Tests  5 passed (5)`;

const REPO_DIFF = `--- a/src/money.js
+++ b/src/money.js
@@ -2,11 +2,13 @@
 export function formatCents(cents) {
   const dollars = Math.floor(cents / 100);
   const rest = cents % 100;
-  return \`$\${dollars}.\${rest}\`;
+  return \`$\${dollars}.\${String(rest).padStart(2, "0")}\`;
 }

 // Splits a total in cents across n people, never losing a cent.
 export function splitCents(total, n) {
-  const share = Math.round(total / n);
-  return Array(n).fill(share);
+  const base = Math.floor(total / n);
+  const extra = total % n;
+  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
 }`;

scripts.repo = [
  { delay: 300, ev: { t: "hold", paymentIntentId: PI, amountCents: 500, status: "requires_capture" } },
  { delay: 900, ev: { t: "sandbox", sandboxId: "sb-01m53gysq6524smxy6026eb0fb", image: "devbox:1", reused: true, ms: 140 } },
  { delay: 2600, ev: { t: "setup", step: "clone", ok: true, ms: 1400 } },
  { delay: 2700, ev: { t: "repo", url: "https://github.com/Timidan/pay-on-green-sample", commit: "a1b2c3d4e5", testCmd: "npx vitest run", runner: "vitest" } },
  { delay: 6200, ev: { t: "setup", step: "install", ok: true, ms: 3400 } },
  { delay: 6500, ev: { t: "setup", step: "lock", ok: true, ms: 120 } },
  { delay: 6600, ev: { t: "egress", rules: ["registry.npmjs.org:443"] } },
  { delay: 8200, ev: { t: "tests", attempt: 0, pass: false, summary: "3 of 5 failing", output: VITEST_RED, ms: 1500 } },
  { delay: 13500, ev: { t: "attempt", attempt: 1, model: MODEL, note: "Pad cents to two digits; hand leftover cents to the first people.", diff: REPO_DIFF } },
  { delay: 15000, ev: { t: "tests", attempt: 1, pass: true, summary: "5 of 5 passing", output: VITEST_GREEN, ms: 1400 } },
  { delay: 15800, ev: { t: "settled", outcome: "captured", paymentIntentId: PI, status: "succeeded" } },
  { delay: 15900, ev: { t: "patch", diff: REPO_DIFF, files: ["src/money.js"] } },
  { delay: 16000, ev: { t: "done" } },
];

export function mockSteps(name: string): Step[] {
  return scripts[name] ?? scripts.fix;
}
