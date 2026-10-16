import { test } from "node:test";
import assert from "node:assert/strict";
import {
  graphFrame,
  graphMemoryExample,
} from "../packages/video-engine/src/graph-state";
import { visualSchema } from "../packages/video-engine/src/model";
import { dsaReelInput } from "../src/lib/dsa-reels";
import { costCount } from "../packages/video-engine/src/cost-panel";

test("BFS visits and counters follow D, E and F instead of jumping to the exit", () => {
  const input = dsaReelInput("bfs-dfs");
  const previous = input.beats![3].visual;
  const beat = input.beats![4];
  const v = visualSchema.parse(beat.visual);
  assert.equal(v.type, "graph");
  if (v.type !== "graph") throw new Error("Wrong visual");
  const captions = ["D", "E", "F"].map((text, i) => ({
    id: crypto.randomUUID(),
    text,
    from: 10 + i * 30,
    to: 25 + i * 30,
  }));
  for (const [frame, active, visits] of [
    [0, "C", 3],
    [16, "D", 4],
    [46, "E", 5],
    [76, "F", 6],
  ] as const) {
    const state = graphFrame(v, visualSchema.parse(previous), frame, captions);
    assert.equal(state.visual.active, active);
    assert.equal(state.visual.visited.length, visits);
    assert.equal(costCount(beat.cost!.rows[0], frame, 120, captions), visits);
  }
  assert.deepEqual(
    graphFrame(v, visualSchema.parse(previous), 100, []).visual.visited,
    ["A", "B", "C"],
  );
});

test("DFS resets its own stack and exposes backtracking before the next new visit", () => {
  const beats = dsaReelInput("bfs-dfs").beats!;
  const reset = visualSchema.parse(beats[6].visual);
  if (reset.type !== "graph") throw new Error("Wrong visual");
  const state = graphFrame(reset, visualSchema.parse(beats[5].visual), 0, []);
  assert.deepEqual(state.visual.visited, []);
  assert.deepEqual(state.visual.frontier, ["A"]);
  const backtrack = visualSchema.parse(beats[8].visual);
  if (backtrack.type !== "graph") throw new Error("Wrong visual");
  const captions = [
    { id: crypto.randomUUID(), text: "B,", from: 20, to: 35 },
    { id: crypto.randomUUID(), text: "E.", from: 50, to: 65 },
  ];
  const beforeNext = graphFrame(
    backtrack,
    visualSchema.parse(beats[7].visual),
    35,
    captions,
  ).visual;
  assert.equal(beforeNext.active, "B");
  assert.deepEqual(beforeNext.frontier, ["A", "B"]);
  assert.equal(beforeNext.visited.length, 3);
  assert.equal(
    graphFrame(backtrack, visualSchema.parse(beats[7].visual), 65, captions)
      .visual.visited.length,
    4,
  );
});

test("graph routes and narrated steps reject dangling states; frontier examples derive from actual edges", () => {
  const v = visualSchema.parse(dsaReelInput("bfs-dfs").beats![4].visual);
  if (v.type !== "graph") throw new Error("Wrong visual");
  assert.deepEqual(graphMemoryExample(v), {
    queue: ["D", "E", "F", "G"],
    stack: ["A", "B", "D"],
  });
  assert.equal(
    visualSchema.safeParse({ ...v, path: ["A", "F"] }).success,
    false,
  );
  assert.equal(
    visualSchema.safeParse({
      ...v,
      steps: [{ cue: "F", active: "missing", visited: [], frontier: [] }],
    }).success,
    false,
  );
  assert.equal(
    visualSchema.safeParse({
      ...v,
      steps: [{ cue: "F", active: "F", visited: ["A", "A"], frontier: [] }],
    }).success,
    false,
  );
  const tiny = visualSchema.parse({
    type: "graph",
    nodes: [
      { id: "X", label: "X" },
      { id: "Y", label: "Y" },
    ],
    edges: [{ from: "X", to: "Y" }],
    visited: [],
    frontier: ["X"],
    active: "X",
    mode: "bfs",
    label: "Two rooms",
  });
  if (tiny.type !== "graph") throw new Error("Wrong visual");
  assert.deepEqual(graphMemoryExample(tiny), {
    queue: ["X"],
    stack: ["X", "Y"],
  });
});

test("graph proofs separate stored-room peaks from traversal and close on the actual route", () => {
  const beats = dsaReelInput("bfs-dfs").beats!;
  const memory = beats.find(
    (beat) => beat.visual?.type === "graph" && beat.visual.detail === "memory",
  )!;
  assert.equal(memory.cost?.unit, "peak stored rooms");
  assert.equal(memory.cost?.n, 7);
  assert.deepEqual(
    memory.cost?.rows.map((row) => row.to),
    [4, 3],
  );
  const visual = visualSchema.parse(memory.visual);
  if (visual.type !== "graph") throw new Error("Wrong visual");
  assert.deepEqual(
    memory.cost?.rows.map((row) => row.to),
    Object.values(graphMemoryExample(visual)).map((list) => list.length),
  );
  assert.deepEqual(visual.cues, ["frontier", "stack"]);
  const last = beats.at(-1)!.visual;
  if (last.type !== "graph") throw new Error("Wrong visual");
  assert.equal(last.detail, "path");
  assert.equal(last.active, "F");
  assert.deepEqual(last.path, ["A", "C", "F"]);
});
