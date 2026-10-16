import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BeatVisual } from "../packages/video-engine/src/beats";
import { ContactList } from "../packages/video-engine/src/contact-list";
import { HashDetail } from "../packages/video-engine/src/hash-details";
import {
  ArrayDetails,
  binaryTrace,
} from "../packages/video-engine/src/array-details";
import {
  ComplexityProof,
  halvingSteps,
} from "../packages/video-engine/src/complexity-proof";
import { pointerTrace } from "../packages/video-engine/src/pointer-proof";
import {
  CostPanel,
  costCount,
  costValue,
  growthValue,
} from "../packages/video-engine/src/cost-panel";
import { dsaReels, dsaReelInput } from "../src/lib/dsa-reels";
import { applyStyle, timelineSchema } from "../src/lib/model";
import { scriptIssues } from "../src/lib/script-style";
import {
  complexitySchema,
  costSchema,
  sceneSchema,
  scriptTimeline,
  storyboardBeatSchema,
  visualSchema,
  type Visual,
} from "../packages/video-engine/src/model";

test("contact lists retain fictional values and use the same named-check counter", () => {
  const beats = dsaReelInput("hashmap").beats!;
  const visual = beats[1].visual;
  if (visual.type !== "array") throw new Error("Expected contact array");
  assert.equal(visual.detail, "contacts");
  assert.equal(visual.values?.[2], "555-0103");
  for (const count of [0, 1, 2, 3]) {
    const render = (): string =>
      renderToStaticMarkup(
        createElement(ContactList, {
          v: visual,
          f: 60,
          d: 180,
          accent: "#61B6EC",
          count,
          continuing: true,
        }),
      );
    const html = render();
    assert.equal(html, render());
    assert.equal((html.match(/data-checked="true"/g) ?? []).length, count);
    assert.equal(html.includes("number returned"), count === 3);
    assert.match(html, /Nova/);
    assert.match(html, /Mina/);
  }
  assert.equal(
    visualSchema.safeParse({ ...visual, values: ["555-0101", "555-0102"] })
      .success,
    false,
  );
  assert.equal(
    storyboardBeatSchema.safeParse({
      ...beats[1],
      cost: {
        ...beats[1].cost!,
        rows: [
          { ...beats[1].cost!.rows[0], to: 5, events: undefined },
          beats[1].cost!.rows[1],
        ],
      },
    }).success,
    false,
  );
});

test("long-key characters and the scoped complexity panel share a bounded count", () => {
  const beat = dsaReelInput("hashmap").beats![11];
  const visual = beat.visual;
  if (visual.type !== "hashmap") throw new Error("Expected hashmap");
  assert.equal(visual.detail, "long-keys");
  assert.equal(beat.cost?.n, 26);
  assert.equal(beat.cost?.unit, "characters read");
  assert.equal(visual.costRow, 0);
  assert.equal(
    storyboardBeatSchema.safeParse({
      ...beat,
      cost: { ...beat.cost!, n: 1000000 },
    }).success,
    false,
  );
  assert.equal(
    storyboardBeatSchema.safeParse({
      ...beat,
      cost: { ...beat.cost!, unit: "key checks" },
    }).success,
    false,
  );
  for (const count of [0, 4, 13, 26]) {
    const html = renderToStaticMarkup(
      createElement(HashDetail, {
        v: visual,
        frame: 100,
        accent: "#61B6EC",
        stored: 0,
        entries: [],
        count,
      }),
    );
    assert.equal((html.match(/data-read="true"/g) ?? []).length, count);
    assert.match(html, new RegExp(`${count} / 26 characters read`));
  }
  assert.equal(
    storyboardBeatSchema.safeParse({
      ...beat,
      cost: {
        ...beat.cost!,
        rows: [{ ...beat.cost!.rows[0], to: 27 }, beat.cost!.rows[1]],
      },
    }).success,
    false,
  );
});

test("binary proofs derive successful and absent traces from the actual sorted values", () => {
  const items = ["3", "8", "15", "21", "29", "42", "55", "68", "89"];
  assert.deepEqual(
    binaryTrace(items, 42).map(({ value, relation }) => [value, relation]),
    [
      [29, "<"],
      [55, ">"],
      [42, "="],
    ],
  );
  assert.deepEqual(
    binaryTrace(items, 43).map(({ value, relation }) => [value, relation]),
    [
      [29, "<"],
      [55, ">"],
      [42, "<"],
    ],
  );
  assert.deepEqual(binaryTrace(["3", "8", "15"], 14).at(-1), {
    value: 15,
    mid: 2,
    lo: 2,
    hi: 2,
    relation: ">",
  });
  for (const invalid of [
    ["2", "1"],
    ["1", "NaN"],
    ["1", "Infinity"],
    [" ", "2"],
  ])
    assert.deepEqual(binaryTrace(invalid, 2), []);
  assert.deepEqual(binaryTrace(items, Infinity), []);
});

