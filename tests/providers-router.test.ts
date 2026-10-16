import assert from "node:assert/strict";
import { test } from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.CLAUDE_BIN = "none";
process.env.CODEX_BIN = "none";
const { availableWriters, writeText } =
  await import("../src/server/text-router");
const { sentenceChunks, speakScenes, wordsFromAlignment } =
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

test("OpenRouter only uses free models unless paid use is explicitly allowed", () =>
  withEnv(
    {
      CLIPVERO_TEXT_PROVIDERS: "openrouter",
      OPEN_ROUTER_KEYS: "sk-or-test",
      OPEN_ROUTER_ALLOW_PAID: undefined,
      OPEN_ROUTER_MODEL: "openai/gpt-5",
    },
    async () => {
      let calls = 0;
      globalThis.fetch = (async () => {
        calls++;
        return Response.json({ choices: [{ message: { content: "{}" } }] });
      }) as typeof fetch;
      await assert.rejects(writeText("x"), /not a free model/);
      assert.equal(
        calls,
        0,
        "a paid model is refused before any request is sent",
      );
      process.env.OPEN_ROUTER_MODEL = "nvidia/nemotron-3.5-super-vl:free";
      const result = await writeText("x");
      assert.equal(result.provider, "openrouter");
      assert.equal(calls, 1);
      process.env.OPEN_ROUTER_MODEL = "openai/gpt-5";
      process.env.OPEN_ROUTER_ALLOW_PAID = "true";
      assert.equal((await writeText("x")).provider, "openrouter");
    },
  ));

test("a script that breaks a size limit is sent back with the exact problem and corrected", () =>
  withEnv(
    { CLIPVERO_TEXT_PROVIDERS: "groq", GROQ_API_KEYS: "gsk-test" },
    async () => {
      const { localScript } = await import("../src/server/local-writer");
      const { createSchema } = await import("../src/lib/model");
      const tooLong = Array.from({ length: 11 }, (_, i) => `line ${i}`);
      const reply = (code: string[] | null) =>
        JSON.stringify({
          title: "Binary search",
          description: "A short caption #code",
          topic: "BINARY SEARCH",
          scenes: [
            {
              text: "A sorted list lets you skip half the work.",
              chapter: "Idea",
              visual: { type: "title", text: "BINARY SEARCH" },
              code: code ? { lines: code, highlight: 0 } : null,
            },
            {
              text: "Check the middle, then discard half.",
              chapter: "Idea",
              visual: { type: "title", text: "BINARY SEARCH" },
            },
          ],
        });
      const prompts: string[] = [];
      let call = 0;
      globalThis.fetch = (async (_url: string, init: RequestInit) => {
        prompts.push(JSON.parse(String(init.body)).messages[0].content);
        return Response.json({
          choices: [
            { message: { content: reply(call++ === 0 ? tooLong : ["x = 1"]) } },
          ],
        });
      }) as typeof fetch;
      const input = createSchema.parse({
        title: "Binary search",
        mode: "explainer",
        content: "Binary search",
        duration: 30,
        voice: "free-cute",
        style: "explainer",
        rightsConfirmed: true,
      });
      const result = await localScript(input, "");
      assert.equal(call, 2, "one corrected retry");
      assert.match(prompts[1], /could not be used/);
      assert.match(prompts[1], /lines/);
      assert.equal(result.scenes.length, 2);
    },
  ));

test("Gemini voices are encoded to MP3 and get word timings from Whisper on Groq", () =>
  withEnv(
    {
      CLIPVERO_VOICE_PROVIDERS: "gemini",
      GEMINI_API_KEY: "g-test",
      GOOGLE_API_KEY: undefined,
      GROQ_API_KEYS: "gsk-test",
      ELEVENLABS_API_KEY: undefined,
      OPENAI_API_KEY: undefined,
      VOICE_RETRY_MS: "1",
    },
    async () => {
      const seen: string[] = [];
      globalThis.fetch = (async (url: string, init: RequestInit) => {
        seen.push(url);
        if (url.includes("generativelanguage")) {
          const body = JSON.parse(String(init.body));
          assert.match(
            body.contents[0].parts[0].text,
            /^Say this .*: Hello world\.$/,
          );
          assert.equal(
            body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig
              .voiceName,
            "Leda",
          );
          const pcm = Buffer.alloc(24000 * 2); // one second of silence
          return Response.json({
            candidates: [
              {
                content: {
                  parts: [{ inlineData: { data: pcm.toString("base64") } }],
                },
              },
            ],
          });
        }
        return Response.json({
          duration: 1,
          words: [
            { word: "Hello", start: 0.1, end: 0.4 },
            { word: "world", start: 0.5, end: 0.9 },
          ],
        });
      }) as typeof fetch;
      const [spoken] = await speakScenes(["Hello world."], "free-cute");
      assert.equal(spoken.provider, "gemini:Leda");
      assert.deepEqual(
        spoken.words.map((w) => w.text),
        ["Hello", "world."],
      );
      assert.equal(spoken.duration, 1);
      assert.ok(spoken.audio.length > 500, "real MP3 data");
      assert.ok(
        seen.some((u) =>
          u.includes("api.groq.com/openai/v1/audio/transcriptions"),
        ),
      );
    },
  ));

