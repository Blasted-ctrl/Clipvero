import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { resolve } from "node:path";

/**
 * Writes text with the best available model: API providers first (in
 * CLIPVERO_TEXT_PROVIDERS order), then local agent CLIs as the free fallback.
 */
type ApiProvider = {
  id: string;
  keys: string[];
  model: string;
  modelEnv: string;
  base: string;
  kind: "openai" | "anthropic";
};

const apiProviders: ApiProvider[] = [
  {
    id: "anthropic",
    keys: ["ANTHROPIC_API_KEY", "CLAUDE_API_KEY"],
    modelEnv: "ANTHROPIC_MODEL",
    model: "claude-sonnet-5-5",
    base: "https://api.anthropic.com/v1",
    kind: "anthropic",
  },
  {
    id: "openai",
    keys: ["OPENAI_API_KEY"],
    modelEnv: "OPENAI_TEXT_MODEL",
    model: "gpt-4.1-mini",
    base: "https://api.openai.com/v1",
    kind: "openai",
  },
  {
    id: "gemini",
    keys: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    modelEnv: "GEMINI_MODEL",
    model: "gemini-2.5-flash",
    base: "https://generativelanguage.googleapis.com/v1beta/openai",
    kind: "openai",
  },
  {
    id: "deepseek",
    keys: ["DEEPSEEK_API_KEY"],
    modelEnv: "DEEPSEEK_MODEL",
    model: "deepseek-chat",
    base: "https://api.deepseek.com/v1",
    kind: "openai",
  },
  {
    id: "kimi",
    keys: ["MOONSHOT_API_KEY", "KIMI_API_KEY"],
    modelEnv: "KIMI_MODEL",
    model: "kimi-k2-turbo-preview",
    base: "https://api.moonshot.ai/v1",
    kind: "openai",
  },
  {
    id: "qwen",
    keys: ["DASHSCOPE_API_KEY", "QWEN_API_KEY"],
    modelEnv: "QWEN_MODEL",
    model: "qwen-plus",
    base: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    kind: "openai",
  },
];
const defaultOrder =
  "anthropic,openai,gemini,deepseek,kimi,qwen,claude-code,codex";

const keyFor = (provider: ApiProvider) =>
  provider.keys.map((name) => process.env[name]?.trim()).find(Boolean);

/** Claude Code CLI on this machine; CLAUDE_BIN=none disables it. */
export function claudeCodePath() {
  if (process.env.CLAUDE_BIN === "none") return null;
  return (
    [
      process.env.CLAUDE_BIN,
      resolve(homedir(), ".local/bin/claude.exe"),
      resolve(homedir(), ".local/bin/claude"),
    ]
      .filter((p): p is string => Boolean(p))
      .find((p) => existsSync(p)) ?? null
  );
}

/** Codex CLI (standalone or the VS Code extension's binary); CODEX_BIN=none disables it. */
export function codexPath() {
  if (process.env.CODEX_BIN === "none") return null;
  if (process.env.CODEX_BIN)
    return existsSync(process.env.CODEX_BIN) ? process.env.CODEX_BIN : null;
  const extensions = resolve(homedir(), ".vscode/extensions");
  try {
    const latest = readdirSync(extensions)
      .filter((name) => name.startsWith("openai.chatgpt-"))
      .sort()
      .reverse()
      .map((name) => resolve(extensions, name, "bin/windows-x86_64/codex.exe"))
      .find((p) => existsSync(p));
    if (latest) return latest;
  } catch {
    // No VS Code extensions folder.
  }
  return null;
}

function order() {
  return (process.env.CLIPVERO_TEXT_PROVIDERS || defaultOrder)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/** Provider ids that can run right now, in the order they will be tried. */
export function availableWriters() {
  return order().filter((id) => {
    const api = apiProviders.find((p) => p.id === id);
    if (api) return Boolean(keyFor(api));
    if (id === "claude-code") return Boolean(claudeCodePath());
    if (id === "codex") return Boolean(codexPath());
    return false;
  });
}

async function callApi(provider: ApiProvider, key: string, prompt: string) {
  const model = process.env[provider.modelEnv]?.trim() || provider.model;
  const response = await fetch(
    provider.kind === "anthropic"
      ? `${provider.base}/messages`
      : `${provider.base}/chat/completions`,
    {
      method: "POST",
      headers:
        provider.kind === "anthropic"
          ? {
              "x-api-key": key,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            }
          : {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
      body: JSON.stringify(
        provider.kind === "anthropic"
          ? {
              model,
              max_tokens: 8000,
              messages: [{ role: "user", content: prompt }],
            }
          : { model, messages: [{ role: "user", content: prompt }] },
      ),
      signal: AbortSignal.timeout(180000),
    },
  );
  if (!response.ok)
    throw new Error(`${provider.id} returned HTTP ${response.status}`);
  const data = (await response.json()) as {
    content?: { type: string; text?: string }[];
    choices?: { message?: { content?: string } }[];
  };
  const text =
    provider.kind === "anthropic"
      ? data.content
          ?.filter((c) => c.type === "text")
          .map((c) => c.text)
          .join("")
      : data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${provider.id} returned no text`);
  return text;
}

function runCli(bin: string, args: string[], prompt: string, label: string) {
  return new Promise<string>((resolveResult, reject) => {
    // Runs from a temp folder, so the agent cannot edit this project.
    const child = spawn(bin, args, {
      cwd: tmpdir(),
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 300000,
    });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolveResult(stdout)
        : reject(
            new Error(
              `${label} failed: ${stderr.trim().slice(-300) || `exit ${code}`}`,
            ),
          ),
    );
    child.stdin.end(prompt);
  });
}

async function callCodex(bin: string, prompt: string) {
  const out = resolve(tmpdir(), `clipvero-codex-${crypto.randomUUID()}.txt`);
  try {
    await runCli(
      bin,
      [
        "exec",
        "--skip-git-repo-check",
        "--sandbox",
        "read-only",
        "--output-last-message",
        out,
        "-",
      ],
      prompt,
      "Codex",
    );
    return await readFile(out, "utf8");
  } finally {
    await unlink(out).catch(() => {});
  }
}

/** Tries each available writer in order and returns the first answer. */
export async function writeText(prompt: string) {
  const errors: string[] = [];
  for (const id of availableWriters()) {
    try {
      const api = apiProviders.find((p) => p.id === id);
      const text = api
        ? await callApi(api, keyFor(api)!, prompt)
        : id === "claude-code"
          ? await runCli(
              claudeCodePath()!,
              ["-p", "--output-format", "text"],
              prompt,
              "Claude Code",
            )
          : await callCodex(codexPath()!, prompt);
      return { text, provider: id };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `${id} failed`);
    }
  }
  throw new Error(
    errors.length
      ? `Every script writer failed: ${errors.join("; ")}`
      : "No script writer is available. Add an AI API key to .env or install Claude Code or Codex.",
  );
}
