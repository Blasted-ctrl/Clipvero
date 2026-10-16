import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { dsaReels, dsaReelInput } from "../src/lib/dsa-reels";
import {
  applyStyle,
  createSchema,
  scriptTimeline,
  timelineSchema,
  visualSchema,
} from "../src/lib/model";
import { BeatVisual } from "../packages/video-engine/src/beats";
import { scriptIssues } from "../src/lib/script-style";

test("supplied lesson diagrams survive create validation and saved timeline parsing", () => {
  for (const reel of dsaReels) {
    const input = dsaReelInput(reel.id);
    assert.deepEqual(
      scriptIssues(input.content),
      [],
      `${reel.id} must pass the agent script boundary`,
    );
    const timeline = timelineSchema.parse(
      applyStyle(
        scriptTimeline(input.content, input.aspect, input.duration),
        input,
      ),
    );
    assert.equal(timeline.scenes.length, input.beats!.length);
    assert.deepEqual(
      timeline.scenes.map((s) => s.script),
      input.beats!.map((b) => b.text),
    );
    assert.deepEqual(
      timeline.scenes.map((s) => s.visual),
      input.beats!.map((b) => b.visual),
    );
    assert.ok(timeline.scenes.some((s) => s.panel && s.code));
    assert.deepEqual(
      timeline.scenes.map((s) => s.presentation),
      input.beats!.map((b) => b.presentation),
    );
    assert.notEqual(timeline.accentColor, "#8B5CF6");
    assert.equal(
      createSchema.safeParse({
        ...input,
        content: input.content + " Added words.",
      }).success,
      false,
    );
  }
});

test("binary search's displayed path agrees with the lesson's three comparisons", () => {
  const beats = dsaReelInput("binary-search").beats!;
  const steps = beats.filter(
    (b) => b.visual.type === "array" && b.visual.mode === "binary",
  );
  for (const beat of steps) {
    assert.equal(beat.visual.type, "array");
    const visual = beat.visual as Extract<
      typeof beat.visual,
      { type: "array" }
    >;
    assert.equal(visual.items[visual.target!], "42");
    const html = renderToStaticMarkup(
      createElement(BeatVisual, {
        v: visual,
        f: 30,
        d: 120,
        accent: "#34D399",
      }),
    );
    if (visual.step === 2 && visual.showResult)
      assert.match(html, /found in 3 steps/);
    else assert.doesNotMatch(html, /found in/);
  }
});

test("malformed diagrams fail before reaching the renderer", () => {
  const input = dsaReelInput("hashmap");
  for (const patch of [
    { aspect: "1:1" },
    { generateImages: true },
    { beats: [{ ...input.beats![0], text: "One.\n\nTwo." }] },
  ]) {
    assert.equal(createSchema.safeParse({ ...input, ...patch }).success, false);
  }
  assert.equal(
    visualSchema.safeParse({
      type: "roster",
      names: ["Miku", "Nino"],
      target: 5,
      label: "Contacts",
    }).success,
    false,
  );
  assert.equal(
    visualSchema.safeParse({ type: "array", items: ["1", "2"], target: 8 })
      .success,
    false,
  );
  assert.equal(
    visualSchema.safeParse({
      type: "structure",
      kind: "stack",
      items: [],
      action: "remove",
      label: "Empty",
    }).success,
    false,
  );
  assert.equal(
    visualSchema.safeParse({
      type: "structure",
      kind: "queue",
      items: [],
      action: "add",
      label: "Missing item",
    }).success,
    false,
  );
  assert.equal(
    visualSchema.safeParse({ type: "code", lines: ["print(1)"], highlight: 5 })
      .success,
    false,
  );
});

test("short accepted motion scenes render without invalid interpolation ranges", () => {
  for (const type of ["insert", "lookup", "hold"] as const) {
    const visual = visualSchema.parse({
      type: "hashmap",
      key: "Miku",
      bucket: 2,
      action: type,
    });
    for (const f of [0, 7, 14])
      assert.doesNotThrow(() =>
        renderToStaticMarkup(
          createElement(BeatVisual, { v: visual, f, d: 15, accent: "#38BDF8" }),
        ),
      );
  }
});

test("queue and stack removals display the correct departing item", () => {
  for (const kind of ["stack", "queue"] as const) {
    const v = visualSchema.parse({
      type: "structure",
      kind,
      items: ["A", "B", "C"],
      action: "remove",
      label: "Order",
    });
    const html = renderToStaticMarkup(
      createElement(BeatVisual, { v, f: 120, d: 120, accent: "#FBBF24" }),
    );
    assert.match(html, kind === "stack" ? /pop\(\).*C/ : /dequeue\(\).*A/);
  }
});

test("a static array highlight never reports a successful search", () => {
  const visual = visualSchema.parse({
    type: "array",
    items: ["3", "8", "15"],
    mode: "highlight",
    label: "no matching value",
  });
  const html = renderToStaticMarkup(
    createElement(BeatVisual, {
      v: visual,
      f: 120,
      d: 150,
      accent: "#34D399",
    }),
  );
  assert.match(html, /no matching value/);
  assert.doesNotMatch(html, /found in/);
});
