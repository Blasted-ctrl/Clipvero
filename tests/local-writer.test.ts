import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { after, test } from "node:test";

const temporaryData = mkdtempSync(join(tmpdir(), "clipvero-local-writer-"));
process.env.DATA_DIR = temporaryData;
process.env.CLAUDE_BIN = "none";
process.env.CODEX_BIN = "none";
process.env.CLIPVERO_TEXT_PROVIDERS = "openai";
process.env.OPENAI_API_KEY = "test-only-writer-fixture";

const { applyStoryboardCopy, localScript, localStoryboard } =
  await import("../src/server/local-writer");
const { createSchema } = await import("../src/lib/model");
const { dsaReels, dsaReelInput } = await import("../src/lib/dsa-reels");

after(() => {
  assert.ok(resolve(temporaryData).startsWith(`${resolve(tmpdir())}${sep}`));
  rmSync(temporaryData, { recursive: true, force: true });
});

function input() {
  const text = "Mina has twenty four contacts. Now compare two names.";
  return createSchema.parse({
    title: "Mina's contacts",
    mode: "script",
    style: "explainer",
    content: text,
    duration: 12,
    rightsConfirmed: true,
    beats: [
      {
        text,
        panel: "contacts",
        chapter: "Lookup",
        visual: {
          type: "hashmap",
          key: "Mina",
          value: "555-0103",
          bucket: 2,
          action: "lookup",
          entries: [{ key: "Jules", bucket: 2 }],
        },
        code: { lines: ["contacts['Mina']"], highlight: 0 },
        presentation: {
          camera: "close",
          mascotSide: "right",
          reaction: null,
        },
        cost: {
          n: 24,
          unit: "key checks",
          focus: "O(1)",
          rows: [
            {
              label: "This bucket",
              complexity: "O(1)",
              from: 0,
              to: 2,
              cue: "Now",
            },
          ],
          note: "Illustrative collision example; compare full keys",
        },
      },
    ],
  });
}

function scriptResponse(
  text: string,
  visual: unknown = input().beats![0].visual,
) {
  return {
    title: "Mina's lookup",
    description: "A contact lookup.",
    topic: "HASH MAPS",
    scenes: [{ text, visual }],
  };
}