test("a rate-limited Gemini voice falls through to the next provider instead of failing the video", () =>
  withEnv(
    {
      CLIPVERO_VOICE_PROVIDERS: "gemini,openai",
      GEMINI_API_KEY: "g-test",
      GROQ_API_KEYS: "gsk-test",
      OPENAI_API_KEY: "o-test",
      ELEVENLABS_API_KEY: undefined,
      VOICE_RETRY_MS: "1",
    },
    async () => {
      let geminiCalls = 0;
      globalThis.fetch = (async (url: string) => {
        if (url.includes("generativelanguage")) {
          geminiCalls++;
          return new Response("quota", { status: 429 });
        }
        if (url.endsWith("/audio/speech"))
          return new Response(new Uint8Array([1, 2, 3]));
        return Response.json({
          duration: 1,
          words: [{ word: "Hi", start: 0, end: 0.5 }],
        });
      }) as typeof fetch;
      const [spoken] = await speakScenes(["Hi."], "free-warm");
      assert.equal(geminiCalls, 3, "three attempts with backoff");
      assert.equal(spoken.provider, "openai");
    },
  ));

function wav(seconds: number, rate = 24000) {
  const samples = Math.round(seconds * rate);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + samples * 2, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(samples * 2, 40);
  return Buffer.concat([header, Buffer.alloc(samples * 2)]);
}
async function duration(audio: Buffer) {
  const { writeFileSync, rmSync } = await import("node:fs");
  const { probe } = await import("../src/server/media");
  const path = join(tmpdir(), `clipvero-test-${crypto.randomUUID()}.mp3`);
  writeFileSync(path, audio);
  try {
    return Number((await probe(path)).format.duration);
  } finally {
    rmSync(path, { force: true });
  }
}

test("sentences are split into pieces that fit Orpheus's input size", () => {
  const sentence =
    "Binary search halves the list at every step so it stays fast. ";
  const text = sentence.repeat(12).trim();
  const chunks = sentenceChunks(text, 380);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => c.length <= 380));
  assert.equal(
    chunks.join(" ").replace(/\s+/g, " "),
    text.replace(/\s+/g, " "),
  );
  assert.deepEqual(sentenceChunks("One short line."), ["One short line."]);
});

test("generated voices are sped up so sentences don't drag, and VOICE_TEMPO can override it", () =>
  withEnv(
    {
      CLIPVERO_VOICE_PROVIDERS: "gemini",
      GEMINI_API_KEY: "g",
      GROQ_API_KEYS: "gsk",
      ELEVENLABS_API_KEY: undefined,
      OPENAI_API_KEY: undefined,
      VOICE_TEMPO: undefined,
    },
    async () => {
      globalThis.fetch = (async (url: string) =>
        url.includes("generativelanguage")
          ? Response.json({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        inlineData: {
                          data: Buffer.alloc(24000 * 2 * 2).toString("base64"),
                        },
                      },
                    ],
                  },
                },
              ],
            })
          : Response.json({
              duration: 1,
              words: [{ word: "Hi", start: 0, end: 0.5 }],
            })) as typeof fetch;
      const normal = await duration(
        (await speakScenes(["Hi."], "free-cute"))[0].audio,
      );
      assert.ok(
        normal > 1.6 && normal < 1.85,
        `2s of audio at 1.15x is about 1.74s, got ${normal}`,
      );
      process.env.VOICE_TEMPO = "1";
      const same = await duration(
        (await speakScenes(["Hi."], "free-cute"))[0].audio,
      );
      assert.ok(same > 1.95, `unchanged speed stays near 2s, got ${same}`);
    },
  ));

