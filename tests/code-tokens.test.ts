import assert from "node:assert/strict";
import { test } from "node:test";
import {
  codeKey,
  guessLanguage,
  timelineCode,
} from "../packages/video-engine/src/code-key";
import { highlightTimelineCode } from "../packages/video-engine/src/code-tokens";
import { scriptTimeline, visualSchema } from "../src/lib/model";

const python = [
  "def find(items, x):",
  "    for i in items:",
  "        if i == x: return True",
];

function timelineWith(lines: string[], language = "python") {
  const timeline = scriptTimeline("One.\n\nTwo.", "9:16", 6);
  timeline.scenes[0].code = { lines, highlight: 1 };
  timeline.scenes[1].visual = visualSchema.parse({
    type: "code",
    language,
    lines,
    highlight: 0,
  });
  return timeline;
}

test("code is highlighted in Node without any network access", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("network is off");
  }) as typeof fetch;
  try {
    const tokens = await highlightTimelineCode(timelineWith(python));
    const rows = tokens[codeKey(python, "python")];
    assert.equal(rows.length, 3);
    assert.equal(rows[0].map((t) => t.content).join(""), python[0]);
    const keyword = rows[0].find((t) => t.content.trim() === "def");
    assert.ok(
      keyword && keyword.color !== "#C9D1D9",
      "keywords get their own colour",
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("an unknown language is skipped and draws as plain text", async () => {
  const tokens = await highlightTimelineCode(
    timelineWith(["foo bar"], "notalanguage"),
  );
  assert.equal(tokens[codeKey(["foo bar"], "notalanguage")], undefined);
});

test("the same block is highlighted once and languages are guessed sensibly", () => {
  const blocks = timelineCode(timelineWith(python));
  assert.equal(blocks.length, 1);
  assert.equal(guessLanguage(python), "python");
  assert.equal(guessLanguage(["const a = 1;"]), "javascript");
  assert.equal(guessLanguage(["std::vector<int> v;"]), "cpp");
});