test("binary proof contracts reject incorrect targets and empty ranges while preserving older absent scenes", () => {
  const source = {
    type: "array",
    items: ["3", "8", "15"],
    mode: "highlight",
    detail: "bounds",
    searchFor: 14,
    emptyAt: 2,
    showPointer: false,
    showResult: false,
  };
  assert.ok(visualSchema.safeParse(source).success);
  for (const patch of [
    { searchFor: undefined },
    { searchFor: 8 },
    { emptyAt: 1 },
    { items: ["8", "3", "15"] },
    { items: ["a", "b", "c"] },
    { searchFor: Infinity },
  ])
    assert.equal(
      visualSchema.safeParse({ ...source, ...patch }).success,
      false,
    );
  assert.ok(
    visualSchema.safeParse({
      ...source,
      detail: "absent",
      searchFor: undefined,
    }).success,
  );
  assert.ok(
    visualSchema.safeParse({
      type: "array",
      items: ["3", "8", "15"],
      mode: "highlight",
      detail: "trace",
      searchFor: 8,
      target: 1,
    }).success,
  );
  for (const patch of [
    { searchFor: 4 },
    { target: 0 },
    { searchFor: undefined },
  ])
    assert.equal(
      visualSchema.safeParse({
        type: "array",
        items: ["3", "8", "15"],
        mode: "highlight",
        detail: "trace",
        searchFor: 8,
        target: 1,
        ...patch,
      }).success,
      false,
    );
});

test("binary bound proofs handle both directions and trace summaries remain deterministic", () => {
  const render = (input: unknown, frame: number) => {
    const visual = visualSchema.parse(input);
    if (visual.type !== "array") throw new Error("Expected array");
    return renderToStaticMarkup(
      createElement(ArrayDetails, { visual, frame, accent: "#76C8AE" }),
    );
  };
  for (const [items, searchFor, emptyAt] of [
    [["3", "8", "15"], 14, 2],
    [["3", "8", "15"], 1, 0],
    [["3", "8", "15"], 16, 3],
  ] as const) {
    const input = {
      type: "array",
      items,
      mode: "highlight",
      detail: "bounds",
      searchFor,
      emptyAt,
      showPointer: false,
      showResult: false,
    };
    const start = render(input, 0),
      end = render(input, 60);
    assert.notEqual(start, end);
    assert.equal(end, render(input, 60));
    assert.doesNotMatch(end, /NaN|Infinity|undefined|animation:/);
    assert.match(end, /WHY THE SEARCH RANGE BECOMES EMPTY/);
  }
  const beat = dsaReelInput("binary-search").beats![14];
  const summary = render(beat.visual, 60);
  assert.match(summary, /3-CHECK TRACE SUMMARY \/ TARGET 43/);
  assert.match(summary, /29 &lt; 43/);
  assert.match(summary, /55 &gt; 43/);
  assert.match(summary, /42 &lt; 43/);
  assert.match(summary, /lo 6 &gt; hi 5 \/ no match/);
  assert.equal(dsaReelInput("binary-search").beats![12].visual.type, "array");
  assert.equal(dsaReelInput("binary-search").beats![13].visual.type, "array");
});

test("binary preparation and access proofs share their scoped cost counters", () => {
  const beats = dsaReelInput("binary-search").beats!;
  const preparation = beats[10],
    access = beats[11];
  for (const beat of [preparation, access]) {
    assert.equal(storyboardBeatSchema.safeParse(beat).success, true);
    assert.equal(beat.cost?.n, 5);
    assert.equal(beat.cost?.rows[0].to, 4);
    assert.equal(
      storyboardBeatSchema.safeParse({ ...beat, cost: { ...beat.cost, n: 9 } })
        .success,
      false,
    );
    assert.equal(
      storyboardBeatSchema.safeParse({
        ...beat,
        cost: { ...beat.cost, rows: [{ ...beat.cost!.rows[0], to: 5 }] },
      }).success,
      false,
    );
  }
  const render = (
    beat: typeof preparation,
    count: number,
    frame = 60,
  ): string => {
    if (beat.visual.type !== "array") throw new Error("Expected array proof");
    return renderToStaticMarkup(
      createElement(ArrayDetails, {
        visual: beat.visual,
        accent: "#5ECBB1",
        frame,
        count,
        countProgress: count,
      }),
    );
  };
  const before = render(preparation, 0),
    after = render(preparation, 4);
  assert.match(before, /data-sort-value="29" data-sort-slot="0"/);
  assert.match(after, /data-sort-value="29" data-sort-slot="4"/);
  assert.match(after, /data-sort-value="3" data-sort-slot="0"/);
  assert.match(after, /4 adjacent swaps/);
  assert.equal(after, render(preparation, 4, 200));
  assert.match(render(access, 0), /data-access-walk="0"/);
  assert.match(render(access, 4), /data-access-walk="4"/);
  assert.equal(render(access, 4), render(access, 4, 200));
  assert.doesNotMatch(
    after + render(access, 4),
    /NaN|Infinity|undefined|animation:/,
  );
});

const pointerExample = {
  type: "pointers",
  items: ["2", "4", "7", "11"],
  left: 0,
  right: 3,
  target: 9,
  sum: 13,
  status: "move-right",
  label: "Find a pair totaling 9",
};
const listExample = {
  type: "linked-list",
  nodes: [
    { id: "a", label: "First", next: "b" },
    { id: "b", label: "Second", next: "c" },
    { id: "c", label: "Third", next: null },
  ],
  head: "a",
  active: "b",
  label: "Follow the next pointer",
};
const graphExample = {
  type: "graph",
  nodes: [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
    { id: "c", label: "C" },
  ],
  edges: [
    { from: "a", to: "b" },
    { from: "a", to: "c" },
  ],
  visited: ["a"],
  frontier: ["b", "c"],
  active: "a",
  mode: "bfs",
  label: "Visit each reachable node",
};
const costExample = {
  n: 1_000_000,
  unit: "steps",
  focus: "O(1)",
  rows: [
    { label: "List scan", complexity: "O(n)", from: 0, to: 1_000_000 },
    { label: "Hash lookup", complexity: "O(1)", from: 0, to: 1, cue: "lookup" },
  ],
  note: "Worst-case scan; average hash lookup. Modeled operations, not timings.",
};