test("Orpheus on Groq voices each sentence group, joins them, speeds them up and gets word timings", () =>
  withEnv(
    {
      CLIPVERO_VOICE_PROVIDERS: "groq",
      GROQ_API_KEYS: "gsk-test",
      GROQ_VOICE_BOLD: undefined,
      VOICE_TEMPO: undefined,
      ELEVENLABS_API_KEY: undefined,
      OPENAI_API_KEY: undefined,
      GEMINI_API_KEY: undefined,
      GOOGLE_API_KEY: undefined,
    },
    async () => {
      const speech: { voice: string; input: string }[] = [];
      globalThis.fetch = (async (url: string, init: RequestInit) => {
        if (url.endsWith("/audio/speech")) {
          speech.push(JSON.parse(String(init.body)));
          return new Response(new Uint8Array(wav(1)));
        }
        return Response.json({
          duration: 1.7,
          words: [
            { word: "Long", start: 0.1, end: 0.5 },
            { word: "text", start: 0.6, end: 1 },
          ],
        });
      }) as typeof fetch;
      const sentence =
        "This sentence is padded out so that two of them cannot fit in one request. "
          .repeat(3)
          .trim();
      const [spoken] = await speakScenes(
        [`${sentence} ${sentence}`.slice(0, 700)],
        "free-bold",
      );
      assert.equal(spoken.provider, "groq:diana");
      assert.ok(speech.length >= 2, "long text goes out in several requests");
      assert.ok(
        speech.every((s) => s.voice === "diana" && s.input.length <= 380),
      );
      const joined = await duration(spoken.audio);
      assert.ok(
        joined > 1.6 && joined < 1.9,
        `two 1s pieces at 1.12x is about 1.8s, got ${joined}`,
      );
      assert.deepEqual(
        spoken.words.map((w) => w.text),
        ["Long", "text"],
      );
    },
  ));

test("ElevenLabs audio is sped up and its word timings scale with it; bad audio is kept as is", () =>
  withEnv(
    {
      CLIPVERO_VOICE_PROVIDERS: "elevenlabs",
      ELEVENLABS_API_KEY: "e",
      VOICE_TEMPO: undefined,
      ELEVENLABS_MODEL: undefined,
    },
    async () => {
      const { writeFileSync, readFileSync, rmSync } = await import("node:fs");
      const { binary, execute } = await import("../src/server/media");
      const source = join(tmpdir(), `clipvero-test-${crypto.randomUUID()}.wav`);
      const encoded = source.replace(/\.wav$/, ".mp3");
      writeFileSync(source, wav(2));
      await execute(binary("ffmpeg"), [
        "-v",
        "error",
        "-y",
        "-i",
        source,
        encoded,
      ]);
      const real = readFileSync(encoded);
      rmSync(source, { force: true });
      rmSync(encoded, { force: true });
      const reply = (audio: Buffer) => {
        const chars = [..."Hello world."];
        return Response.json({
          audio_base64: audio.toString("base64"),
          alignment: {
            characters: chars,
            character_start_times_seconds: chars.map((_, i) => i * 0.1),
            character_end_times_seconds: chars.map((_, i) => i * 0.1 + 0.1),
          },
        });
      };
      globalThis.fetch = (async () => reply(real)) as typeof fetch;
      const [fast] = await speakScenes(["Hello world."], "free-cute");
      assert.ok(
        (await duration(fast.audio)) < 1.95,
        "2s of speech at 1.1x is about 1.8s",
      );
      assert.ok(
        Math.abs(fast.duration - 1.2 / 1.1) < 0.01,
        "the reported length scales with the audio",
      );
      assert.ok(
        Math.abs(fast.words[1].start - 0.6 / 1.1) < 0.01,
        "word timings scale too",
      );
      // Audio that cannot be re-encoded is kept untouched, with unscaled timings.
      globalThis.fetch = (async () =>
        reply(Buffer.from("not audio"))) as typeof fetch;
      const [kept] = await speakScenes(["Hello world."], "free-cute");
      assert.ok(Math.abs(kept.words[1].start - 0.6) < 0.01);
      assert.equal(kept.provider, "elevenlabs:eleven_v3");
    },
  ));
