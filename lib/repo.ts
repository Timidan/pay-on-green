import { posix } from "node:path";
import type { Sandbox } from "@nodeops-createos/sandbox";

export const lockedEgress = ["registry.npmjs.org:443"];
const cloneEgress = ["github.com:443", "codeload.github.com:443", "objects.githubusercontent.com:443", ...lockedEgress];

export function githubRepoUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  const match = /^https:\/\/github\.com\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/.exec(value);
  return match && match[0] === value && ![match[1], match[2]].some((part) => part === "." || part === "..")
    ? `https://github.com/${match[1]}/${match[2]}.git` : undefined;
}

export function safeTestPath(value: unknown) {
  return typeof value === "string" && value.length <= 300 &&
    !posix.isAbsolute(value) && !value.startsWith("-") && !value.split("/").includes("..") &&
    /^[A-Za-z0-9_./-]+$/.test(value) && value !== "." ? value : undefined;
}

export function protectedPath(path: string) {
  const parts = path.toLowerCase().split("/");
  const name = parts.at(-1) || "";
  return parts.some((part) => ["test", "tests", "__tests__", "node_modules", ".git"].includes(part)) ||
    /\.(?:test|spec)\.[^/]+$/.test(name) ||
    ["package.json", "package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb"].includes(name) ||
    /^(?:vitest|jest|babel|vite)(?:\.|-)/.test(name) || /^\.babelrc(?:\.|$)/.test(name) ||
    /^tsconfig(?:\.|-)/.test(name);
}

