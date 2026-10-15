import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { openAI } from "../src/server/providers";
import { createSchema } from "../src/lib/model";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const originalFetch = globalThis.fetch,
  originalKey = process.env.OPENAI_API_KEY,
  originalImageModel = process.env.OPENAI_IMAGE_MODEL;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey) process.env.OPENAI_API_KEY = originalKey;
  else delete process.env.OPENAI_API_KEY;
  if (originalImageModel) process.env.OPENAI_IMAGE_MODEL = originalImageModel;
  else delete process.env.OPENAI_IMAGE_MODEL;
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
  delete process.env.OPENAI_IMAGE_MODEL;
  const bytes = Buffer.from([1, 2, 3, 4]);
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith("images/generations"))
      assert.deepEqual(JSON.parse(options?.body as string), {
        model: "gpt-image-2",
        prompt: "Test-only illustration request",
        n: 1,
        size: "1024x1536",
        output_format: "png",
      });
    return String(url).endsWith("audio/speech")
      ? new Response(bytes)
      : Response.json({ data: [{ b64_json: bytes.toString("base64") }] });
  };
  assert.deepEqual(await openAI.speech("Test fixture words", "alloy"), bytes);
  assert.deepEqual(await openAI.image("Test-only illustration request"), bytes);
});

test("reference image edits preserve the configured model and request PNG output", async (t) => {
  process.env.OPENAI_API_KEY = "test-only-key";
  process.env.OPENAI_IMAGE_MODEL = "configured-image-model";
  const directory = mkdtempSync(join(tmpdir(), "clipvero-reference-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "reference.png");
  const bytes = Buffer.from([1, 2, 3, 4]);
  writeFileSync(path, bytes);
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://api.openai.com/v1/images/edits");
    assert.ok(options?.body instanceof FormData);
    assert.equal(options.body.get("model"), "configured-image-model");
    assert.equal(options.body.get("size"), "1024x1536");
    assert.equal(options.body.get("output_format"), "png");
    const reference = options.body.get("image");
    assert.ok(reference instanceof File);
    assert.deepEqual(Buffer.from(await reference.arrayBuffer()), bytes);
    return Response.json({ data: [{ b64_json: bytes.toString("base64") }] });
  };
  assert.deepEqual(await openAI.image("Original character", path), bytes);
});
