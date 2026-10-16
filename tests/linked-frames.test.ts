import assert from "node:assert/strict";
import test from "node:test";
import { visualSchema, type Scene } from "../packages/video-engine/src/model";
import { linkedFrame } from "../packages/video-engine/src/linked-state";
import { costCount } from "../packages/video-engine/src/cost-panel";
import { dsaReelInput } from "../src/lib/dsa-reels";

const captions = (words: string[]): Scene["captions"] =>
  words.map((text, i) => ({
    id: crypto.randomUUID(),
    text,
    from: 10 + i * 30,
    to: 20 + i * 30,
  }));
test("linked-list assignments wait for spoken cues and preserve the tail between writes", () => {
  const beats = dsaReelInput("linked-lists").beats!;
  const restore = beats.find((beat) => beat.text.startsWith("All right"))!;
  const visual = visualSchema.parse(restore.visual);
  assert.equal(visual.type, "linked-list");
  if (visual.type !== "linked-list") throw new Error("wrong visual");
  const cues = captions(["Save", "connect"]);
  const next = (frame: number, id: string) =>
    linkedFrame(visual, frame, cues).visual.nodes.find((node) => node.id === id)
      ?.next;
  assert.equal(next(9, "beat"), "outro");
  assert.equal(next(16, "drop"), "outro");
  assert.equal(next(39, "beat"), "outro");
  assert.equal(next(46, "beat"), "drop");
  assert.equal(next(46, "drop"), "outro");
  const row = restore.cost!.rows[0];
  assert.equal(costCount(row, 9, 100, cues), 0);
  assert.equal(costCount(row, 16, 100, cues), 1);
  assert.equal(costCount(row, 46, 100, cues), 2);
  assert.equal(
    linkedFrame(visual, 99, []).visual.nodes.find((n) => n.id === "beat")?.next,
    "outro",
  );
  assert.equal(
    visualSchema.safeParse({
      ...visual,
      steps: [{ cue: "go", from: "missing", to: "outro" }],
    }).success,
    false,
  );
});
test("broken and repaired playlist callbacks trace the connected songs only", () => {
  const beats = dsaReelInput("linked-lists").beats!;
  const first = beats[0],
    last = beats.at(-1)!;
  assert.equal(first.visual?.type, "linked-list");
  assert.equal(last.visual?.type, "linked-list");
  if (
    first.visual?.type !== "linked-list" ||
    last.visual?.type !== "linked-list"
  )
    throw new Error("wrong visual");
  assert.deepEqual(first.visual.walk, ["beat", "outro"]);
  assert.deepEqual(last.visual.walk, ["intro", "beat", "drop", "outro"]);
  assert.equal(last.cost?.rows[0].to, 4);
});