test("two-pointer diagrams reject incorrect arithmetic and invalid sorted bounds", () => {
  assert.ok(visualSchema.safeParse(pointerExample).success);
  assert.ok(
    visualSchema.safeParse({
      ...pointerExample,
      right: 2,
      sum: 9,
      status: "found",
    }).success,
  );
  for (const patch of [
    { sum: 12 },
    { left: -1 },
    { right: 4 },
    { left: 3, right: 1 },
    { left: 0, right: 0, sum: 4, target: 4, status: "found" },
    { left: 0.5 },
    { items: ["2", "11", "7", "4"] },
    { items: ["2", "four", "7", "11"] },
    { items: ["2", "4", "7", "Infinity"] },
    { target: Number.NaN },
    { target: Infinity },
    { sum: Infinity },
    { status: "found" },
    { status: "move-left" },
    { right: 2, sum: 9, target: 10, status: "move-right" },
  ]) {
    assert.equal(
      visualSchema.safeParse({ ...pointerExample, ...patch }).success,
      false,
      `Invalid two-pointer state: ${JSON.stringify(patch)}`,
    );
  }
});

test("pointer traces use distinct indices and stop at a match or an exhausted interval", () => {
  const items = ["2", "3", "4", "6", "8", "11"];
  assert.deepEqual(pointerTrace(items, 12), [
    { left: 0, right: 5, sum: 13 },
    { left: 0, right: 4, sum: 10 },
    { left: 1, right: 4, sum: 11 },
    { left: 2, right: 4, sum: 12 },
  ]);
  const absent = pointerTrace(items, 4);
  assert.equal(absent.length, items.length - 1);
  assert.ok(absent.every((pair) => pair.left < pair.right && pair.sum !== 4));
  assert.deepEqual(pointerTrace(["6", "6"], 12), [
    { left: 0, right: 1, sum: 12 },
  ]);
});

test("pointer moves retain the explained pair until its spoken decision and completed motion", () => {
  const beats = dsaReelInput("two-pointers").beats!;
  const render = (index: number, frame: number, count: number) =>
    renderToStaticMarkup(
      createElement(BeatVisual, {
        v: beats[index].visual,
        previous: beats[index - 1].visual,
        f: frame,
        d: 200,
        count,
        accent: "#76C8AE",
      }),
    );
  for (const frame of [-60, -1, 0, 9]) {
    const html = render(3, frame, 1);
    assert.match(html, /2 \+ 11 = 13/);
    assert.doesNotMatch(html, /2 \+ 8 = 10/);
  }
  const movedRight = render(3, 18, 1);
  assert.match(movedRight, /2 \+ 8 = 10/);
  assert.match(movedRight, /Every sum &gt; 12 \/ discard 11/);
  assert.doesNotMatch(render(5, -1, 2), /3 \+ 8 = 11/);
  assert.match(render(5, 18, 2), /3 \+ 8 = 11/);
});

test("a candidate sum is not presented as a completed success before the narrated check", () => {
  const beats = dsaReelInput("two-pointers").beats!;
  const beat = beats[7];
  const render = (count: number) =>
    renderToStaticMarkup(
      createElement(BeatVisual, {
        v: beat.visual,
        previous: beats[6].visual,
        f: 30,
        d: 200,
        count,
        accent: "#76C8AE",
      }),
    );
  const pending = render(3);
  assert.match(pending, /CURRENT CANDIDATE/);
  assert.match(pending, /pending/);
  assert.doesNotMatch(pending, /EXACT MATCH|Return indices/);
  const complete = render(4);
  assert.match(complete, /EXACT MATCH/);
  assert.match(complete, /Return indices 2 and 4 \/ total 12/);
  assert.doesNotMatch(complete, /pending/);
  const row = beat.cost!.rows[0];
  const captions = [
    { id: crypto.randomUUID(), text: "twelve", from: 60, to: 70 },
  ];
  assert.equal(costCount(row, 59, 200, captions), 3);
  assert.equal(costCount(row, 100, 200, captions), 4);
});

test("pointer teaching details show exact bounds and stay bounded at large n", () => {
  const beats = dsaReelInput("two-pointers").beats!;
  const source = beats[10].visual;
  for (const detail of [
    "pair",
    "elimination",
    "movement",
    "scale",
    "sorting",
    "setup",
    "combinations",
  ])
    for (const inputSize of [6, 1000, 1_000_000]) {
      const v = visualSchema.parse({ ...source, detail });
      const render = () =>
        renderToStaticMarkup(
          createElement(BeatVisual, {
            v,
            previous: v,
            inputSize,
            f: 90,
            d: 150,
            accent: "#76C8AE",
          }),
        );
      const html = render();
      assert.equal(html, render());
      assert.doesNotMatch(html, /NaN|Infinity|undefined|animation:/);
      assert.ok((html.match(/<rect/g) ?? []).length < 30);
      if (detail === "scale" && inputSize === 1000) {
        assert.match(html, />999</);
        assert.match(html, />499,500</);
        assert.match(html, /n\(n − 1\) \/ 2/);
      }
      if (detail === "sorting") {
        assert.match(html, /INPUT/);
        assert.match(html, /SORTED/);
        assert.match(html, /Efficient comparison sort/);
      }
      if (detail === "elimination")
        assert.doesNotMatch(html, /Every sum .* discard/);
    }
  assert.equal(
    visualSchema.safeParse({ ...source, detail: "arbitrary-code" }).success,
    false,
  );
});

