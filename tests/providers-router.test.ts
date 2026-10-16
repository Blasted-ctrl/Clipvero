import assert from "node:assert/strict";
import { test } from "node:test";

process.env.CLAUDE_BIN = "none";
process.env.CODEX_BIN = "none";
const { availableWriters, writeText } =
  await import("../src/server/text-router");
const { speakScenes, wordsFromAlignment } =
  await import("../src/server/voice-router");

const realFetch = globalThis.fetch;
function withEnv(
  env: Record<string, string | undefined>,
  fn: () => Promise<void>,
) {
  const saved = Object.fromEntries(
    Object.keys(env).map((k) => [k, process.env[k]]),
  );
  Object.assign(process.env, env);
  for (const [k, v] of Object.entries(env))
    if (v === undefined) delete process.env[k];
  return fn().finally(() => {
    for (const [k, v] of Object.entries(saved))
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    globalThis.fetch = realFetch;
  });
}

test("text router tries configured API providers in order and falls through on failure", () =>
  withEnv(
    {
      CLIPVERO_TEXT_PROVIDERS: "anthropic,deepseek,openai",
      ANTHROPIC_API_KEY: "a",
      DEEPSEEK_API_KEY: "d",
      OPENAI_API_KEY: undefined,
    },
    async () => {
      assert.deepEqual(availableWriters(), ["anthropic", "deepseek"]);
      const calls: string[] = [];
      globalThis.fetch = (async (url: string) => {
        calls.push(url);
        if (url.includes("anthropic"))
          return new Response("busy", { status: 529 });
        return Response.json({
          choices: [{ message: { content: '{"ok":true}' } }],
        });
      }) as typeof fetch;
      const result = await writeText("write");
      assert.equal(result.provider, "deepseek");
      assert.equal(result.text, '{"ok":true}');
      assert.ok(calls[0].startsWith("https://api.anthropic.com/v1/messages"));
      assert.ok(
        calls[1].startsWith("https://api.deepseek.com/v1/chat/completions"),
      );
    },
  ));

test("text router reports a clear error when nothing can write", () =>
  withEnv(
    { CLIPVERO_TEXT_PROVIDERS: "openai", OPENAI_API_KEY: undefined },
    async () => {
      await assert.rejects(writeText("x"), /No script writer is available/);
    },
  ));

test("ElevenLabs alignment becomes words and drops audio tags", () => {
  const text = "[excited] Hi there!";
  const chars = [...text];
  const words = wordsFromAlignment({
    characters: chars,
    character_start_times_seconds: chars.map((_, i) => i * 0.1),
    character_end_times_seconds: chars.map((_, i) => i * 0.1 + 0.1),
  });
  assert.deepEqual(
    words.map((w) => w.text),
    ["Hi", "there!"],
  );
  assert.equal(words[0].start, 1);
});

test("voice router prefers ElevenLabs and keeps one provider for the whole video", () =>
  withEnv(
    {
      CLIPVERO_VOICE_PROVIDERS: "elevenlabs,openai,local",
      ELEVENLABS_API_KEY: "e",
      OPENAI_API_KEY: "o",
    },
    async () => {
      const urls: string[] = [];
      globalThis.fetch = (async (url: string) => {
        urls.push(url);
        const chars = [..."Hello world."];
        return Response.json({
          audio_base64: Buffer.from("mp3").toString("base64"),
          alignment: {
            characters: chars,
            character_start_times_seconds: chars.map((_, i) => i * 0.05),
            character_end_times_seconds: chars.map((_, i) => i * 0.05 + 0.05),
          },
        });
      }) as typeof fetch;
      const spoken = await speakScenes(
        ["Hello world.", "Hello world."],
        "free-cute",
      );
      assert.equal(spoken.length, 2);
      assert.ok(spoken.every((s) => s.provider === "elevenlabs:eleven_v3"));
      assert.deepEqual(
        spoken[0].words.map((w) => w.text),
        ["Hello", "world."],
      );
      assert.ok(urls.every((u) => u.includes("/with-timestamps")));
    },
  ));

test("voice router falls back to OpenAI with word timings when ElevenLabs fails", () =>
  withEnv(
    {
      CLIPVERO_VOICE_PROVIDERS: "elevenlabs,openai",
      ELEVENLABS_API_KEY: "e",
      OPENAI_API_KEY: "o",
    },
    async () => {
      globalThis.fetch = (async (url: string) => {
        if (url.includes("elevenlabs"))
          return new Response("quota", { status: 401 });
        if (url.endsWith("/audio/speech"))
          return new Response(new Uint8Array([1, 2, 3]));
        return Response.json({
          duration: 1.2,
          words: [
            { word: "Hello", start: 0, end: 0.4 },
            { word: "world", start: 0.5, end: 1 },
          ],
        });
      }) as typeof fetch;
      const [spoken] = await speakScenes(["Hello world."], "free-cute");
      assert.equal(spoken.provider, "openai");
      assert.deepEqual(
        spoken.words.map((w) => w.text),
        ["Hello", "world."],
      );
    },
  ));

test("NVIDIA NIM rotates through several comma-separated keys and skips a rate-limited one", () =>
  withEnv(
    {
      CLIPVERO_TEXT_PROVIDERS: "nvidia",
      NVIDIA_API_KEYS: "nvapi-first, nvapi-second",
      NVIDIA_API_KEY: undefined,
      NVIDIA_MODEL: undefined,
    },
    async () => {
      assert.deepEqual(availableWriters(), ["nvidia"]);
      const used: {
        url: string;
        auth: string;
        body: { model: string; max_tokens: number };
      }[] = [];
      globalThis.fetch = (async (url: string, init: RequestInit) => {
        const auth = String(
          (init.headers as Record<string, string>).Authorization,
        );
        used.push({ url, auth, body: JSON.parse(String(init.body)) });
        return auth.endsWith("nvapi-first")
          ? new Response("slow down", { status: 429 })
          : Response.json({
              choices: [{ message: { content: '{"ok":true}' } }],
            });
      }) as typeof fetch;
      const result = await writeText("write");
      assert.equal(result.provider, "nvidia");
      assert.equal(
        used[0].url,
        "https://integrate.api.nvidia.com/v1/chat/completions",
      );
      assert.equal(used[0].body.model, "deepseek-ai/deepseek-v4.1-flash");
      assert.equal(used[0].body.max_tokens, 8192);
      assert.ok(
        used.some((call) => call.auth.endsWith("nvapi-second")),
        "the second key is used",
      );
      // The next call starts from the other key, so load is shared.
      used.length = 0;
      await writeText("write again");
      assert.ok(used[0].auth.endsWith("nvapi-second"));
    },
  ));

test("a bad request is not retried against every key", () =>
  withEnv(
    { CLIPVERO_TEXT_PROVIDERS: "nvidia", NVIDIA_API_KEYS: "nvapi-a,nvapi-b" },
    async () => {
      let calls = 0;
      globalThis.fetch = (async () => {
        calls++;
        return new Response("bad request", { status: 400 });
      }) as typeof fetch;
      await assert.rejects(writeText("x"), /HTTP 400/);
      assert.equal(calls, 1);
    },
  ));
