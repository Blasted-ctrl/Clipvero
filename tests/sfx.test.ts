import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { planCues, sfxNames, type Cue } from "../packages/video-engine/src/sfx";
import { probe } from "../src/server/media";
import { scriptTimeline, visualSchema } from "../src/lib/model";

const title = (text: string) => visualSchema.parse({ type: "title", text });
const array = (items: string[]) =>
  visualSchema.parse({ type: "array", items, mode: "scan" });
function timeline(count: number) {
  const t = scriptTimeline(
    Array.from({ length: count }, (_, i) => `Beat ${i}.`).join("\n\n"),
    "9:16",
    count * 3,
  );
  t.style = "explainer";
  t.scenes.forEach((s) => (s.durationFrames = 90));
  return t;
}
const sounds = (cues: Cue[]) => cues.map((c) => c.sound);

test("every beat that changes the screen gets a sound, chosen by what changed", () => {
  const t = timeline(5);
  t.scenes[0].visual = title("HASH MAPS");
  t.scenes[1].visual = array(["a", "b"]);
  t.scenes[1].panel = "list";
  t.scenes[2].visual = array(["a", "b"]);
  t.scenes[2].panel = "list";
  t.scenes[3].visual = title("RECAP");
  t.scenes[4].visual = title("RECAP");
  t.scenes[4].panel = "other";
  const cues = planCues(t);
  assert.deepEqual(sounds(cues), ["pop", "whoosh", "tick", "whoosh", "whoosh"]);
  assert.equal(cues[0].frame, 2, "the opening pops just after the first frame");
  assert.equal(cues[1].frame, 88, "a cut gets its whoosh two frames ahead");
  assert.equal(
    cues[2].frame,
    180,
    "a diagram moving to its next state ticks on the beat",
  );
});

test("code changes are marked: a new block swishes, a moved highlight ticks", () => {
  const t = timeline(3);
  const block = ["def f(x):", "    return x"];
  t.scenes[0].visual = title("CODE");
  t.scenes[1].code = { lines: block, highlight: 0 };
  t.scenes[2].code = { lines: block, highlight: 1 };
  const cues = planCues(t);
  assert.deepEqual(sounds(cues), ["pop", "swish", "tick"]);
  assert.ok(cues[1].frame > 90 && cues[2].frame > 180);
});

test("nearby cues merge, conversations only sound pop-up diagrams, and sfx can be switched off", () => {
  const t = timeline(2);
  t.scenes[0].durationFrames = 8;
  t.scenes[0].visual = title("A");
  t.scenes[1].visual = array(["a", "b"]);
  assert.equal(
    planCues(t).length,
    1,
    "a whoosh only 4 frames after the opening pop is merged away",
  );
  t.scenes[0].durationFrames = 30;
  assert.equal(
    planCues(t).length,
    2,
    "with room between them both sounds play",
  );
  const talk = timeline(3);
  talk.style = "conversation";
  talk.scenes[1].visual = title("POPUP");
  assert.deepEqual(sounds(planCues(talk)), ["pop"]);
  talk.sfx = false;
  assert.deepEqual(planCues(talk), []);
});

test("every sound in the pack exists, is short and is not silent", async () => {
  for (const name of sfxNames) {
    const path = resolve("public/sfx", `${name}.mp3`);
    assert.ok(existsSync(path), `${name}.mp3 is missing; run pnpm sfx:make`);
    const seconds = Number((await probe(path)).format.duration);
    assert.ok(seconds > 0.04 && seconds < 1.5, `${name} lasts ${seconds}s`);
  }
});