test("pointer curriculum restores sample counts after its explicitly conditional no-match branch", () => {
  const beats = dsaReelInput("two-pointers").beats!;
  assert.equal(beats[3].visual.type, "pointers");
  if (beats[3].visual.type !== "pointers") throw new Error("Expected pointers");
  assert.equal(beats[3].visual.cue, "discard");
  assert.equal(beats[13].visual.type, "pointers");
  if (beats[13].visual.type !== "pointers")
    throw new Error("Expected pointers");
  assert.equal(beats[13].visual.status, "absent");
  assert.equal(beats[13].visual.target, 1);
  assert.equal(beats[13].cost!.n, 6);
  assert.equal(beats[13].cost!.rows[0].to, 5);
  assert.match(beats[13].cost!.note, /target-1 trace/);
  for (const beat of beats.slice(14)) {
    assert.equal(beat.cost!.n, 6);
    assert.equal(beat.cost!.rows[0].to, 4);
    assert.equal(beat.cost!.unit, "pair checks");
  }
});

test("pointer opening stages show a target and every distinct sample pair before the search", () => {
  const beats = dsaReelInput("two-pointers").beats!;
  const render = (index: number) =>
    renderToStaticMarkup(
      createElement(BeatVisual, {
        v: beats[index].visual,
        f: 100,
        d: 180,
        count: 0,
        accent: "#76C8AE",
      }),
    );
  const setup = render(0);
  assert.match(setup, /TARGET TOTAL/);
  assert.match(setup, /\? \+ \? = 12/);
  assert.doesNotMatch(setup, /2 \+ 11 = 13|data-pair-equation|>LEFT<|>RIGHT</);
  const choices = render(1);
  const pairs = Array.from(
    choices.matchAll(/data-choice="(\d+),(\d+)"/g),
    (match) => [Number(match[1]), Number(match[2])],
  );
  assert.equal(pairs.length, 15);
  assert.equal(new Set(pairs.map((pair) => pair.join(","))).size, 15);
  assert.ok(pairs.every(([left, right]) => left < right && right < 6));
  assert.doesNotMatch(choices, /data-pair-equation/);
  for (const beat of beats)
    if (beat.code?.lines[0].includes("prices[L]")) {
      assert.deepEqual(beat.code.lines, [
        "total = prices[L] + prices[R]",
        "if total == budget: return L, R",
        "if total < budget: L += 1",
        "else: R -= 1",
      ]);
    }
});

test("absent pointer diagrams require an exhausted no-match trace and never add the same item twice", () => {
  const source = dsaReelInput("two-pointers").beats![13].visual;
  if (source.type !== "pointers") throw new Error("Expected pointers");
  assert.ok(visualSchema.safeParse(source).success);
  assert.ok(
    visualSchema.safeParse({ ...source, target: 100, left: 5, right: 5 })
      .success,
  );
  for (const patch of [
    { target: 12 },
    { left: 1, right: 1 },
    { left: 0, right: 1 },
    { sum: 4 },
    { detail: "pair" },
    { status: "checking" },
  ])
    assert.equal(
      visualSchema.safeParse({ ...source, ...patch }).success,
      false,
      JSON.stringify(patch),
    );
  const html = renderToStaticMarkup(
    createElement(BeatVisual, {
      v: source,
      f: 90,
      d: 180,
      count: 5,
      accent: "#76C8AE",
    }),
  );
  assert.match(html, /NO DISTINCT PAIR LEFT/);
  assert.match(html, /L = R = 0/);
  assert.match(html, /5 FAILED CHECKS \/ RETURN NONE/);
  assert.equal((html.match(/data-failed-pair=/g) ?? []).length, 5);
  assert.doesNotMatch(html, /data-pair-equation|2 \+ 2|EXACT MATCH/);
});

test("linked-list rewiring accepts null tails and rejects dangling node references", () => {
  for (const rewire of [
    { from: "a", to: "c" },
    { from: "c", to: null },
  ])
    assert.ok(visualSchema.safeParse({ ...listExample, rewire }).success);
  for (const patch of [
    { head: "missing" },
    { active: "missing" },
    { nodes: [{ id: "a", label: "First", next: "missing" }] },
    { nodes: [listExample.nodes[0], listExample.nodes[0]] },
    { rewire: { from: "missing", to: "a" } },
    { rewire: { from: "a", to: "missing" } },
    { nodes: [] },
  ])
    assert.equal(
      visualSchema.safeParse({ ...listExample, ...patch }).success,
      false,
      `Invalid linked-list state: ${JSON.stringify(patch)}`,
    );
});

test("linked walks must follow the current next links and bind to an existing bounded row", () => {
  const visual = { ...listExample, walk: ["a", "b", "c"], costRow: 0 };
  const example = {
    text: "First, second, third.",
    visual,
    cost: {
      n: 3,
      unit: "node visits",
      focus: "O(n)",
      rows: [{ label: "Walk", complexity: "O(n)", from: 0, to: 3 }],
      note: "Illustrative traversal of three nodes",
    },
  };
  assert.ok(storyboardBeatSchema.safeParse(example).success);
  for (const walk of [[], ["a", "c"], ["a", "a"], ["c", "b"], ["missing"]])
    assert.equal(visualSchema.safeParse({ ...visual, walk }).success, false);
  assert.ok(
    visualSchema.safeParse({
      ...visual,
      walk: ["a", "c"],
      rewire: { from: "a", to: "c" },
    }).success,
  );
  assert.equal(
    visualSchema.safeParse({ ...visual, rewire: { from: "a", to: "c" } })
      .success,
    false,
  );
  for (const patch of [
    { cost: null },
    { visual: { ...visual, costRow: 1 } },
    { visual: { ...visual, walk: undefined } },
    { cost: { ...example.cost, unit: "pointer assignments" } },
    {
      cost: {
        ...example.cost,
        rows: [{ ...example.cost.rows[0], from: 0.5 }],
      },
    },
    {
      cost: {
        ...example.cost,
        rows: [{ ...example.cost.rows[0], to: 2.5 }],
      },
    },
    {
      cost: {
        ...example.cost,
        rows: [
          {
            ...example.cost.rows[0],
            events: [
              { cue: "First", value: 1.5 },
              { cue: "Third", value: 3 },
            ],
          },
        ],
      },
    },
    {
      cost: {
        ...example.cost,
        rows: [{ ...example.cost.rows[0], to: 4 }],
      },
    },
  ])
    assert.equal(
      storyboardBeatSchema.safeParse({ ...example, ...patch }).success,
      false,
    );
});

