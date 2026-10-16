import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { dsaReelInput } from "../src/lib/dsa-reels";
import { BeatVisual } from "../packages/video-engine/src/beats";
import { visualSchema } from "../packages/video-engine/src/model";

test("zero factorial uses its own one-call base case instead of the four-person result", () => {
  const beat = dsaReelInput("recursion").beats!.find((item) =>
    item.text.includes("handles zero"),
  )!;
  assert.equal(beat.visual.type, "call-stack");
  if (beat.visual.type !== "call-stack") return;
  assert.deepEqual(beat.visual.calls, [
    { label: "fact(0)", state: "returned", value: "1" },
  ]);
  assert.equal(beat.visual.result, "1");
  assert.equal(beat.visual.example, undefined);
  assert.equal(beat.cost!.n, 0);
  assert.ok(beat.cost!.rows.every((row) => row.from === 1 && row.to === 1));
  assert.match(beat.code!.lines.join("\n"), /fact\(0\).*1/);
  const html = renderToStaticMarkup(
    createElement(BeatVisual, {
      v: beat.visual,
      f: 30,
      d: 120,
      accent: "#B7A0E4",
    }),
  );
  assert.match(html, /fact\(0\)/);
  assert.match(html, /RETURN 1/);
  assert.doesNotMatch(html, /fact\(4\)|RETURN 24|NaN|undefined/);
});

test("larger factorial has a labeled partial stack and matching total call model", () => {
  const beat = dsaReelInput("recursion").beats!.find((item) =>
    item.text.startsWith("For input n,"),
  )!;
  assert.equal(beat.visual.type, "call-stack");
  if (beat.visual.type !== "call-stack") return;
  assert.match(beat.visual.label, /6 OF 10/);
  assert.deepEqual(
    beat.visual.calls.map((call) => call.label),
    ["fact(6)", "fact(5)", "fact(4)", "fact(3)", "fact(2)", "fact(1)"],
  );
  assert.equal(beat.visual.calls.at(-1)!.state, "active");
  assert.equal(beat.visual.result, undefined);
  assert.equal(beat.visual.example, undefined);
  assert.equal(beat.cost!.n, 10);
  assert.ok(beat.cost!.rows.every((row) => row.from === 10 && row.to === 10));
  assert.match(beat.cost!.note, /deepest 6 shown/);
});

test("integer-cost example and loop compare correct factorial results with honest state units", () => {
  const beats = dsaReelInput("recursion").beats!;
  const integer = beats.find((item) => item.text.startsWith("Those counts"))!;
  let factorial = 1n;
  for (let value = 2n; value <= 20n; value++) factorial *= value;
  assert.ok(
    integer.code!.lines.some((line) => line.includes(factorial.toString())),
  );
  const loop = beats.find((item) => item.text.startsWith("A loop can"))!;
  assert.equal(loop.visual.type, "code");
  if (loop.visual.type !== "code") return;
  assert.match(loop.visual.lines.join("\n"), /range\(2, 5\)/);
  assert.match(loop.visual.lines.join("\n"), /1 -> 2 -> 6 -> 24/);
  assert.equal(loop.cost!.n, 4);
  assert.equal(loop.cost!.rows[0].to, 4);
  assert.equal(loop.cost!.rows[1].to, 1);
  assert.match(loop.cost!.rows[1].label, /group/);
  assert.match(loop.cost!.note, /excludes big-integer size/);
});

test("unwinding visibly receives the child value before revealing the parent's result", () => {
  const beats = dsaReelInput("recursion").beats!;
  const previous = beats[5].visual;
  const visual = beats[6].visual;
  assert.equal(visual.type, "call-stack");
  if (visual.type !== "call-stack") return;
  assert.deepEqual(visual.returnStep, {
    from: "fact(1)",
    to: "fact(2)",
    value: 1,
    multiplier: 2,
    result: 2,
  });
  const render = (frame: number) =>
    renderToStaticMarkup(
      createElement(BeatVisual, {
        v: visual,
        previous,
        f: frame,
        d: 180,
        accent: "#B7A0E4",
        cueFrames: [30, 75],
      }),
    );
  assert.match(render(29), /fact\(1\)/);
  assert.doesNotMatch(render(29), /RETURN 2|data-return-transfer/);
  assert.match(render(45), /data-return-transfer/);
  assert.match(render(45), /2 × 1/);
  assert.doesNotMatch(render(45), /RETURN 2/);
  assert.match(render(75), /RETURN 2/);
  assert.doesNotMatch(render(75), /data-return-transfer/);
  assert.ok(
    !visualSchema.safeParse({
      ...visual,
      returnStep: { ...visual.returnStep, result: 3 },
    }).success,
  );
});

test("seating examples move original people between distinct valid positions without an opening answer spoiler", () => {
  const opening = dsaReelInput("recursion").beats![0];
  assert.doesNotMatch(opening.code!.lines.at(-1)!, /24/);
  const render = (frame: number) =>
    renderToStaticMarkup(
      createElement(BeatVisual, {
        v: opening.visual,
        f: frame,
        d: 180,
        accent: "#B7A0E4",
        cueFrames: [20, 80],
      }),
    );
  const positions = (frame: number) =>
    [
      ...render(frame).matchAll(
        /x="([\d.]+)" y="219"[^>]*>(Mina|Jules|Nova|Remy)<\/text>/g,
      ),
    ].map((match) => Number(match[1]));
  const first = positions(0),
    second = positions(60),
    third = positions(120);
  assert.equal(first.length, 4);
  assert.equal(new Set(second).size, 4);
  assert.equal(new Set(third).size, 4);
  assert.deepEqual([...first].sort(), [...third].sort());
  assert.notDeepEqual(first, second);
  assert.notDeepEqual(second, third);
  const midSwap = [
    ...render(29).matchAll(
      /data-seating-person="(?:Mina|Jules)" transform="translate\(0 ([\d.]+)\)"/g,
    ),
  ].map((match) => Number(match[1]));
  assert.equal(midSwap.length, 2);
  assert.ok(
    Math.abs(midSwap[0] - midSwap[1]) >= 82,
    "crossing names and cards need separate vertical lanes",
  );
});

test("direction and stopping-case narration gets bounded proof states rather than a stale return value", () => {
  const beats = dsaReelInput("recursion").beats!;
  const directions = beats[9].visual,
    progress = beats[10].visual;
  assert.equal(directions.type, "call-stack");
  assert.equal(progress.type, "call-stack");
  if (directions.type !== "call-stack" || progress.type !== "call-stack")
    return;
  assert.equal(directions.detail, "directions");
  assert.deepEqual(directions.trace!.results, ["1", "2", "6", "24"]);
  assert.equal(progress.trace!.repeated, "fact(4)");
  const html = renderToStaticMarkup(
    createElement(BeatVisual, {
      v: progress,
      f: 100,
      d: 180,
      accent: "#B7A0E4",
      cueFrames: [20, 60],
    }),
  );
  assert.match(html, /SAME INPUT \/ NO PROGRESS/);
  assert.match(html, /fact\(1\)/);
  assert.doesNotMatch(html, /RETURN 24/);
});
