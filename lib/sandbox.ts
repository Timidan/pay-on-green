import { readFile, writeFile } from "node:fs/promises";
import { join, posix } from "node:path";
import { CreateosSandboxClient, CreateosSandboxNotFoundError, type Sandbox } from "@nodeops-createos/sandbox";

const rules = ["registry.npmjs.org:443"];
const timeoutMs = 10_000;
const idFile = process.env.SANDBOX_ID_FILE || join(process.cwd(), ".sandbox-id");

export async function sharedSandbox(signal?: AbortSignal, replace?: Sandbox): Promise<{
  sandbox: Sandbox;
  reused: boolean;
  ms: number;
  egress: string[];
}> {
  const key = process.env.CREATEOS_PROJECT_API_KEY;
  if (!key) throw new Error("CreateOS key is missing");
  const client = new CreateosSandboxClient({ apiKey: key, timeoutMs });
  const started = Date.now();
  let id: string | undefined;
  try {
    id = (await readFile(/* turbopackIgnore: true */ idFile, "utf8")).trim() || undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  let sandbox: Sandbox | undefined = replace;
  if (id && !replace) {
    try {
      sandbox = await client.getSandbox(id, { timeoutMs, signal });
    } catch (error) {
      if (!(error instanceof CreateosSandboxNotFoundError)) throw error;
    }
  }
  const reused = !replace && sandbox?.status === "running";
  if (!reused) {
    if (sandbox) {
      if (sandbox.status !== "destroyed") {
        try {
          if (sandbox.status !== "destroying") await sandbox.destroy({ timeoutMs, signal });
          await sandbox.waitUntilDestroyed({ timeoutMs: 30_000, signal, request: { timeoutMs } });
        } catch (error) {
          if (!(error instanceof CreateosSandboxNotFoundError)) throw error;
        }
      }
    }
    sandbox = await client.createSandbox(
      { shape: "s-1vcpu-1gb", rootfs: "devbox:1", egress: rules },
      { timeoutMs: 30_000, signal },
    );
    await writeFile(idFile, `${sandbox.id}\n`, { mode: 0o600 });
  }
  if (!sandbox) throw new Error("Sandbox unavailable");
  let egress: string[];
  try {
    egress = (await sandbox.getEgress({ timeoutMs, signal })).egress;
    if (egress.length !== 1 || egress[0] !== rules[0]) {
      egress = (await sandbox.setEgress(rules, { timeoutMs, signal })).egress;
    }
    if (egress.length !== 1 || egress[0] !== rules[0]) {
      throw new Error("Sandbox egress allowlist is unsafe");
    }
  } catch (error) {
    if (replace || signal?.aborted) throw error;
    if (!(error instanceof CreateosSandboxNotFoundError)) {
      try { await sandbox.refresh({ timeoutMs, signal }); }
      catch (refreshError) {
        if (!(refreshError instanceof CreateosSandboxNotFoundError)) throw error;
        return sharedSandbox(signal, sandbox);
      }
      if (sandbox.status === "running") throw error;
    }
    return sharedSandbox(signal, sandbox);
  }
  return { sandbox, reused, ms: Date.now() - started, egress };
}

export async function wipeWork(sandbox: Sandbox, signal?: AbortSignal) {
  const result = await sandbox.runCommand(
    "sh",
    ["-c", "rm -rf /work && mkdir -p /work/src /work/test"],
    { timeoutMs, signal },
  );
  if (result.result.exit_code !== 0) throw new Error("Could not reset sandbox work directory");
}

export async function uploadFiles(sandbox: Sandbox, files: Record<string, string>, signal?: AbortSignal) {
  for (const [path, content] of Object.entries(files)) {
    const parent = posix.dirname(path);
    if (parent !== ".") {
      const created = await sandbox.runCommand("mkdir", ["-p", `/work/${parent}`], { timeoutMs, signal });
      if (created.result.exit_code !== 0) throw new Error(`Could not create directory for ${path}`);
    }
    await sandbox.files.upload(`/work/${path}`, content, { timeoutMs, signal });
  }
}

export async function restoreTests(sandbox: Sandbox, files: Record<string, string>, signal?: AbortSignal) {
  const reset = await sandbox.runCommand(
    "sh", ["-c", "rm -rf /work/test && mkdir -p /work/test"], { timeoutMs, signal },
  );
  if (reset.result.exit_code !== 0) throw new Error("Could not restore test directory");
  await uploadFiles(sandbox, files, signal);
}

export async function runTests(sandbox: Sandbox, testCmd: string, signal?: AbortSignal) {
  return sandbox.runCommand("sh", ["-c", `cd /work && ${testCmd}`], { timeoutMs: 30_000, signal });
}

export function testsPassed(exitCode: number, output: string, expectedTests: number) {
  return exitCode === 0 &&
    Number(output.match(/^ℹ fail (\d+)/m)?.[1]) === 0 &&
    Number(output.match(/^ℹ pass (\d+)/m)?.[1]) === expectedTests;
}