test("the linked-list name cues advance the actual visible traversal one node at a time", () => {
  const beat = dsaReelInput("linked-lists").beats!.find(
    (item) =>
      item.visual.type === "linked-list" &&
      item.text.startsWith("Intro. Beat. Drop. Outro."),
  )!;
  assert.ok(beat);
  const v = beat.visual;
  if (v.type !== "linked-list") throw new Error("Expected linked list");
  assert.deepEqual(v.walk, ["intro", "beat", "drop", "outro"]);
  const row = beat.cost!.rows[v.costRow!];
  assert.deepEqual(row.events, [
    { cue: "Intro", value: 1 },
    { cue: "Beat", value: 2 },
    { cue: "Drop", value: 3 },
    { cue: "Outro", value: 4 },
  ]);
  const captions = ["Intro", "Beat", "Drop", "Outro"].map((text, i) => ({
    id: crypto.randomUUID(),
    text,
    from: 10 + i * 30,
    to: 22 + i * 30,
  }));
  for (const [frame, count] of [
    [0, 1],
    [39, 1],
    [46, 2],
    [69, 2],
    [76, 3],
    [99, 3],
    [106, 4],
  ]) {
    assert.equal(costCount(row, frame, 150, captions), count);
    const html = renderToStaticMarkup(
      createElement(BeatVisual, {
        v,
        f: frame,
        d: 150,
        count,
        countProgress: costValue(row, frame, 150, captions),
        accent: "#8AB9E8",
      }),
    );
    const path = ["Intro", "Beat", "Drop", "Outro"].slice(0, count).join(" → ");
    assert.ok(html.includes(`>${path}</text>`));
    if (count < 4) assert.doesNotMatch(html, /Intro → Beat → Drop → Outro/);
    assert.doesNotMatch(html, /NaN|Infinity|undefined/);
  }
});

test("graph traversal states reject dangling edges and duplicate traversal entries", () => {
  assert.ok(visualSchema.safeParse(graphExample).success);
  assert.ok(visualSchema.safeParse({ ...graphExample, mode: "dfs" }).success);
  for (const patch of [
    { active: "missing" },
    { edges: [{ from: "missing", to: "a" }] },
    { edges: [{ from: "a", to: "missing" }] },
    { visited: ["missing"] },
    { frontier: ["missing"] },
    { visited: ["a", "a"] },
    { frontier: ["b", "b"] },
    { nodes: [graphExample.nodes[0], graphExample.nodes[0]] },
    { nodes: [] },
    { mode: "random" },
  ])
    assert.equal(
      visualSchema.safeParse({ ...graphExample, ...patch }).success,
      false,
      `Invalid graph state: ${JSON.stringify(patch)}`,
    );
});

test("cost panels require explicit bounded numeric examples and units", () => {
  assert.ok(costSchema.safeParse(costExample).success);
  assert.ok(costSchema.safeParse({ ...costExample, n: 0 }).success);
  for (const n of [-1, 1.5, 1_000_001, Infinity, Number.NaN])
    assert.equal(costSchema.safeParse({ ...costExample, n }).success, false);
  for (const field of ["from", "to"])
    for (const value of [-1, 1e15 + 1, Infinity, Number.NaN])
      assert.equal(
        costSchema.safeParse({
          ...costExample,
          rows: [{ ...costExample.rows[0], [field]: value }],
        }).success,
        false,
      );
  for (const patch of [
    { rows: [] },
    { rows: Array.from({ length: 3 }, () => costExample.rows[0]) },
    { unit: "" },
    { note: "" },
    { focus: "O(magic)" },
    { rows: [{ ...costExample.rows[0], complexity: "O(magic)" }] },
  ])
    assert.equal(
      costSchema.safeParse({ ...costExample, ...patch }).success,
      false,
    );
});

test("all five complexity classes use the fixed typed visual menu", () => {
  for (const focus of complexitySchema.options)
    assert.ok(
      visualSchema.safeParse({
        type: "complexity",
        focus,
        label: "Modeled work",
      }).success,
    );
  assert.equal(
    visualSchema.safeParse({
      type: "complexity",
      focus: "O(2^n)",
      label: "Work",
    }).success,
    false,
  );
});

test("call stacks constrain depth and accepted execution states", () => {
  const example = {
    type: "call-stack",
    calls: [
      { label: "factorial(3)", state: "waiting" },
      { label: "factorial(2)", state: "active" },
      { label: "factorial(1)", state: "returned", value: "1" },
    ],
    result: "6",
    label: "Calls return in reverse order",
  };
  assert.ok(visualSchema.safeParse(example).success);
  for (const calls of [
    [],
    Array.from({ length: 7 }, () => example.calls[0]),
    [{ label: "f(1)", state: "unknown" }],
  ])
    assert.equal(visualSchema.safeParse({ ...example, calls }).success, false);
});

