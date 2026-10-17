import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CreateosSandboxClient, CreateosSandboxNotFoundError, type Sandbox } from "@nodeops-createos/sandbox";

const rules = ["registry.npmjs.org:443"];
const timeoutMs = 10_000;
const idFile = join(process.cwd(), ".sandbox-id");

export async function sharedSandbox(): Promise<{
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
    id = (await readFile(idFile, "utf8")).trim() || undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  let sandbox: Sandbox | undefined;
  if (id) {
    try {
      sandbox = await client.getSandbox(id, { timeoutMs });
    } catch (error) {
      if (!(error instanceof CreateosSandboxNotFoundError)) throw error;
    }
  }
  const reused = sandbox?.status === "running";
  if (!reused) {
    sandbox = await client.createSandbox(
      { shape: "s-1vcpu-1gb", rootfs: "devbox:1", egress: rules },
      { timeoutMs: 30_000 },
    );
    await writeFile(idFile, `${sandbox.id}\n`, { mode: 0o600 });
  }
  if (!sandbox) throw new Error("Sandbox unavailable");
  let egress = (await sandbox.getEgress({ timeoutMs })).egress;
  if (egress.length !== 1 || egress[0] !== rules[0]) {
    egress = (await sandbox.setEgress(rules, { timeoutMs })).egress;
  }
  if (egress.length !== 1 || egress[0] !== rules[0]) {
    throw new Error("Sandbox egress allowlist is unsafe");
  }
  return { sandbox, reused, ms: Date.now() - started, egress };
}

export async function wipeWork(sandbox: Sandbox) {
  const result = await sandbox.runCommand(
    "sh",
    ["-c", "rm -rf /work && mkdir -p /work/src /work/test"],
    { timeoutMs },
  );
  if (result.result.exit_code !== 0) throw new Error("Could not reset sandbox work directory");
}

export async function uploadFiles(sandbox: Sandbox, files: Record<string, string>) {
  for (const [path, content] of Object.entries(files)) {
    await sandbox.files.upload(`/work/${path}`, content, { timeoutMs });
  }
}

export async function runTests(sandbox: Sandbox, testCmd: string) {
  return sandbox.runCommand("sh", ["-c", `cd /work && ${testCmd}`], { timeoutMs: 30_000 });
}
