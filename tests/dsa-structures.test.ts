import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { dsaReelInput } from "../src/lib/dsa-reels";
import { BeatVisual } from "../packages/video-engine/src/beats";
import {
  storyboardBeatSchema,
  visualSchema,
} from "../packages/video-engine/src/model";
import { costValue } from "../packages/video-engine/src/cost-panel";

test("list shifts wait for the spoken references and share the counter's exact progress", () => {
  const beat = dsaReelInput("stacks-queues").beats!.find((item) =>
    item.text.startsWith("A Python list"),
  )!;
  assert.equal(beat.visual.type, "structure");
  if (beat.visual.type !== "structure") return;
  assert.equal(beat.visual.cue, "shifts");
  assert.equal(beat.visual.costRow, 0);
  const row = beat.cost!.rows[0];
  const captions = [
    { id: "shift", text: "shifts", from: 30, to: 35 },
    { id: "remaining", text: "remaining", from: 40, to: 48 },
    { id: "references", text: "references", from: 54, to: 65 },
  ];
  assert.equal(costValue(row, 39, 180, captions), 0);
  assert.equal(costValue(row, 46, 180, captions), 1);
  assert.equal(costValue(row, 60, 180, captions), 2);
  const markup = (progress: number) =>
    renderToStaticMarkup(
      createElement(BeatVisual, {
        v: beat.visual,
        f: 40,
        d: 180,
        accent: "#E0B769",
        countProgress: progress,
      }),
    );
  assert.equal(markup(0).match(/REFERENCE MOVED/g)?.length ?? 0, 0);
  assert.equal(markup(1).match(/REFERENCE MOVED/g)?.length, 1);
  assert.equal(markup(2).match(/REFERENCE MOVED/g)?.length, 2);
  assert.ok(
    !storyboardBeatSchema.safeParse({
      ...beat,
      cost: { ...beat.cost, rows: [{ ...row, to: 3, events: undefined }] },
    }).success,
  );
});

test("large-list proof derives the compressed indices and exact n minus one shift count", () => {
  const beat = dsaReelInput("stacks-queues").beats!.find((item) =>
    item.text.startsWith("Grow that list"),
  )!;
  assert.equal(beat.visual.type, "structure");
  if (beat.visual.type !== "structure") return;
  assert.equal(beat.visual.detail, "large-list");
  assert.equal(beat.cost!.n, 1000000);
  assert.equal(beat.cost!.rows[0].to, 999999);
  assert.match(beat.code!.lines.join("\n"), /range\(1_000_000\)/);
  const html = renderToStaticMarkup(
    createElement(BeatVisual, {
      v: beat.visual,
      f: 90,
      d: 180,
      accent: "#E0B769",
      inputSize: 1000000,
      countProgress: 999999,
    }),
  );
  assert.match(html, /COMPRESSED VIEW/);
  assert.match(html, /999,999/);
  assert.match(html, /deque.popleft/);
  assert.doesNotMatch(html, /Jules|Mina|NaN/);
});

test("draft reveal has one cue per message and a visible ending callback", () => {
  const beats = dsaReelInput("stacks-queues").beats!;
  const opening = beats[0].visual;
  assert.equal(opening.type, "structure");
  if (opening.type !== "structure") return;
  assert.deepEqual(opening.cues, ["Hey", "again", "up"]);
  assert.ok(!visualSchema.safeParse({ ...opening, cues: ["Hey"] }).success);
  const final = beats.at(-1)!.visual;
  assert.equal(final.type, "structure");
  if (final.type !== "structure") return;
  assert.equal(final.detail, "draft-payoff");
  const html = renderToStaticMarkup(
    createElement(BeatVisual, {
      v: final,
      f: 100,
      d: 180,
      accent: "#E0B769",
      cueFrames: [60],
    }),
  );
  assert.match(html, /BACK IN DRAFTS/);
  assert.match(html, /NEVER SENT/);
});