test("cost data survives storyboard and timeline parsing while older scenes default safely", () => {
  const beat = storyboardBeatSchema.parse({
    text: "Look up one key.",
    visual: { type: "complexity", focus: "O(1)", label: "Average lookup" },
    cost: costExample,
  });
  assert.deepEqual(beat.cost, costExample);
  const scene = scriptTimeline(beat.text).scenes[0];
  assert.equal(scene.cost, null);
  assert.deepEqual(
    sceneSchema.parse({ ...scene, cost: beat.cost }).cost,
    costExample,
  );
  const legacyScene = { ...scene } as Partial<typeof scene>;
  delete legacyScene.cost;
  assert.equal(sceneSchema.parse(legacyScene).cost, null);
});

test("modeled growth values share correct input units and numerical bounds", () => {
  assert.deepEqual(
    complexitySchema.options.map((kind) => growthValue(kind, 16)),
    [1, 4, 16, 64, 256],
  );
  assert.equal(growthValue("O(n)", 1_000_000), 1_000_000);
  assert.equal(growthValue("O(n²)", 1_000_000), 1_000_000_000_000);
  assert.equal(Math.ceil(growthValue("O(log n)", 1_000_000)), 20);
  for (const kind of complexitySchema.options)
    for (const n of [1, 2, 16, 1_000_000]) {
      const value = growthValue(kind, n);
      assert.ok(Number.isFinite(value) && value >= 0);
    }
});

test("cost counters start at the narrated cue and settle without resetting held counts", () => {
  const row = costSchema.parse(costExample).rows[1];
  const captions = [
    { id: crypto.randomUUID(), from: 0, to: 25, text: "One" },
    { id: crypto.randomUUID(), from: 30, to: 48, text: "Lookup!" },
  ];
  const growing = { ...row, from: 10, to: 100 };
  for (const frame of [0, 15, 29, 30])
    assert.equal(costCount(growing, frame, 120, captions), 10);
  const middle = costCount(growing, 45, 120, captions);
  assert.ok(middle > 10 && middle < 100);
  assert.equal(costCount(growing, 66, 120, captions), 100);
  assert.equal(costCount(growing, 119, 120, captions), 100);
  for (const frame of [0, 7, 14]) {
    const held = { ...row, from: 3, to: 3, cue: undefined };
    assert.equal(costCount(held, frame, 15, []), 3);
  }
  assert.equal(costCount({ ...growing, cue: undefined }, 14, 15, []), 100);
  assert.equal(costCount(growing, 119, 120, []), 10);
  assert.equal(
    costCount({ ...growing, from: 100, to: 10 }, 119, 120, captions),
    10,
  );
});

test("named comparison events wait for each spoken name and reject impossible traces", () => {
  const example = {
    ...costExample,
    rows: [
      {
        label: "Contacts",
        complexity: "O(n)",
        from: 0,
        to: 3,
        events: [
          { cue: "Nova", value: 1 },
          { cue: "Jules", value: 2 },
          { cue: "Mina", value: 3 },
        ],
      },
    ],
  };
  const row = costSchema.parse(example).rows[0];
  const captions = ["Nova", "Jules", "Mina"].map((text, i) => ({
    id: crypto.randomUUID(),
    text,
    from: 10 + i * 30,
    to: 20 + i * 30,
  }));
  assert.equal(costCount(row, 119, 120, []), 0);
  assert.equal(costCount(row, 119, 120, [captions[0], captions[2]]), 1);
  for (const [frame, count] of [
    [0, 0],
    [9, 0],
    [16, 1],
    [39, 1],
    [46, 2],
    [69, 2],
    [76, 3],
    [119, 3],
  ])
    assert.equal(costCount(row, frame, 120, captions), count);
  assert.ok(
    costValue(row, 43, 120, captions) > 1 &&
      costValue(row, 43, 120, captions) < 2,
  );
  for (const events of [
    [{ cue: "Nova", value: 4 }],
    [
      { cue: "Nova", value: 2 },
      { cue: "Mina", value: 1 },
      { cue: "Jules", value: 3 },
    ],
    [
      { cue: "Nova", value: 1 },
      { cue: "Nova", value: 3 },
    ],
  ])
    assert.equal(
      costSchema.safeParse({ ...example, rows: [{ ...row, events }] }).success,
      false,
    );
});

