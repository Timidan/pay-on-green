import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";

type Patch = { files: { path: string; content: string }[]; note: string };
export type Completion = Patch & { model: string; tokens?: number };

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["files", "note"],
  properties: {
    files: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "content"],
        properties: { path: { type: "string" }, content: { type: "string" } },
      },
    },
    note: { type: "string" },
  },
};

function parsePatch(value: unknown): Patch {
  if (!value || typeof value !== "object" || !("files" in value) || !("note" in value) ||
      !Array.isArray(value.files) || typeof value.note !== "string" ||
      !value.files.every((file: unknown) => file && typeof file === "object" &&
        "path" in file && typeof file.path === "string" &&
        "content" in file && typeof file.content === "string")) {
    throw new Error("Model returned invalid patch JSON");
  }
  return value as Patch;
}

export function patchPath(raw: string) {
  const path = posix.normalize(raw.replaceAll("\\", "/"));
  const relative = posix.relative("/work", posix.resolve("/work", path));
  if (relative.toLowerCase() === "test" || relative.toLowerCase().startsWith("test/")) {
    return { rejected: "touched a test file", path: relative };
  }
  if (posix.isAbsolute(path) || relative === ".." || relative.startsWith("../") ||
      !relative || path.includes("\0")) {
    return { rejected: "invalid patch path", path };
  }
  return { path: relative };
}

async function codex(prompt: string, signal?: AbortSignal): Promise<Completion> {
  const dir = await mkdtemp(join(tmpdir(), "pay-on-green-"));
  try {
    const codexHome = join(dir, "codex-home");
    await mkdir(codexHome);
    await copyFile(join(process.env.CODEX_HOME || join(process.env.HOME || "", ".codex"), "auth.json"),
      join(codexHome, "auth.json"));
    await writeFile(join(dir, "schema.json"), JSON.stringify(schema));
    await new Promise<void>((resolve, reject) => {
      const child = execFile(
        "codex",
        ["exec", "-m", "gpt-6-sol", "-c", "model_reasoning_effort=low", "-s", "read-only",
          "--skip-git-repo-check", "--output-schema", "schema.json", "-o", "out.json", "-"],
        {
          cwd: dir,
          timeout: 25_000,
          signal,
          maxBuffer: 1_000_000,
          env: {
            PATH: process.env.PATH,
            NODE_ENV: process.env.NODE_ENV,
            HOME: dir,
            CODEX_HOME: codexHome,
            XDG_CONFIG_HOME: dir,
            TMPDIR: process.env.TMPDIR,
            LANG: process.env.LANG,
          },
        },
        (error, _stdout, stderr) => error
          ? reject(new Error(stderr.trim() || error.message))
          : resolve(),
      );
      child.stdin?.on("error", () => {});
      child.stdin?.end(prompt);
    });
    return { ...parsePatch(JSON.parse(await readFile(join(dir, "out.json"), "utf8"))), model: "gpt-6-sol" };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function openrouter(prompt: string, signal?: AbortSignal): Promise<Completion> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OpenRouter key is missing");
  let lastError = "OpenRouter models were unavailable";
  for (const model of ["nvidia/nemotron-3-super-120b-a12b:free", "cohere/north-mini-code:free",
    "xingchen-agi/xing4.0-29b-a4b:free", "openrouter/free"]) {
    if (signal?.aborted) throw new Error("Job timed out");
    const timeout = AbortSignal.timeout(25_000);
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "Return only JSON matching the requested files and note schema." },
            { role: "user", content: prompt },
          ],
          ...(model === "nvidia/nemotron-3-super-120b-a12b:free"
            ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (response.status === 429 || response.status >= 500) {
        lastError = `${model} returned HTTP ${response.status}`;
        continue;
      }
      if (!response.ok) throw new Error(`${model} returned HTTP ${response.status}`);
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error(`${model} returned no text`);
      const json = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const patch = parsePatch(JSON.parse(json));
      const tokens = data?.usage?.total_tokens;
      return { ...patch, model, ...(typeof tokens === "number" ? { tokens } : {}) };
    } catch (error) {
      if (!timeout.aborted || signal?.aborted) throw error;
      lastError = `${model} timed out`;
      continue;
    }
  }
  throw new Error(lastError);
}

export function complete(prompt: string, signal?: AbortSignal): Promise<Completion> {
  if (process.env.MODEL_BACKEND === "codex") return codex(prompt, signal);
  if (process.env.MODEL_BACKEND === "openrouter") return openrouter(prompt, signal);
  throw new Error("MODEL_BACKEND must be codex or openrouter");
}