export function testCounts(output: string): { passed: number; failed: number; total: number } | undefined {
  const clean = output.replace(/\x1b\[[0-9;]*m/g, "");
  const line = clean.split("\n").find((item) => /^\s*Tests\s*[: ]/.test(item));
  if (line) {
    const failed = Number(line.match(/(\d+)\s+failed/)?.[1] ?? 0);
    const passed = Number(line.match(/(\d+)\s+passed/)?.[1] ?? 0);
    const total = Number(line.match(/\((\d+)\)/)?.[1] ?? line.match(/(\d+)\s+total/)?.[1] ?? failed + passed);
    if (total > 0) return { passed, failed, total };
  }
  const passed = clean.match(/^ℹ pass (\d+)/m)?.[1];
  const failed = clean.match(/^ℹ fail (\d+)/m)?.[1];
  if (passed !== undefined && failed !== undefined) return { passed: Number(passed), failed: Number(failed), total: Number(passed) + Number(failed) };
}

async function command(sandbox: Sandbox, program: string, args: string[], timeoutMs: number, signal?: AbortSignal) {
  const result = await sandbox.runCommand(program, args, { timeoutMs, signal });
  if (result.result.error || result.result.exit_code !== 0) {
    throw new Error(`${program} failed: ${(result.result.stderr || result.result.stdout || result.result.error || "unknown error").slice(-500)}`);
  }
  return result.result.stdout;
}

export async function setRepoEgress(sandbox: Sandbox, open: boolean, signal?: AbortSignal) {
  const rules = open ? cloneEgress : lockedEgress;
  const actual = (await sandbox.setEgress(rules, { timeoutMs: 10_000, signal })).egress;
  if (actual.length !== rules.length || rules.some((rule) => !actual.includes(rule))) throw new Error("Sandbox egress allowlist was not applied");
  return actual;
}

export async function cloneRepo(sandbox: Sandbox, url: string, signal?: AbortSignal) {
  await command(sandbox, "git", ["clone", "--depth", "1", "--", url, "/work/repo"], 60_000, signal);
  const size = Number((await command(sandbox, "du", ["-sm", "/work/repo"], 10_000, signal)).split(/\s/)[0]);
  if (!Number.isFinite(size) || size > 200) throw new Error("Repository exceeds the 200 MB limit");
  const commit = (await command(sandbox, "git", ["-C", "/work/repo", "rev-parse", "HEAD"], 10_000, signal)).trim();
  const paths = (await command(sandbox, "git", ["-C", "/work/repo", "ls-files", "-z"], 10_000, signal)).split("\0").filter(Boolean);
  return { commit, paths };
}

export async function repoRunner(sandbox: Sandbox, paths: string[], testPath?: string, signal?: AbortSignal) {
  let pkg: { scripts?: { test?: string }; dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};
  if (paths.includes("package.json")) {
    const content = await sandbox.files.download("/work/repo/package.json", { timeoutMs: 10_000, signal });
    pkg = JSON.parse(new TextDecoder().decode(content));
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const script = pkg.scripts?.test || "";
  const runner: "node" | "jest" | "vitest" | "npm" = deps.vitest || /\bvitest\b/.test(script) ? "vitest"
    : deps.jest || /\bjest\b/.test(script) ? "jest"
    : /node\s+--test\b/.test(script) || paths.some((path) => /\.(?:test|spec)\.[cm]?js$/.test(path)) ? "node" : "npm";
  const args = runner === "vitest" ? ["npx", "vitest", "run"]
    : runner === "jest" ? ["npx", "jest", "--ci"]
    : runner === "node" ? ["node", "--test"] : ["npm", "test", "--"];
  if (testPath) args.push(testPath);
  return { runner, testCmd: args.map((arg) => /^[A-Za-z0-9_./-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`).join(" ") };
}

export async function installRepo(sandbox: Sandbox, paths: string[], signal?: AbortSignal) {
  const cmd = paths.includes("package-lock.json") || paths.includes("npm-shrinkwrap.json")
    ? ["ci"] : ["install", "--no-audit", "--no-fund"];
  await command(sandbox, "sh", ["-c", `cd /work/repo && npm ${cmd.join(" ")}`], 180_000, signal);
}

async function changedPaths(sandbox: Sandbox, signal?: AbortSignal) {
  const tracked = await command(sandbox, "git", ["-C", "/work/repo", "diff", "--name-only", "-z", "HEAD"], 10_000, signal);
  const untracked = await command(sandbox, "git", ["-C", "/work/repo", "ls-files", "--others", "--exclude-standard", "-z"], 10_000, signal);
  return [...new Set(`${tracked}${untracked}`.split("\0").filter(Boolean))];
}

export async function restoreProtected(sandbox: Sandbox, signal?: AbortSignal) {
  const paths = await changedPaths(sandbox, signal);
  const protectedFiles = paths.filter(protectedPath);
  const tracked = (await command(sandbox, "git", ["-C", "/work/repo", "ls-files", "-z"], 10_000, signal)).split("\0");
  const restore = protectedFiles.filter((path) => tracked.includes(path));
  const remove = protectedFiles.filter((path) => !tracked.includes(path));
  if (restore.length) await command(sandbox, "git", ["-C", "/work/repo", "restore", "--source=HEAD", "--worktree", "--", ...restore], 10_000, signal);
  if (remove.length) await command(sandbox, "rm", ["-rf", "--", ...remove.map((path) => `/work/repo/${path}`)], 10_000, signal);
}

export async function writeRepoFile(sandbox: Sandbox, path: string, content: string, signal?: AbortSignal) {
  const real = (await command(sandbox, "realpath", ["-m", `/work/repo/${path}`], 10_000, signal)).trim();
  if (real !== `/work/repo/${path}`) throw new Error("Patch path follows a symlink");
  await command(sandbox, "mkdir", ["-p", posix.dirname(`/work/repo/${path}`)], 10_000, signal);
  await sandbox.files.upload(`/work/repo/${path}`, content, { timeoutMs: 10_000, signal });
}

export async function runRepoTests(sandbox: Sandbox, testCmd: string, signal?: AbortSignal) {
  return sandbox.runCommand("sh", ["-c", `cd /work/repo && ${testCmd}`], { timeoutMs: 120_000, signal });
}

export async function repoContext(sandbox: Sandbox, paths: string[], output: string, signal?: AbortSignal) {
  const tree = paths.slice(0, 300);
  const tests = paths.filter((path) => protectedPath(path) && /(?:^|\/)(?:test|tests|__tests__)\/|\.(?:test|spec)\./.test(path));
  const failing = tests.filter((path) => output.includes(path) || output.includes(posix.basename(path)));
  const chosen = (failing.length ? failing : tests).slice(0, 8);
  const included = new Set(chosen);
  const files: Record<string, string> = {};
  for (const path of chosen) {
    const source = new TextDecoder().decode(await sandbox.files.download(`/work/repo/${path}`, { timeoutMs: 10_000, signal }));
    files[path] = source.slice(0, 12_000);
    for (const match of source.matchAll(/(?:from\s*|require\(\s*|import\(\s*)['"](\.[^'"]+)['"]/g)) {
      const base = posix.normalize(posix.join(posix.dirname(path), match[1]));
      const imported = [base, `${base}.js`, `${base}.ts`, `${base}.tsx`, `${base}/index.js`, `${base}/index.ts`].find((candidate) => paths.includes(candidate));
      if (imported) included.add(imported);
    }
  }
  for (const path of included) {
    if (!(path in files)) files[path] = new TextDecoder().decode(await sandbox.files.download(`/work/repo/${path}`, { timeoutMs: 10_000, signal })).slice(0, 12_000);
  }
  const failingOutput = new TextDecoder().decode(new TextEncoder().encode(output).slice(-12_000));
  const prefix = `Fix the failing source code. Return full-file JSON with files [{path,content}] and note. Do not edit tests, package files, lockfiles, configs, or node_modules.\nTracked files (first 300): ${JSON.stringify(tree)}\nFailing output:\n${failingOutput}\nRelevant files:\n`;
  let prompt = prefix;
  for (const [path, content] of Object.entries(files)) {
    const item = `${path}:\n${content}\n`;
    if (Buffer.byteLength(prompt + item) > 60_000) break;
    prompt += item;
  }
  return new TextDecoder().decode(new TextEncoder().encode(prompt).slice(0, 60_000));
}

export async function repoPatch(sandbox: Sandbox, written: string[], signal?: AbortSignal) {
  const files = [...new Set([...(await changedPaths(sandbox, signal)), ...written])].filter((path) => !protectedPath(path));
  const tracked = (await command(sandbox, "git", ["-C", "/work/repo", "ls-files", "-z"], 10_000, signal)).split("\0");
  const added = files.filter((path) => !tracked.includes(path));
  if (added.length) await command(sandbox, "git", ["-C", "/work/repo", "add", "-N", "-f", "--", ...added], 10_000, signal);
  const diff = files.length ? await command(sandbox, "git", ["-C", "/work/repo", "diff", "--no-ext-diff", "--no-textconv", "--binary", "HEAD", "--", ...files], 10_000, signal) : "";
  return { diff, files };
}