test("an absent binary target never defaults to highlighting the last entry", () => {
  const v = visualSchema.parse({
    type: "array",
    items: ["2", "7", "11", "18", "29", "42", "55", "71", "89"],
    mode: "highlight",
    emptyAt: 6,
    showPointer: false,
    showResult: false,
    detail: "absent",
  });
  const html = renderToStaticMarkup(
    createElement(BeatVisual, { v, f: 60, d: 120, accent: "#38BDF8" }),
  );
  assert.match(html, /lo 6 &gt; hi 5/);
  assert.match(html, /not found/);
  assert.doesNotMatch(html, /background:#38BDF8/);
  assert.equal(
    visualSchema.safeParse({ ...v, showPointer: true }).success,
    false,
  );
  assert.equal(
    visualSchema.safeParse({ ...v, showResult: true }).success,
    false,
  );
});

test("new diagrams and cost panels render deterministically at short and normal scene frames", () => {
  const visuals: Visual[] = [
    visualSchema.parse(pointerExample),
    visualSchema.parse({ ...listExample, rewire: { from: "a", to: "c" } }),
    visualSchema.parse(graphExample),
    visualSchema.parse({
      type: "call-stack",
      calls: [
        { label: "f(3)", state: "waiting" },
        { label: "f(2)", state: "active" },
      ],
      label: "Call stack",
    }),
    visualSchema.parse({
      type: "complexity",
      focus: "O(n²)",
      label: "Work grows",
    }),
  ];
  for (const v of visuals)
    for (const [f, d] of [
      [0, 15],
      [7, 15],
      [14, 15],
      [0, 120],
      [60, 120],
      [119, 120],
    ]) {
      const render = () =>
        renderToStaticMarkup(
          createElement(BeatVisual, {
            v,
            previous: v,
            f,
            d,
            accent: "#38BDF8",
          }),
        );
      const html = render();
      assert.equal(html, render(), `${v.type} must depend only on frame/data`);
      assert.match(html, /<svg/);
      assert.doesNotMatch(html, /NaN|Infinity|undefined|animation:/);
    }
  const cost = costSchema.parse(costExample);
  const renderCost = (frame: number) =>
    renderToStaticMarkup(
      createElement(CostPanel, {
        cost,
        frame,
        duration: 120,
        captions: [],
        accent: "#38BDF8",
      }),
    );
  assert.equal(renderCost(60), renderCost(60));
  assert.notEqual(renderCost(0), renderCost(60));
  assert.match(renderCost(60), /1,000,000/);
  assert.match(renderCost(60), /key|steps/);
  assert.match(renderCost(60), /Worst-case scan/);
  assert.doesNotMatch(renderCost(60), /NaN|Infinity|undefined|animation:/);
});

test("all eight DSA lessons retain validated cost models and diagrams through the real create boundary", () => {
  assert.deepEqual(
    dsaReels.map((reel) => reel.id).sort(),
    [
      "hashmap",
      "binary-search",
      "big-o",
      "stacks-queues",
      "two-pointers",
      "linked-lists",
      "recursion",
      "bfs-dfs",
    ].sort(),
  );
  for (const reel of dsaReels) {
    const input = dsaReelInput(reel.id);
    assert.deepEqual(scriptIssues(input.content), [], reel.id);
    const timeline = timelineSchema.parse(
      applyStyle(
        scriptTimeline(input.content, input.aspect, input.duration),
        input,
      ),
    );
    assert.equal(timeline.scenes.length, reel.beats.length);
    assert.ok(timeline.scenes.every((scene) => scene.cost && scene.visual));
    assert.deepEqual(
      timeline.scenes.map((scene) => scene.cost),
      input.beats!.map((beat) => beat.cost),
    );
    for (const scene of timeline.scenes) {
      assert.ok(costSchema.safeParse(scene.cost).success, reel.id);
      assert.ok(visualSchema.safeParse(scene.visual).success, reel.id);
    }
  }
});

test("Big O proof states are typed, deterministic and bounded at large input sizes", () => {
  for (const detail of [
    "growth",
    "orders",
    "read",
    "pass",
    "pairs",
    "sort",
    "halving",
    "cases",
    "measure",
  ])
    for (const n of [2, 8, 16, 32, 1_000_000]) {
      const v = visualSchema.parse({
        type: "complexity",
        detail,
        focus: "O(n)",
        label: "Work grows",
        n,
      });
      assert.equal(v.type, "complexity");
      if (v.type !== "complexity")
        throw new Error("Expected complexity visual");
      const render = () =>
        renderToStaticMarkup(
          createElement(ComplexityProof, {
            v,
            f: 35,
            d: 90,
            accent: "#FBBF24",
            count: n,
            countProgress: n,
          }),
        );
      const html = render();
      assert.equal(html, render());
      assert.doesNotMatch(html, /NaN|Infinity|undefined|animation:/);
      assert.ok((html.match(/<rect/g) ?? []).length < 1100);
      if (n > 32 && !["halving", "cases", "measure"].includes(detail))
        assert.match(html, /FIRST 32 OF 1,000,000 INPUTS/);
    }
  assert.equal(
    visualSchema.safeParse({
      type: "complexity",
      detail: "generated-code",
      focus: "O(n)",
      label: "Work",
    }).success,
    false,
  );
});

test("the pair proof retains the old square and counts one cell per ordered pair", () => {
  const render = (n: number, count: number) => {
    const v = visualSchema.parse({
      type: "complexity",
      detail: "pairs",
      focus: "O(n²)",
      label: "All pairs",
      n,
    });
    if (v.type !== "complexity") throw new Error("Expected complexity visual");
    return renderToStaticMarkup(
      createElement(ComplexityProof, {
        v,
        f: 60,
        d: 120,
        accent: "#FBBF24",
        count,
      }),
    );
  };
  for (const [n, count] of [
    [8, 0],
    [8, 64],
    [16, 64],
    [16, 256],
    [32, 256],
    [32, 400],
    [32, 1024],
  ]) {
    const html = render(n, count);
    assert.equal((html.match(/data-pair=/g) ?? []).length, n * n);
    assert.equal((html.match(/data-counted="true"/g) ?? []).length, count);
    const counted = Array.from(
      html.matchAll(
        /<rect[^>]*data-pair="(\d+),(\d+)"[^>]*data-counted="true"/g,
      ),
    );
    if (count === 256 && n === 32)
      assert.ok(
        counted.every(
          ([, row, column]) => Number(row) < 16 && Number(column) < 16,
        ),
      );
  }
});

test("growth plots retain common axes while reads and passes show different work", () => {
  const render = (detail: string, n: number, count: number) => {
    const v = visualSchema.parse({
      type: "complexity",
      detail,
      n,
      focus: "O(n²)",
      label: "Work",
    });
    if (v.type !== "complexity") throw new Error("Expected complexity visual");
    return renderToStaticMarkup(
      createElement(ComplexityProof, {
        v,
        count,
        f: 60,
        d: 120,
        accent: "#FBBF24",
      }),
    );
  };
  const small = render("growth", 16, 256),
    large = render("growth", 32, 1024);
  assert.deepEqual(
    small.match(/<polyline[^>]+>/g),
    large.match(/<polyline[^>]+>/g),
  );
  assert.match(small, /n=16, work=256/);
  assert.match(large, /n=32, work=1,024/);
  assert.match(render("read", 8, 1), /1 indexed access/);
  const pass = render("pass", 16, 12);
  assert.equal((pass.match(/data-visited="true"/g) ?? []).length, 12);
  assert.match(pass, /12 of 16 orders visited/);
  assert.match(render("pass", 32, 96), /32 orders × 3 units = 96/);
  assert.match(render("pass", 32, 49), /49 units across 32 orders/);
});

test("halving shows actual reductions and case comparisons count the same linear search", () => {
  assert.deepEqual(halvingSteps(8), [8, 4, 2, 1]);
  assert.deepEqual(halvingSteps(9), [9, 5, 3, 2, 1]);
  assert.equal(halvingSteps(1_000_000).length - 1, 20);
  const render = (detail: string, n: number, count: number) => {
    const v = visualSchema.parse({
      type: "complexity",
      detail,
      n,
      focus: "O(n)",
      label: "Work",
    });
    if (v.type !== "complexity") throw new Error("Expected complexity visual");
    return renderToStaticMarkup(
      createElement(ComplexityProof, {
        v,
        count,
        f: 60,
        d: 180,
        accent: "#D9AE63",
      }),
    );
  };
  const halves = render("halving", 8, 3);
  assert.deepEqual(
    Array.from(halves.matchAll(/data-halving-count="(\d+)"/g), (match) =>
      Number(match[1]),
    ),
    [8, 4, 2, 1],
  );
  assert.match(halves, /3 \/ 3 reductions to one/);
  assert.match(halves, /NOT BINARY-SEARCH COMPARISONS/);
  const pending = render("cases", 32, 0);
  assert.equal((pending.match(/data-checked="true"/g) ?? []).length, 1);
  const scanned = render("cases", 32, 32);
  assert.equal((scanned.match(/data-checked="true"/g) ?? []).length, 33);
  assert.equal((scanned.match(/data-target="true"/g) ?? []).length, 2);
  assert.match(scanned, /An input distribution is needed before averaging/);
  const measure = render("measure", 32, 32);
  assert.match(measure, /elapsed = end − start/);
  assert.match(measure, /NO MEASURED TIMINGS SHOWN/);
  assert.doesNotMatch(measure, /\d+(?:\.\d+)? ?(?:ms|milliseconds|seconds)/);
});

test("discrete complexity operations agree with the cost counter during fractional tween frames", () => {
  for (const detail of ["cases", "pass", "pairs"]) {
    const n = detail === "pairs" ? 8 : 32;
    const row = costSchema.parse({
      n,
      unit: "modeled work units",
      focus: "O(n)",
      rows: [
        {
          label: "Work",
          complexity: "O(n)",
          from: 0,
          to: detail === "pairs" ? 64 : 32,
        },
      ],
      note: "Illustrative unit-cost model",
    }).rows[0];
    const v = visualSchema.parse({
      type: "complexity",
      detail,
      n,
      focus: "O(n)",
      label: "Work",
    });
    if (v.type !== "complexity") throw new Error("Expected complexity visual");
    for (let frame = 0; frame <= 36; frame++) {
      const count = costCount(row, frame, 90, []);
      const progress = costValue(row, frame, 90, []);
      const html = renderToStaticMarkup(
        createElement(ComplexityProof, {
          v,
          f: frame,
          d: 90,
          accent: "#D9AE63",
          count,
          countProgress: progress,
        }),
      );
      const marked =
        detail === "cases"
          ? /data-checked="true"/g
          : detail === "pass"
            ? /data-visited="true"/g
            : /data-counted="true"/g;
      assert.equal(
        (html.match(marked) ?? []).length,
        count + (detail === "cases" ? 1 : 0),
        `${detail} frame${frame}: progress${progress}`,
      );
    }
  }
});

test("Big O paragraphs bind halving, cases and timing to distinct proof states and counters", () => {
  const input = dsaReelInput("big-o");
  const beats = input.beats!;
  assert.equal(
    beats[4].visual.type === "complexity" && beats[4].visual.detail,
    "halving",
  );
  assert.equal(beats[4].cost!.rows[0].cue, "halve");
  assert.equal(beats[5].cost!.rows[0].cue, "Twice");
  assert.equal(beats[8].cost!.rows[1].cue, "doubles");
  assert.equal(
    beats[11].visual.type === "complexity" && beats[11].visual.detail,
    "cases",
  );
  assert.deepEqual(
    beats[11].cost!.rows.map((row) => row.to),
    [1, 32],
  );
  assert.equal(beats[11].cost!.rows[1].cue, "worst");
  assert.equal(
    beats[12].visual.type === "complexity" && beats[12].visual.detail,
    "measure",
  );
  assert.ok(
    beats[12].code!.lines.some((line) =>
      line.includes("perf_counter() - start"),
    ),
  );
  assert.ok(beats.every((beat) => beat.code));
  assert.ok(
    beats[13].code!.lines.some((line) => line.includes("compare(a, b)")),
  );
});