async function withProviderFixtures(
  responses: unknown[],
  run: (prompts: string[]) => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  const prompts: string[] = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://api.openai.com/v1/chat/completions");
    assert.equal(options?.method, "POST");
    assert.equal(
      new Headers(options?.headers).get("authorization"),
      "Bearer test-only-writer-fixture",
    );
    const request = JSON.parse(String(options?.body));
    prompts.push(request.messages[0].content);
    assert.ok(prompts.length <= responses.length, "Unexpected writer retry");
    return Response.json({
      choices: [
        { message: { content: JSON.stringify(responses[prompts.length - 1]) } },
      ],
    });
  };
  try {
    await run(prompts);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("storyboard copy preserves every typed field and leaves its input unchanged", () => {
  for (const lesson of dsaReels) {
    const original = dsaReelInput(lesson.id);
    const snapshot = structuredClone(original);
    const texts = original.beats!.map((beat) => beat.text);
    texts[0] += " Ready?";
    const edited = applyStoryboardCopy(original, texts);
    assert.equal(edited.content, texts.join("\n\n"));
    assert.deepEqual(
      edited.beats,
      original.beats!.map((beat, i) => ({ ...beat, text: texts[i] })),
    );
    assert.deepEqual(
      original,
      snapshot,
      "The saved storyboard is immutable during refinement",
    );
  }
});

test("storyboard copy rejects style violations and changed beat counts", () => {
  const original = input();
  assert.throws(
    () => applyStoryboardCopy(original, [`Imagine. ${original.content}`]),
    /Script style needs editing/,
  );
  assert.throws(() => applyStoryboardCopy(original, []));
  assert.throws(() =>
    applyStoryboardCopy(original, [original.content, original.content]),
  );
});

test("storyboard copy protects numerical facts, diagram names and spoken counter cues", () => {
  const original = input();
  assert.throws(
    () =>
      applyStoryboardCopy(original, [
        original.content.replace("twenty four", "twenty five"),
      ]),
    /changed a spoken number/,
  );
  assert.throws(
    () =>
      applyStoryboardCopy(original, [original.content.replace("Mina", "Nova")]),
    /lost the diagram identity Mina/,
  );
  assert.throws(
    () =>
      applyStoryboardCopy(original, [original.content.replace("Now", "Then")]),
    /lost the diagram's spoken cue Now/,
  );
});

test("storyboard copy accepts equivalent spoken numbers and digits", () => {
  const original = input();
  const text = "Mina has 24 contacts. Now compare 2 names.";
  const edited = applyStoryboardCopy(original, [text]);
  assert.equal(edited.beats![0].text, text);
  assert.deepEqual(edited.beats![0].visual, original.beats![0].visual);
  assert.deepEqual(edited.beats![0].cost, original.beats![0].cost);
});

test("storyboard copy preserves structure reveal and operation cue words", () => {
  const original = dsaReelInput("stacks-queues");
  const texts = original.beats!.map((beat) => beat.text);
  const lostReveal = [...texts];
  lostReveal[0] = lostReveal[0].replace("again", "once more");
  assert.throws(
    () => applyStoryboardCopy(original, lostReveal),
    /lost the diagram's spoken cue again/,
  );
  const lostOperation = [...texts];
  const index = texts.findIndex((text) => text.startsWith("A Python list"));
  lostOperation[index] = lostOperation[index].replace("shifts", "moves");
  assert.throws(
    () => applyStoryboardCopy(original, lostOperation),
    /lost the diagram's spoken cue shifts/,
  );
});

test("storyboard copy preserves call-stack receive and result cues", () => {
  const original = dsaReelInput("recursion");
  const texts = original.beats!.map((beat) => beat.text);
  texts[6] = texts[6].replace("back", "again");
  assert.throws(
    () => applyStoryboardCopy(original, texts),
    /lost the diagram's spoken cue back/,
  );
});

test("local storyboard refinement uses a configured fixture provider and repairs one rejected copy", async () => {
  const original = input();
  await withProviderFixtures(
    [
      { texts: [original.content.replace("twenty four", "twenty five")] },
      { texts: [original.content] },
    ],
    async (prompts) => {
      const result = await localStoryboard(original);
      assert.deepEqual(result.input, original);
      assert.equal(result.usage.writer, "openai");
      assert.equal(prompts.length, 2);
      assert.match(prompts[1], /changed a spoken number/);
    },
  );
});

test("local storyboard refinement rejects a second invalid copy without a silent fallback", async () => {
  const original = input();
  const response = { texts: [original.content.replace("Mina", "Nova")] };
  await withProviderFixtures([response, response], async (prompts) => {
    await assert.rejects(
      localStoryboard(original),
      /lost the diagram identity Mina/,
    );
    assert.equal(prompts.length, 2);
  });
});

test("generated scripts retain valid cost, presentation, code and diagram state", async () => {
  const original = input().beats![0];
  await withProviderFixtures(
    [{ ...scriptResponse(original.text), scenes: [original] }],
    async (prompts) => {
      const result = await localScript(input(), "");
      assert.deepEqual(result.beats[0], {
        chapter: original.chapter,
        panel: original.panel,
        code: original.code,
        presentation: original.presentation,
        cost: original.cost,
        visual: original.visual,
      });
      assert.equal(result.usage.writer, "openai");
      assert.equal(prompts.length, 1);
    },
  );
});

test("malformed or missing generated object diagrams fail instead of becoming title cards", async () => {
  for (const response of [
    scriptResponse("Mina is in the list.", {
      type: "array",
      items: ["Mina", "Jules"],
      target: 8,
    }),
    {
      ...scriptResponse("Mina is in the list."),
      scenes: [{ text: "Mina is in the list." }],
    },
  ]) {
    await withProviderFixtures([response], async (prompts) => {
      await assert.rejects(localScript(input(), ""));
      assert.equal(prompts.length, 1);
    });
  }
});

test("legacy plain-text scene responses retain their title fallback", async () => {
  await withProviderFixtures(
    [
      {
        ...scriptResponse("Mina is in the list."),
        scenes: ["Mina is in the list."],
      },
    ],
    async () => {
      const result = await localScript(input(), "");
      assert.deepEqual(result.scenes, ["Mina is in the list."]);
      assert.deepEqual(result.beats[0].visual, {
        type: "title",
        text: "HASH MAPS",
      });
    },
  );
});

test("script generation accepts a compliant style repair", async () => {
  await withProviderFixtures(
    [
      scriptResponse("Imagine a contact list."),
      scriptResponse("Mina shares this bucket with Jules."),
    ],
    async (prompts) => {
      const result = await localScript(input(), "");
      assert.deepEqual(result.scenes, ["Mina shares this bucket with Jules."]);
      assert.equal(prompts.length, 2);
      assert.match(prompts[1], /broke the style rules/);
    },
  );
});

test("script generation rejects style violations that survive the repair", async () => {
  await withProviderFixtures(
    [
      scriptResponse("Imagine a contact list."),
      scriptResponse("Let's dive in."),
    ],
    async (prompts) => {
      await assert.rejects(
        localScript(input(), ""),
        /revised script still needs editing/,
      );
      assert.equal(prompts.length, 2);
    },
  );
});
