import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { openAI } from "../src/server/providers";
import { createSchema } from "../src/lib/model";
const originalFetch = globalThis.fetch,
  originalKey = process.env.OPENAI_API_KEY;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey) process.env.OPENAI_API_KEY = originalKey;
  else delete process.env.OPENAI_API_KEY;
});
const input = createSchema.parse({
  title: "Contract test",
  mode: "prompt",
  content: "An original astronomy explanation",
  rightsConfirmed: true,
});
test("the script adapter validates real response shapes and preserves provider usage", async () => {
  process.env.OPENAI_API_KEY = "test-only-key";
  const calls: string[] = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return Response.json(
      String(url).endsWith("moderations")
        ? { results: [{ flagged: false }] }
        : {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: "An original explanation",
                    description: "Review the source facts",
                    scenes: ["An original scene."],
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 12, completion_tokens: 8 },
          },
    );
  };
  const result = await openAI.script(input, "Original character context");
  assert.deepEqual(result.scenes, ["An original scene."]);
  assert.deepEqual(result.usage, { prompt_tokens: 12, completion_tokens: 8 });
  assert.equal(calls.length, 2);
});
test("unsafe input stops before script generation and malformed AI output is rejected", async () => {
  process.env.OPENAI_API_KEY = "test-only-key";
  let count = 0;
  globalThis.fetch = async () => {
    count++;
    return Response.json({ results: [{ flagged: true }] });
  };
  await assert.rejects(() => openAI.script(input, ""), /content safety/);
  assert.equal(count, 1);
  globalThis.fetch = async (url) =>
    Response.json(
      String(url).endsWith("moderations")
        ? { results: [{ flagged: false }] }
        : { choices: [{ message: { content: '{"scenes":[]}' } }] },
    );
  await assert.rejects(() => openAI.script(input, ""));
});
test("provider authentication errors are actionable and never expose upstream credentials", async () => {
  process.env.OPENAI_API_KEY = "test-only-private-key";
  globalThis.fetch = async () =>
    Response.json(
      { error: { message: "test-only-private-key" } },
      { status: 401 },
    );
  await assert.rejects(
    () => openAI.speech("Original words", "alloy"),
    (e) =>
      e instanceof Error &&
      /rejected its API key/.test(e.message) &&
      !e.message.includes("test-only-private-key"),
  );
});
test("speech and image adapters return the supplied binary data without simulated generation", async () => {
  process.env.OPENAI_API_KEY = "test-only-key";
  const bytes = Buffer.from([1, 2, 3, 4]);
  globalThis.fetch = async (url) =>
    String(url).endsWith("audio/speech")
      ? new Response(bytes)
      : Response.json({ data: [{ b64_json: bytes.toString("base64") }] });
  assert.deepEqual(await openAI.speech("Test fixture words", "alloy"), bytes);
  assert.deepEqual(await openAI.image("Test-only illustration request"), bytes);
});
