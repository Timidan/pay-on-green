import assert from "node:assert/strict";
import { test } from "node:test";
import { githubRepoUrl, protectedPath, safeTestPath, testCounts } from "./repo.ts";

test("repo input and patch guards", () => {
  assert.equal(githubRepoUrl("https://github.com/Timidan/pay-on-green-sample/"), "https://github.com/Timidan/pay-on-green-sample.git");
  assert.equal(githubRepoUrl("https://github.com/Timidan/pay-on-green-sample.git"), "https://github.com/Timidan/pay-on-green-sample.git");
  assert.equal(githubRepoUrl("https://github.com.evil.test/Timidan/repo"), undefined);
  assert.equal(githubRepoUrl("https://github.com/Timidan/repo\n"), undefined);
  assert.equal(safeTestPath("tests/pay.test.ts"), "tests/pay.test.ts");
  assert.equal(safeTestPath("../tests/pay.test.ts"), undefined);
  assert.equal(safeTestPath("--help"), undefined);
  assert.equal(protectedPath("src/add.test.ts"), true);
  assert.equal(protectedPath(".git/config"), true);
  assert.equal(protectedPath("src/add.ts"), false);
  assert.deepEqual(testCounts("Tests  3 failed | 2 passed (5)"), { passed: 2, failed: 3, total: 5 });
  assert.deepEqual(testCounts("Tests: 1 failed, 2 passed, 3 total"), { passed: 2, failed: 1, total: 3 });
  assert.deepEqual(testCounts("ℹ pass 2\nℹ fail 1"), { passed: 2, failed: 1, total: 3 });
});
