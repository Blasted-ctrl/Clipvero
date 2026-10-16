import { createSchema } from "./model";
import { storyboardBeatSchema } from "@clipvero/video-engine/model";
import type { z } from "zod";

type Beat = z.input<typeof storyboardBeatSchema>;
type Cost = NonNullable<Beat["cost"]>;
type Growth = Cost["focus"];
type Row = Cost["rows"][number];
type Visual = Beat["visual"];

const shot = (mascotSide: "left" | "right" = "left") => ({
  mascotSide,
  camera: "wide" as const,
  reaction: null,
});
const row = (
  label: string,
  complexity: Growth,
  from: number,
  to = from,
  cue?: string,
  events?: Row["events"],
): Row => ({
  label,
  complexity,
  from,
  to,
  ...(cue ? { cue } : {}),
  ...(events ? { events } : {}),
});
const cost = (
  n: number,
  unit: string,
  focus: Growth,
  rows: Row[],
  note: string,
): Cost => ({ n, unit, focus, rows, note });
const beat = (
  text: string,
  panel: string,
  visual: Visual,
  options: Pick<Beat, "code" | "cost" | "presentation"> = {},
): Beat => ({ text, panel, visual, presentation: shot(), ...options });

/** A held counter keeps its last value instead of replaying on every sentence. */
function withCosts(initial: Cost, beats: Beat[]): Beat[] {
  let current = initial;
  return beats.map((item) => {
    current = item.cost ?? {
      ...current,
      rows: current.rows.map((r) => ({
        ...r,
        from: r.to,
        cue: undefined,
        events: undefined,
      })),
    };
    return {
      ...item,
      cost: current,
      visual:
        item.visual.type === "complexity"
          ? { ...item.visual, n: Math.max(2, current.n) }
          : item.visual,
    };
  });
}
const code = (lines: string[], highlight: number) => ({ lines, highlight });

const contacts = ["Nova", "Jules", "Mina", "Remy", "Kai"];
const contactNumbers = [
  "555-0101",
  "555-0102",
  "555-0103",
  "555-0104",
  "555-0105",
];
type HashDetail =
  | "route"
  | "chain"
  | "probing"
  | "scale"
  | "long-keys"
  | "worst-case"
  | "build"
  | "update"
  | "message";
const hashCode = (updated: boolean) => [
  `contacts['Mina'] = '${updated ? "555-0199" : "555-0103"}'`,
  "contacts['Remy'] = '555-0104'",
  "number = contacts['Mina']",
  `# '${updated ? "555-0199" : "555-0103"}'`,
];
const hashVisual = (
  key: "Mina" | "Remy",
  action: "insert" | "lookup" | "hold",
  collision = false,
  detail: HashDetail = collision ? "chain" : "route",
  updated = false,
): Visual => ({
  type: "hashmap",
  key,
  value: key === "Mina" ? (updated ? "555-0199" : "555-0103") : "555-0104",
  bucket: 2,
  action,
  detail,
  ...(detail === "update" ? { cue: "Assigning" } : {}),
  ...(detail === "probing" ? { cue: "probe" } : {}),
  ...(detail === "long-keys"
    ? { cue: "Hashing", longKey: "Mina_Wednesday_Study_Group" }
    : {}),
  ...(detail === "build" ? { cue: "Building" } : {}),
  ...(detail === "message"
    ? { cue: updated ? "hey" : "message", message: "hey" }
    : {}),
  chainOrder:
    detail === "worst-case"
      ? ["Nova", "Jules", "Remy", "Kai", "Mina"]
      : collision
        ? ["Remy", "Mina"]
        : [],
  entries:
    detail === "worst-case"
      ? contacts
          .filter((name) => name !== key)
          .map((name) => ({ key: name, bucket: 2 }))
      : [
          { key: "Nova", bucket: 0 },
          { key: "Jules", bucket: 1 },
          { key: "Kai", bucket: 5 },
          ...(collision
            ? [{ key: key === "Mina" ? "Remy" : "Mina", bucket: 2 }]
            : []),
        ],
});
const hashBeat = (
  text: string,
  key: "Mina" | "Remy" = "Mina",
  action: "insert" | "lookup" | "hold" = "hold",
  collision = false,
  change?: Cost,
  detail: HashDetail = collision ? "chain" : "route",
  updated = false,
  costRow?: number,
) =>
  beat(
    text,
    "contacts-table",
    {
      ...hashVisual(key, action, collision, detail, updated),
      ...(costRow !== undefined ? { costRow } : {}),
    },
    {
      code: code(
        detail === "build"
          ? [
              "contacts = {}",
              "for name, number in entries:",
              "    contacts[name] = number",
              "# n entries stored",
            ]
          : hashCode(updated),
        detail === "build"
          ? 2
          : detail === "update"
            ? 0
            : action === "insert"
              ? key === "Mina"
                ? 0
                : 1
              : 2,
      ),
      ...(change ? { cost: change } : {}),
    },
  );
const scanCost = (
  n: number,
  from: number,
  to = from,
  cue?: string,
  events?: Row["events"],
) =>
  cost(
    n,
    "key checks",
    "O(n)",
    [
      row("List scan", "O(n)", from, to, cue, events),
      row("Hash model", "O(1)", 1),
    ],
    "Illustrative model; hash average, fixed-size keys",
  );
const hashCost = (n: number, from = 1, to = 1, worst = false) =>
  cost(
    n,
    "key checks",
    worst ? "O(n)" : "O(1)",
    [
      row("List worst case", "O(n)", n),
      row(
        worst ? "Hash worst case" : "Hash model",
        worst ? "O(n)" : "O(1)",
        from,
        to,
      ),
    ],
    worst
      ? "Illustrative worst case; many colliding keys"
      : "Illustrative average model; hashing + load assumptions",
  );

const numbers = ["3", "8", "15", "21", "29", "42", "55", "68", "89"];
const searchCode = [
  "mid = (lo + hi) // 2",
  "if a[mid] == target: return mid",
  "elif a[mid] < target: lo = mid + 1",
  "else: hi = mid - 1",
];
const searchBeat = (
  text: string,
  step: number,
  highlight: number,
  change?: Cost,
  found = false,
  detail: NonNullable<Extract<Visual, { type: "array" }>["detail"]> = "halving",
) =>
  beat(
    text,
    "lobby-search",
    {
      type: "array",
      items: numbers,
      mode: "binary",
      target: 5,
      step,
      showResult: found,
      detail,
      ...(detail === "access" ||
      (detail === "sorted" && change?.unit === "adjacent swaps")
        ? { costRow: 0 }
        : {}),
      label: "9 SORTED LOBBIES",
    },
    { code: code(searchCode, highlight), ...(change ? { cost: change } : {}) },
  );
const searchCost = (from: number, to = from) =>
  cost(
    9,
    "entry checks",
    "O(log n)",
    [
      row("Binary search", "O(log n)", from, to),
      row("Linear worst case", "O(n)", 9),
    ],
    "Illustrative trace; one middle check per iteration",
  );

const structureBeat = (
  text: string,
  kind: "stack" | "queue",
  items: string[],
  action: "hold" | "add" | "remove",
  item?: string,
  change?: Cost,
  operation: "auto" | "list-front" | "empty-guard" = "auto",
  detail: Pick<
    Extract<Visual, { type: "structure" }>,
    "detail" | "cue" | "cues" | "costRow"
  > = {},
) =>
  beat(
    text,
    kind === "stack" ? "draft-history" : "boba-line",
    {
      type: "structure",
      kind,
      items,
      action,
      item,
      operation,
      ...detail,
      label:
        detail.detail === "large-list"
          ? "LIST FRONT REMOVAL / SCALE MODEL"
          : operation === "list-front"
            ? "LIST FRONT REMOVAL / REPLAY"
            : operation === "empty-guard"
              ? "EMPTY COLLECTION / GUARD EXAMPLE"
              : kind === "stack"
                ? "DRAFT HISTORY / NEWEST ON TOP"
                : "BOBA LINE / FIRST ARRIVAL FIRST",
    },
    {
      code: code(
        detail.detail === "large-list"
          ? [
              "line = list(range(1_000_000))",
              "line.pop(0)",
              "# 999,999 references shift",
            ]
          : operation === "list-front"
            ? [
                "line = ['Mina', 'Jules', 'You']",
                "line.pop(0)  # removes Mina",
                "# Jules and You shift left",
              ]
            : operation === "empty-guard"
              ? [
                  "if q:",
                  "    customer = q.popleft()",
                  "else:",
                  "    customer = None",
                ]
              : kind === "stack"
                ? [
                    "history.append(message)",
                    "message = history.pop()",
                    "# newest entry leaves first",
                  ]
                : [
                    "from collections import deque",
                    "q.append(customer)",
                    "customer = q.popleft()",
                  ],
        operation === "list-front"
          ? 1
          : operation === "empty-guard"
            ? 3
            : action === "add"
              ? kind === "stack"
                ? 0
                : 1
              : kind === "stack"
                ? 1
                : 2,
      ),
      cost:
        change ??
        cost(
          items.length,
          "modeled operations",
          "O(1)",
          [row("Stack end", "O(1)", 1), row("Deque end", "O(1)", 1)],
          "Illustrative model; amortized list ends; n before operation",
        ),
    },
  );

const prices = ["2", "3", "4", "6", "8", "11"];
const pointerCode = [
  "total = prices[L] + prices[R]",
  "if total == budget: return L, R",
  "if total < budget: L += 1",
  "else: R -= 1",
];
const pointerBeat = (
  text: string,
  left: number,
  right: number,
  status: "checking" | "move-left" | "move-right" | "found",
  highlight: number,
  change?: Cost,
  presentation: Pick<
    Extract<Visual, { type: "pointers" }>,
    "detail" | "cue"
  > = { detail: "pair" },
) =>
  beat(
    text,
    "snack-prices",
    {
      type: "pointers",
      items: prices,
      left,
      right,
      target: 12,
      sum: Number(prices[left]) + Number(prices[right]),
      status,
      label: "SNACK MENU / TARGET $12",
      ...presentation,
    },
    { code: code(pointerCode, highlight), ...(change ? { cost: change } : {}) },
  );
const pointerCost = (from: number, to = from, cue?: string) =>
  cost(
    6,
    "pair checks",
    "O(n)",
    [
      row("Two pointers", "O(n)", from, to, cue),
      row("All unique pairs", "O(n²)", 15),
    ],
    "Illustrative trace; sorted input, distinct indices",
  );

const playlist = [
  { id: "intro", label: "Intro", next: "beat", address: "0x140" },
  { id: "beat", label: "Beat", next: "outro", address: "0x820" },
  { id: "drop", label: "Drop", next: null, address: "0x2B0" },
  { id: "outro", label: "Outro", next: null, address: "0x5C0" },
];
const linkCode = [
  "new.next = current.next",
  "current.next = new",
  "# traverse: current = current.next",
  "# delete: current.next = new.next",
];
const linkedBeat = (
  text: string,
  active: string,
  stage: "original" | "prepared" | "inserted" | "removed" = "original",
  highlight = 2,
  change?: Cost,
  detail: "links" | "memory" | "scale" | "predecessor" = "links",
  motion: Pick<Extract<Visual, { type: "linked-list" }>, "walk" | "steps"> = {},
) =>
  beat(
    text,
    "playlist",
    {
      type: "linked-list",
      detail,
      head: "intro",
      active,
      ...(change?.unit === "node visits" &&
      change.n === 4 &&
      change.rows[0].to === 4
        ? { walk: ["intro", "beat", "drop", "outro"], costRow: 0 }
        : {}),
      nodes: playlist.map((node) => ({
        ...node,
        next:
          node.id === "drop" && stage !== "original"
            ? "outro"
            : node.id === "beat" && stage === "inserted"
              ? "drop"
              : node.next,
      })),
      ...(stage === "prepared"
        ? { rewire: { from: "drop", to: "outro" } }
        : stage === "inserted"
          ? { rewire: { from: "beat", to: "drop" } }
          : stage === "removed"
            ? { rewire: { from: "beat", to: "outro" } }
            : {}),
      label: "PLAYLIST / FOLLOW NEXT",
      ...motion,
      ...(motion.walk ? { costRow: 0 } : {}),
    },
    { code: code(linkCode, highlight), ...(change ? { cost: change } : {}) },
  );

const factorialCode = (input = 4, result = "24") => [
  "def fact(n):",
  "    if n <= 1: return 1",
  "    return n * fact(n - 1)",
  `fact(${input})${result ? `  # ${result}` : ""}`,
];
const callBeat = (
  text: string,
  depth: number,
  returned: boolean,
  highlight: number,
  change?: Cost,
  detail: Partial<
    Pick<
      Extract<Visual, { type: "call-stack" }>,
      "detail" | "cue" | "cues" | "returnStep" | "trace" | "expression"
    >
  > = {},
) =>
  beat(
    text,
    "seating-calls",
    {
      type: "call-stack",
      example: {
        label: "FOUR FRIENDS / FOUR SEATS",
        items: ["Mina", "Jules", "Nova", "Remy"],
      },
      expression: returned
        ? ["4! = 24 seating orders", "4 × 6", "4 × 3 × 2", "4 × 3 × 2 × 1"][
            depth - 1
          ]
        : [
            "4! = 4 × fact(3)",
            "fact(4) = 4 × fact(3)",
            "fact(3) = 3 × fact(2)",
            "fact(2) = 2 × fact(1)",
          ][depth - 1],
      calls: Array.from({ length: depth }, (_, i) => ({
        label: `fact(${4 - i})`,
        state: i === depth - 1 ? (returned ? "returned" : "active") : "waiting",
        ...(i === depth - 1 && returned
          ? { value: String([24, 6, 2, 1][i]) }
          : {}),
      })),
      ...(returned ? { result: String([24, 6, 2, 1][depth - 1]) } : {}),
      label: "FOUR FRIENDS / SEATING ORDERS",
      ...detail,
    },
    {
      code: code(
        factorialCode(
          4,
          returned && depth === 1 && !detail.returnStep ? "24" : "",
        ),
        highlight,
      ),
      ...(change ? { cost: change } : {}),
    },
  );
const largerCallBeat = (text: string, showIntegerCost = false) =>
  beat(
    text,
    "seating-calls",
    {
      type: "call-stack",
      label: "n=10 / DEEPEST 6 OF 10 CALLS",
      calls: Array.from({ length: 6 }, (_, i) => ({
        label: `fact(${6 - i})`,
        state: i === 5 ? "active" : "waiting",
      })),
    },
    {
      code: code(
        showIntegerCost
          ? [
              "# Integer sizes also grow:",
              "# 10! = 3628800",
              "# 20! = 2432902008176640000",
              "# Unit-cost omits digit work.",
            ]
          : factorialCode(10, "3628800"),
        2,
      ),
      cost: cost(
        10,
        "calls / frames",
        "O(n)",
        [row("Calls entered", "O(n)", 10), row("Peak frames", "O(n)", 10)],
        "Illustrative peak: 10 calls; deepest 6 shown; unit-cost arithmetic",
      ),
    },
  );
const callCost = (from: number, to = from, cue?: string) =>
  cost(
    4,
    "calls / frames",
    "O(n)",
    [
      row("Calls entered", "O(n)", from, to, cue),
      row("Peak frames", "O(n)", from, to, cue),
    ],
    "Illustrative trace; linear calls + stack, unit-cost arithmetic",
  );

const rooms = ["A", "B", "C", "D", "E", "F", "G"];
const edges = [
  { from: "A", to: "B" },
  { from: "A", to: "C" },
  { from: "B", to: "D" },
  { from: "B", to: "E" },
  { from: "C", to: "F" },
  { from: "C", to: "G" },
];
const graphBeat = (
  text: string,
  mode: "bfs" | "dfs",
  active: string,
  visited: string[],
  frontier: string[],
  change?: Cost,
  detail: "traversal" | "path" | "visited" | "growth" | "memory" = "traversal",
  steps?: Extract<Visual, { type: "graph" }>["steps"],
  cues?: string[],
) =>
  beat(
    text,
    "dungeon-map",
    {
      type: "graph",
      ...(cues ? { cues } : {}),
      detail,
      ...(steps ? { steps } : {}),
      ...(detail === "path" ? { path: ["A", "C", "F"] } : {}),
      nodes: rooms.map((id) => ({ id, label: id === "F" ? "F EXIT" : id })),
      edges,
      visited,
      frontier,
      active,
      mode,
      label:
        mode === "bfs"
          ? "BFS / NEAREST LAYER FIRST"
          : "DFS / FINISH ONE BRANCH",
    },
    {
      code: code(
        mode === "bfs"
          ? [
              "room = queue.popleft()",
              "for next in neighbors[room]:",
              "    if next not in seen:",
              "        seen.add(next)",
              "        queue.append(next)",
            ]
          : [
              "def visit(room):",
              "    seen.add(room)",
              "    for next in neighbors[room]:",
              "        if next not in seen:",
              "            visit(next)",
            ],
        0,
      ),
      ...(change ? { cost: change } : {}),
    },
  );
const graphCost = (
  bfs: number,
  dfs: number,
  focus: "bfs" | "dfs" = "bfs",
  from?: number,
  events?: Row["events"],
) =>
  cost(
    13,
    "rooms visited",
    "O(n)",
    [
      row(
        "BFS trace",
        "O(n)",
        focus === "bfs" ? (from ?? bfs) : bfs,
        bfs,
        undefined,
        focus === "bfs" ? events : undefined,
      ),
      row(
        "DFS trace",
        "O(n)",
        focus === "dfs" ? (from ?? dfs) : dfs,
        dfs,
        undefined,
        focus === "dfs" ? events : undefined,
      ),
    ],
    `Illustrative ${focus.toUpperCase()} trace; n = V + E = 7 + 6; adjacency lists`,
  );

export const dsaReels: {
  id: string;
  title: string;
  summary: string;
  sources: string[];
  beats: Beat[];
}[] = [
  {
    id: "hashmap",
    title: "Hash maps: stop scrolling for Mina",
    summary:
      "A contact lookup, a collision, and the conditions behind average constant time.",
    sources: [
      "https://docs.python.org/3/faq/design.html#how-are-dictionaries-implemented-in-cpython",
      "https://docs.python.org/3/tutorial/datastructures.html#dictionaries",
      "https://algs4.cs.princeton.edu/cheatsheet/",
    ],
    beats: withCosts(scanCost(5, 0), [
      beat(
        "Hey, you. Mina gave you her number. Please tell me you're not scrolling through every contact to find it.",
        "contact-list",
        {
          type: "array",
          items: contacts,
          values: contactNumbers,
          detail: "contacts",
          mode: "highlight",
          target: 2,
          showPointer: false,
          showResult: false,
          label: "FIND MINA / FIVE CONTACTS",
        },
        {
          cost: scanCost(5, 0),
          code: code(
            [
              "for name, number in contacts:",
              "    if name == 'Mina':",
              "        return number",
            ],
            0,
          ),
        },
      ),
      beat(
        "Nova. Jules. Mina. Three checks here. A missing name could make a plain list check every single entry.",
        "contact-list",
        {
          type: "array",
          items: contacts,
          values: contactNumbers,
          detail: "contacts",
          mode: "scan",
          target: 2,
          label: "LIST SCAN / FIND MINA",
          costRow: 0,
        },
        {
          cost: scanCost(5, 0, 3, undefined, [
            { cue: "Nova", value: 1 },
            { cue: "Jules", value: 2 },
            { cue: "Mina", value: 3 },
          ]),
          code: code(
            [
              "for name, number in contacts:",
              "    if name == 'Mina':",
              "        return number",
            ],
            1,
          ),
        },
      ),
      hashBeat(
        "A hash map keeps key and value pairs. Mina is our key. That fictional phone number is the value.",
        "Mina",
        "insert",
        false,
        hashCost(5),
      ),
      hashBeat(
        "Hash the name, then use the result to choose a bucket. These bucket numbers are illustrative, so follow the route.",
      ),
      hashBeat(
        "Ask for Mina again. The same key leads back to the same bucket. Compare the key and return her number.",
        "Mina",
        "lookup",
      ),
      hashBeat(
        "Number acquired. Sending a normal message is still your responsibility. The dictionary has done enough emotional labor.",
        "Mina",
        "hold",
        false,
        undefined,
        "message",
      ),
      hashBeat(
        "Now Remy lands in Mina's bucket. Different keys can share a hash bucket. We call that a collision.",
        "Remy",
        "insert",
        true,
      ),
      hashBeat(
        "Keep both entries. Compare full keys inside the bucket. Asking for Mina still needs Mina's number, never Remy's.",
        "Mina",
        "lookup",
        true,
        cost(
          5,
          "key checks",
          "O(1)",
          [
            row("List worst case", "O(n)", 5),
            row("This bucket", "O(1)", 0, 2, undefined, [
              { cue: "Compare", value: 1 },
              { cue: "Mina", value: 2 },
            ]),
          ],
          "Illustrative collision trace; two full-key checks",
        ),
        "chain",
        false,
        1,
      ),
      hashBeat(
        "This bucket uses a chain. Other hash tables probe nearby slots instead. Either approach must resolve the collision correctly.",
        "Mina",
        "hold",
        true,
        undefined,
        "probing",
      ),
      hashBeat(
        "With good hashing and controlled load, lookup takes constant time on average. O of one, assuming fixed-size keys.",
        "Mina",
        "hold",
        true,
        hashCost(5),
        "scale",
      ),
      hashBeat(
        "Scale to a million contacts. A worst-case list scan checks a million names. Our simplified average hash model stays at one unit.",
        "Mina",
        "lookup",
        true,
        cost(
          1000000,
          "modeled checks",
          "O(1)",
          [
            row("List worst case", "O(n)", 5, 1000000, "million"),
            row("Hash average model", "O(1)", 1),
          ],
          "Illustrative units, not a benchmark; average hash lookup",
        ),
        "scale",
      ),
      hashBeat(
        "That one is a teaching model, not a promise of one processor instruction. Hashing and comparing long keys also takes work.",
        "Mina",
        "hold",
        true,
        cost(
          26,
          "characters read",
          "O(n)",
          [
            row("Example long key", "O(n)", 0, 26, "Hashing"),
            row("Fixed Mina key", "O(1)", 4),
          ],
          "n = example key length; character reads, not processor instructions",
        ),
        "long-keys",
        false,
        0,
      ),
      hashBeat(
        "Enough collisions can make lookup linear in the worst case. O of n. Good implementations manage table growth and collision handling.",
        "Mina",
        "hold",
        true,
        hashCost(1000000, 1, 1000000, true),
        "worst-case",
      ),
      hashBeat(
        "Building the table costs time and memory. Repeated lookups can repay that preparation.",
        "Mina",
        "hold",
        true,
        cost(
          5,
          "entries",
          "O(n)",
          [
            row("Build insertions", "O(n)", 0, 5, undefined, [
              { cue: "Building", value: 1 },
              { cue: "table", value: 2 },
              { cue: "costs", value: 3 },
              { cue: "time", value: 4 },
              { cue: "memory", value: 5 },
            ]),
            row("Stored entries", "O(n)", 0, 5, undefined, [
              { cue: "Building", value: 1 },
              { cue: "table", value: 2 },
              { cue: "costs", value: 3 },
              { cue: "time", value: 4 },
              { cue: "memory", value: 5 },
            ]),
          ],
          "Illustrative five-entry build; average inserts, linear storage",
        ),
        "build",
        false,
        0,
      ),
      hashBeat(
        "In Python, a dictionary gives you this key-based lookup. Assigning the same key again updates its value.",
        "Mina",
        "hold",
        true,
        hashCost(5),
        "update",
        true,
      ),
      hashBeat(
        "Mina's number is right there. Your next challenge is writing hey exactly once. We can cover undo history after that.",
        "Mina",
        "hold",
        true,
        hashCost(5),
        "message",
        true,
      ),
    ]),
  },
  {
    id: "binary-search",
    title: "Binary search: find lobby 42",
    summary:
      "A sorted lobby list, three midpoint checks, and an honest million-entry comparison.",
    sources: [
      "https://docs.python.org/3/library/bisect.html",
      "https://algs4.cs.princeton.edu/cheatsheet/",
    ],
    beats: withCosts(searchCost(0), [
      searchBeat(
        "Your friend is camping in lobby forty two. Can we find them without checking every door?",
        0,
        0,
      ),
      searchBeat(
        "These numbers are sorted from small to large. That order lets binary search throw away a whole section safely.",
        0,
        0,
        undefined,
        false,
        "sorted",
      ),
      searchBeat(
        "Check the middle: twenty nine. Forty two is bigger, so the target cannot be here or anywhere to the left.",
        0,
        0,
        searchCost(0, 1),
      ),
      searchBeat(
        "Move the lower bound past that middle. Keep the right-hand section. Discarded lobbies stay discarded.",
        1,
        2,
      ),
      searchBeat(
        "The new middle is fifty five. That's too big. Our target must be earlier in the remaining section.",
        1,
        0,
        searchCost(1, 2),
      ),
      searchBeat(
        "Move the upper bound just before fifty five. Only forty two remains, but we still need to check it.",
        2,
        3,
      ),
      searchBeat(
        "Forty two matches. Three middle checks. Found the camper. They can blame the algorithm when you join their lobby.",
        2,
        1,
        searchCost(2, 3),
        true,
      ),
      searchBeat(
        "Binary means splitting the remaining search space into two parts. No need to convert these lobby numbers into binary digits.",
        2,
        1,
        undefined,
        true,
      ),
      searchBeat(
        "A million sorted entries need at most twenty middle checks with this usual search loop. Linear search can need a million.",
        2,
        1,
        cost(
          1000000,
          "entry checks",
          "O(log n)",
          [
            row("Binary worst case", "O(log n)", 3, 20, "twenty"),
            row("Linear worst case", "O(n)", 9, 1000000, "million"),
          ],
          "Illustrative worst-case iteration counts; sorted random access",
        ),
        true,
        "scale",
      ),
      searchBeat(
        "That growth is O of log n. Doubling a large list adds roughly one middle check, rather than doubling the search work.",
        2,
        1,
        undefined,
        true,
        "doubling",
      ),
      searchBeat(
        "Sorting an unsorted list takes extra work. Include that cost, especially for a single lookup.",
        2,
        1,
        cost(
          5,
          "adjacent swaps",
          "O(n²)",
          [row("Insertion swaps", "O(n²)", 0, 4, "Sorting")],
          "Five-entry preparation example; insertion swaps are quadratic worst case",
        ),
        true,
        "sorted",
      ),
      searchBeat(
        "This count assumes an array with efficient middle access. Walking to the middle of a linked list costs extra work.",
        2,
        0,
        cost(
          5,
          "access steps",
          "O(n)",
          [
            row("Links from head", "O(n)", 0, 4, "Walking"),
            row("Array address", "O(1)", 1),
          ],
          "Example access to index 4; link traversals versus one indexed access",
        ),
        true,
        "access",
      ),
      beat(
        "If the lower bound passes the upper bound, the target is absent. Stop searching. Ghost lobbies do not need infinite loops.",
        "lobby-search",
        {
          type: "array",
          items: numbers,
          mode: "highlight",
          showResult: false,
          showPointer: false,
          emptyAt: 6,
          searchFor: 43,
          detail: "bounds",
          label: "9-ENTRY EXAMPLE / TARGET 43",
        },
        {
          cost: searchCost(3),
          code: code(
            [
              "while lo <= hi:",
              "    mid = (lo + hi) // 2",
              "    # compare and move a bound",
              "return -1  # absent",
            ],
            3,
          ),
        },
      ),
      beat(
        "The plus one and minus one remove a middle we've already checked. Forget that detail and your bounds can get stuck.",
        "lobby-search",
        {
          type: "array",
          items: numbers,
          mode: "highlight",
          showResult: false,
          showPointer: false,
          emptyAt: 6,
          searchFor: 43,
          detail: "bounds",
          label: "9-ENTRY EXAMPLE / TARGET 43",
        },
        { code: code(searchCode, 2) },
      ),
      beat(
        "Try forty three next. It belongs between forty two and fifty five, but neither equals it. The search must return absent.",
        "lobby-search",
        {
          type: "array",
          items: numbers,
          mode: "highlight",
          showResult: false,
          showPointer: false,
          emptyAt: 6,
          searchFor: 43,
          detail: "absent",
          label: "42 < 43 < 55 / TARGET ABSENT",
        },
        { cost: searchCost(3) },
      ),
      beat(
        "Your friend picked the wrong hiding spot. An unsorted list would actually make your job harder.",
        "lobby-search",
        {
          type: "array",
          items: numbers,
          mode: "highlight",
          target: 5,
          searchFor: 42,
          detail: "trace",
          label: "JOINED LOBBY 42 / CAMPER FOUND",
        },
      ),
    ]),
  },
  {
    id: "big-o",
    title: "Big O: when your tiny app gets hungry",
    summary:
      "A snack-order dashboard makes constant, logarithmic, linear, linearithmic and quadratic growth visible.",
    sources: [
      "https://introcs.cs.princeton.edu/python/41analysis/",
      "https://aofa.cs.princeton.edu/10analysis/",
    ],
    beats: withCosts(
      cost(
        8,
        "modeled work units",
        "O(n)",
        [
          row("One pass", "O(n)", 0, 8),
          row("All ordered pairs", "O(n²)", 0, 64),
        ],
        "Illustrative growth functions; no measured timings",
      ),
      [
        beat(
          "Your snack app works for eight friends. Then the whole campus orders. Which part of your code is about to ruin lunch?",
          "growth-dashboard",
          {
            type: "complexity",
            detail: "orders",
            label: "SNACK ORDERS / GROWTH OF WORK",
            focus: "O(n)",
          },
          {
            code: code(
              ["n = len(orders)", "for order in orders:", "    pack(order)"],
              0,
            ),
          },
        ),
        beat(
          "Call the number of orders n. Big O describes an upper bound on how work grows as that input gets larger.",
          "growth-dashboard",
          {
            type: "complexity",
            detail: "growth",
            label: "SNACK ORDERS / GROWTH OF WORK",
            focus: "O(n)",
          },
          {
            code: code(
              ["n = len(orders)", "for order in orders:", "    pack(order)"],
              1,
            ),
          },
        ),
        beat(
          "Our bars use simplified work units. They show growth patterns, not seconds on a real machine. Keep that distinction in mind.",
          "growth-dashboard",
          {
            type: "complexity",
            detail: "growth",
            label: "SNACK ORDERS / GROWTH OF WORK",
            focus: "O(n)",
          },
          {
            code: code(
              [
                "# unit-cost growth model",
                "one_pass = n",
                "ordered_pairs = n * n",
              ],
              1,
            ),
          },
        ),
        beat(
          "Read one order at a known array index. The amount of work stays bounded as the array grows. That's O of one.",
          "growth-dashboard",
          {
            type: "complexity",
            detail: "read",
            label: "SNACK ORDERS / GROWTH OF WORK",
            focus: "O(1)",
          },
          {
            cost: cost(
              8,
              "modeled work units",
              "O(1)",
              [row("Direct access", "O(1)", 1), row("One pass", "O(n)", 8)],
              "Illustrative unit-cost model; known array index",
            ),
            code: code(
              ["order = orders[index]", "# known index, one access"],
              0,
            ),
          },
        ),
        beat(
          "Repeatedly halve the candidates in sorted data. That gives logarithmic growth. O of log n. The curve rises very slowly.",
          "growth-dashboard",
          {
            type: "complexity",
            detail: "halving",
            label: "SNACK ORDERS / GROWTH OF WORK",
            focus: "O(log n)",
          },
          {
            cost: cost(
              8,
              "modeled work units",
              "O(log n)",
              [
                row("Halvings to one", "O(log n)", 0, 3, "halve"),
                row("One pass", "O(n)", 8),
              ],
              "Illustrative halving model; not binary-search comparison counts",
            ),
            code: code(
              [
                "left = len(sorted_orders)",
                "while left > 1:",
                "    left = (left + 1) // 2",
              ],
              2,
            ),
          },
        ),
        beat(
          "Read every order once to total the snacks. Twice as many orders means about twice the work. That's linear, O of n.",
          "growth-dashboard",
          {
            type: "complexity",
            detail: "pass",
            label: "SNACK ORDERS / GROWTH OF WORK",
            focus: "O(n)",
          },
          {
            cost: cost(
              16,
              "modeled work units",
              "O(n)",
              [
                row("One pass", "O(n)", 8, 16, "Twice"),
                row("Direct access", "O(1)", 1),
              ],
              "Illustrative unit-cost growth; input doubled from 8 to 16",
            ),
            code: code(
              [
                "total = 0",
                "for order in orders:",
                "    total += order.quantity",
              ],
              2,
            ),
          },
        ),
        beat(
          "Efficient comparison sorting, such as merge sort, has O of n log n growth. More work than a pass, much less than checking every pair.",
          "growth-dashboard",
          {
            type: "complexity",
            detail: "sort",
            label: "SNACK ORDERS / GROWTH OF WORK",
            focus: "O(n log n)",
          },
          {
            cost: cost(
              16,
              "modeled work units",
              "O(n log n)",
              [
                row("n log2(n) model", "O(n log n)", 24, 64),
                row("One pass", "O(n)", 16),
              ],
              "Illustrative growth functions, not exact sorting comparisons",
            ),
            code: code(
              [
                "width = 1",
                "while width < n:",
                "    merge_all_runs(width)",
                "    width *= 2",
              ],
              2,
            ),
          },
        ),
        beat(
          "Now compare every order with every order, including itself. Sixteen times sixteen gives two hundred fifty six checks. Quadratic growth.",
          "growth-dashboard",
          {
            type: "complexity",
            detail: "pairs",
            label: "SNACK ORDERS / GROWTH OF WORK",
            focus: "O(n²)",
          },
          {
            cost: cost(
              16,
              "modeled work units",
              "O(n²)",
              [
                row("All ordered pairs", "O(n²)", 64, 256),
                row("One pass", "O(n)", 16),
              ],
              "Illustrative unit model; ordered pairs include self-pairs",
            ),
            code: code(
              [
                "for a in orders:",
                "    for b in orders:",
                "        compare(a, b)",
              ],
              2,
            ),
          },
        ),
        beat(
          "Double to thirty two orders. A pass doubles to thirty two units. The full pair grid quadruples to one thousand twenty four.",
          "growth-dashboard",
          {
            type: "complexity",
            detail: "pairs",
            label: "SNACK ORDERS / GROWTH OF WORK",
            focus: "O(n²)",
          },
          {
            cost: cost(
              32,
              "modeled work units",
              "O(n²)",
              [
                row("All ordered pairs", "O(n²)", 256, 1024, "quadruples"),
                row("One pass", "O(n)", 16, 32, "doubles"),
              ],
              "Illustrative unit model; same work per ordered pair",
            ),
            code: code(
              [
                "for a in orders:",
                "    for b in orders:",
                "        compare(a, b)",
              ],
              2,
            ),
          },
        ),
        beat(
          "Count the work inside your loops. Two nested loops are not automatically quadratic if the inner loop only does a fixed amount.",
          "growth-dashboard",
          {
            type: "complexity",
            detail: "pass",
            label: "SNACK ORDERS / GROWTH OF WORK",
            focus: "O(n)",
          },
          {
            code: code(
              [
                "for order in orders:",
                "    for label in range(3):",
                "        print_label(order)",
              ],
              1,
            ),
            cost: cost(
              32,
              "modeled work units",
              "O(n)",
              [
                row("Three per order", "O(n)", 96),
                row("One per order", "O(n)", 32),
              ],
              "Illustrative model; fixed factor 3, both linear growth",
            ),
          },
        ),
        beat(
          "Three passes are still linear. Constant factors matter to actual speed, even though the growth class drops that fixed multiplier.",
          "growth-dashboard",
          {
            type: "complexity",
            detail: "pass",
            label: "SNACK ORDERS / GROWTH OF WORK",
            focus: "O(n)",
          },
          {
            code: code(
              [
                "for _ in range(3):",
                "    for order in orders:",
                "        print_label(order)",
              ],
              0,
            ),
          },
        ),
        beat(
          "Also say which case you're analyzing. Best case, average case, and worst case can grow differently for the same algorithm.",
          "growth-dashboard",
          {
            type: "complexity",
            detail: "cases",
            label: "SNACK ORDERS / GROWTH OF WORK",
            focus: "O(n)",
          },
          {
            cost: cost(
              32,
              "entry checks",
              "O(n)",
              [
                row("Best case", "O(1)", 1),
                row("Worst case", "O(n)", 0, 32, "worst"),
              ],
              "Illustrative linear search; average needs an input distribution",
            ),
            code: code(
              [
                "for order in orders:",
                "    if order.id == target:",
                "        return order",
                "return None",
              ],
              1,
            ),
          },
        ),
        beat(
          "Big O does not guarantee the fastest option for every small input. Hardware, constants, data shape, and implementation still matter.",
          "growth-dashboard",
          {
            type: "complexity",
            detail: "measure",
            label: "SNACK ORDERS / GROWTH OF WORK",
            focus: "O(n)",
          },
          {
            cost: cost(
              32,
              "entry checks",
              "O(n)",
              [row("Best case", "O(1)", 1), row("Worst case", "O(n)", 32)],
              "Illustrative search checks; real elapsed time must be measured",
            ),
            code: code(
              [
                "start = perf_counter()",
                "process_orders(orders)",
                "elapsed = perf_counter() - start",
                "samples.append(elapsed)",
              ],
              2,
            ),
          },
        ),
        beat(
          "Your lunch app should measure real performance too. Use growth to spot the dangerous part before the cafeteria becomes a loading screen.",
          "growth-dashboard",
          {
            type: "complexity",
            detail: "pairs",
            label: "SNACK ORDERS / GROWTH OF WORK",
            focus: "O(n²)",
          },
          {
            cost: cost(
              32,
              "modeled work units",
              "O(n²)",
              [
                row("All ordered pairs", "O(n²)", 1024),
                row("One pass", "O(n)", 32),
              ],
              "Illustrative unit model; compare growth at 32 orders",
            ),
            code: code(
              [
                "for a in orders:",
                "    for b in orders:",
                "        compare(a, b)",
              ],
              2,
            ),
          },
        ),
      ],
    ).map((item) => ({
      ...item,
      presentation: { ...item.presentation, camera: "close" as const },
    })),
  },
  {
    id: "stacks-queues",
    title: "Stacks and queues: undo the cringe",
    summary:
      "Draft history and an original boba line explain exit order and implementation costs.",
    sources: [
      "https://docs.python.org/3/tutorial/datastructures.html#using-lists-as-stacks",
      "https://docs.python.org/3/library/collections.html#collections.deque",
    ],
    beats: withCosts(
      cost(
        3,
        "modeled operations",
        "O(1)",
        [row("Stack end", "O(1)", 1), row("Deque end", "O(1)", 1)],
        "Illustrative end-operation model; amortized list append/pop",
      ),
      [
        structureBeat(
          "Hey. Hey again. You up? Three drafts, three bad decisions. Hit undo before that last one escapes your phone.",
          "stack",
          ["hey", "hey x2", "u up?"],
          "hold",
          undefined,
          undefined,
          "auto",
          { detail: "draft-reveal", cues: ["Hey", "again", "up"] },
        ),
        structureBeat(
          "A stack removes the newest entry first. Put hey at the bottom. Push adds the next message on top.",
          "stack",
          [],
          "add",
          "hey",
        ),
        structureBeat(
          "Hey again lands above it. The earlier draft stays underneath, ready for when we undo the newer one.",
          "stack",
          ["hey"],
          "add",
          "hey x2",
        ),
        structureBeat(
          "You up goes on last. One more block. Your confidence is growing faster than your judgment.",
          "stack",
          ["hey", "hey x2"],
          "add",
          "u up?",
        ),
        structureBeat(
          "Pop removes you up first. Last in, first out. Undo restores the earlier draft without searching through every message.",
          "stack",
          ["hey", "hey x2", "u up?"],
          "remove",
        ),
        structureBeat(
          "Pop again and hey again leaves. The original hey survives. Newest first, every time.",
          "stack",
          ["hey", "hey x2"],
          "remove",
        ),
        structureBeat(
          "Now get boba. Mina arrived first. A queue keeps arrival order, so put her at the front of the line.",
          "queue",
          [],
          "add",
          "Mina",
        ),
        structureBeat(
          "Jules joins behind Mina. Enqueue adds to the back. Nobody gets to teleport ahead because their drink is simple.",
          "queue",
          ["Mina"],
          "add",
          "Jules",
        ),
        structureBeat(
          "You arrive last. Back of the line. Your main-character soundtrack does not change the data structure.",
          "queue",
          ["Mina", "Jules"],
          "add",
          "You",
        ),
        structureBeat(
          "Dequeue serves Mina first. First in, first out. Jules becomes the front, and your order is still waiting.",
          "queue",
          ["Mina", "Jules", "You"],
          "remove",
        ),
        structureBeat(
          "Python's deque supports efficient additions and removals at both ends. Use popleft for this queue, then append new arrivals.",
          "queue",
          ["Jules", "You"],
          "hold",
        ),
        structureBeat(
          "A Python list's pop zero shifts the remaining references. For three items, removing the first moves the other two.",
          "queue",
          ["Mina", "Jules", "You"],
          "remove",
          undefined,
          cost(
            3,
            "modeled work units",
            "O(n)",
            [
              row("List front shifts", "O(n)", 0, 2, undefined, [
                { cue: "remaining", value: 1 },
                { cue: "references", value: 2 },
              ]),
              row("Deque end model", "O(1)", 1),
            ],
            "Illustrative list reference shifts vs constant deque-end model",
          ),
          "list-front",
          { cue: "shifts", costRow: 0 },
        ),
        structureBeat(
          "Grow that list to a million items and a front removal shifts nine hundred ninety nine thousand nine hundred ninety nine references.",
          "queue",
          ["Jules", "You"],
          "hold",
          undefined,
          cost(
            1000000,
            "modeled work units",
            "O(n)",
            [
              row("List front shifts", "O(n)", 0, 999999, "shifts"),
              row("Deque end model", "O(1)", 1),
            ],
            "Illustrative n=1m list model; compressed indices show scale",
          ),
          "list-front",
          { detail: "large-list", costRow: 0 },
        ),
        structureBeat(
          "The exit rule and the implementation both matter. Stack ends can be cheap, and a queue needs an efficient front removal.",
          "queue",
          ["Jules", "You"],
          "hold",
          undefined,
          cost(
            2,
            "modeled operations",
            "O(1)",
            [row("Stack end", "O(1)", 1), row("Deque end", "O(1)", 1)],
            "Illustrative end-operation model; amortized list append/pop",
          ),
          "auto",
          { detail: "implementation", cues: ["Stack", "queue"] },
        ),
        structureBeat(
          "Check for an empty collection before removing. An absent message or missing customer cannot magically come out of the container.",
          "queue",
          [],
          "hold",
          undefined,
          cost(
            0,
            "modeled operations",
            "O(1)",
            [
              row("Guard check", "O(1)", 1),
              row("Removals attempted", "O(1)", 0),
            ],
            "Illustrative empty-queue example; no removal attempted",
          ),
          "empty-guard",
        ),
        structureBeat(
          "Jules gets served next. Your drink is finally close, and that terrible third text never left drafts. A productive afternoon.",
          "queue",
          ["Jules", "You"],
          "remove",
          undefined,
          cost(
            2,
            "modeled operations",
            "O(1)",
            [row("Stack end", "O(1)", 1), row("Deque end", "O(1)", 1)],
            "Illustrative end-operation model; two customers before serving",
          ),
          "auto",
          { detail: "draft-payoff", cues: ["third"] },
        ),
      ],
    ),
  },
  {
    id: "two-pointers",
    title: "Two pointers: snacks on a twelve-dollar budget",
    summary:
      "A sorted price list finds a pair with safe eliminations and an explicit sorting caveat.",
    sources: [
      "https://algs4.cs.princeton.edu/14analysis/",
      "https://introcs.cs.princeton.edu/java/41analysis/",
    ],
    beats: withCosts(pointerCost(0), [
      pointerBeat(
        "Twelve dollars. Two snacks. No borrowing from tomorrow. Which two prices on this sorted menu add up to your budget?",
        0,
        5,
        "checking",
        0,
        undefined,
        { detail: "setup" },
      ),
      pointerBeat(
        "Six items make fifteen unique pairs. Two pointers let the sorted order do more of the work.",
        0,
        5,
        "checking",
        0,
        undefined,
        { detail: "combinations" },
      ),
      pointerBeat(
        "Put left on the cheapest snack and right on the most expensive. Two plus eleven equals thirteen. Too much.",
        0,
        5,
        "checking",
        0,
        pointerCost(0, 1, "thirteen"),
      ),
      pointerBeat(
        "Even the cheapest partner makes eleven too expensive. Larger partners cost more, so discard that right-hand price.",
        0,
        4,
        "checking",
        3,
        undefined,
        { detail: "elimination", cue: "discard" },
      ),
      pointerBeat(
        "Two plus eight equals ten. Below twelve. We need an exact total today.",
        0,
        4,
        "checking",
        0,
        pointerCost(1, 2, "ten"),
      ),
      pointerBeat(
        "Two with any smaller partner would be cheaper still. Discard two. Move the left pointer right.",
        1,
        4,
        "checking",
        2,
        undefined,
        { detail: "elimination", cue: "Discard" },
      ),
      pointerBeat(
        "Three plus eight equals eleven. Still short. We can safely discard three for exactly the same reason.",
        1,
        4,
        "checking",
        0,
        pointerCost(2, 3, "eleven"),
        { detail: "elimination" },
      ),
      pointerBeat(
        "Move left once more. Four plus eight equals twelve. Four pair checks found lunch. Your wallet can relax for a minute.",
        2,
        4,
        "found",
        1,
        pointerCost(3, 4, "twelve"),
        { detail: "pair", cue: "Move" },
      ),
      pointerBeat(
        "Those eliminations rely on sorted prices. Without that order, moving a pointer could throw away the answer you wanted.",
        2,
        4,
        "checking",
        1,
        undefined,
        { detail: "sorting" },
      ),
      pointerBeat(
        "Each failed check moves one pointer inward. Neither backs up, so their combined movement is linear.",
        2,
        4,
        "checking",
        1,
        undefined,
        { detail: "movement" },
      ),
      pointerBeat(
        "For a thousand sorted prices, this loop uses at most nine hundred ninety nine pair checks. All unique pairs number four hundred ninety nine thousand five hundred.",
        2,
        4,
        "checking",
        1,
        cost(
          1000,
          "pair checks",
          "O(n)",
          [
            row("Pointer upper bound", "O(n)", 4, 999, "most"),
            row("All unique pairs", "O(n²)", 15, 499500, "pairs"),
          ],
          "Illustrative worst-case bounds; already sorted, distinct pairs",
        ),
        { detail: "scale" },
      ),
      pointerBeat(
        "That's O of n for the scan, using constant extra pointer space. The two selected indices must be different.",
        2,
        4,
        "checking",
        1,
        undefined,
        { detail: "movement" },
      ),
      pointerBeat(
        "If the prices arrive unsorted, sorting adds its own cost. A typical efficient comparison sort makes the combined approach O of n log n.",
        2,
        4,
        "checking",
        1,
        cost(
          1000,
          "modeled work units",
          "O(n log n)",
          [
            row("n log2(n) model", "O(n log n)", 9966),
            row("Pointer upper bound", "O(n)", 999),
          ],
          "Illustrative rounded growth model; sorting cost included",
        ),
        { detail: "sorting" },
      ),
      beat(
        "Stop when left meets right. No match means no solution. This problem requires two different items.",
        "snack-prices",
        {
          type: "pointers",
          items: prices,
          left: 0,
          right: 0,
          target: 1,
          sum: 0,
          status: "absent",
          detail: "absent",
          label: "SEPARATE CASE / TARGET 1",
        },
        {
          code: code(
            [
              "while L < R:",
              "    # compare two distinct items",
              "# L == R: no pair remains",
              "return None",
            ],
            3,
          ),
          cost: cost(
            6,
            "pair checks",
            "O(n)",
            [
              row("No-match branch", "O(n)", 5),
              row("All unique pairs", "O(n²)", 15),
            ],
            "Illustrative target-1 trace; five checks, then L and R meet",
          ),
        },
      ),
      pointerBeat(
        "Other two-pointer problems use different movement rules. Explain why your move preserves valid answers before copying the pattern.",
        2,
        4,
        "checking",
        1,
        pointerCost(4),
        { detail: "movement" },
      ),
      pointerBeat(
        "Four dollars and eight dollars. Two snacks, exactly twelve. You have optimized lunch. Handling the group order is a separate project.",
        2,
        4,
        "found",
        1,
        pointerCost(4),
      ),
    ]),
  },
  {
    id: "linked-lists",
    title: "Linked lists: fix the playlist without moving every song",
    summary:
      "A playlist inserts and removes a node while preserving its next links and honest search costs.",
    sources: [
      "https://www.cs.cornell.edu/courses/cs1114/2011sp/lectures/CS1114-lecture8_2up.pdf",
      "https://docs.python.org/3/faq/design.html#how-are-lists-implemented-in-cpython",
    ],
    beats: withCosts(
      cost(
        3,
        "modeled work units",
        "O(n)",
        [row("Find a node", "O(n)", 0), row("Known-node insert", "O(1)", 2)],
        "Illustrative model; node visits vs two pointer assignments",
      ),
      [
        linkedBeat(
          "Your playlist jumps from the beat straight to the outro. Where's the drop? Let's fix the links before everyone leaves.",
          "beat",
          "original",
          2,
          cost(
            3,
            "node visits",
            "O(n)",
            [
              row("Playback visits", "O(n)", 0, 2, undefined, [
                { cue: "beat", value: 1 },
                { cue: "outro", value: 2 },
              ]),
              row("Connected songs", "O(n)", 3),
            ],
            "Example playback follows Beat to Outro; Drop is detached",
          ),
          "links",
          { walk: ["beat", "outro"] },
        ),
        linkedBeat(
          "Each node stores a value and a reference to the next node. Follow the arrows to play.",
          "intro",
        ),
        linkedBeat(
          "Head points to Intro. Intro points to Beat. Beat points to Outro. Outro points to nothing, which marks the end.",
          "outro",
          "original",
          2,
          cost(
            3,
            "node visits",
            "O(n)",
            [
              row("Trace visits", "O(n)", 0, 3, undefined, [
                { cue: "Intro", value: 1 },
                { cue: "Beat", value: 2 },
                { cue: "Outro", value: 3 },
              ]),
              row("Connected songs", "O(n)", 3),
            ],
            "Follow the actual next links from HEAD to null",
          ),
          "links",
          { walk: ["intro", "beat", "outro"] },
        ),
        linkedBeat(
          "Nodes can live in different places in memory. Links define their order, without neighboring array positions.",
          "beat",
          "original",
          2,
          undefined,
          "memory",
        ),
        linkedBeat(
          "Create Drop. We already have Beat. First, make Drop point to Beat's current successor, Outro.",
          "drop",
          "original",
          0,
          cost(
            3,
            "pointer assignments",
            "O(1)",
            [
              row("Insert after known", "O(1)", 0, 1, undefined, [
                { cue: "First", value: 1 },
              ]),
              row("Full insertion", "O(1)", 2),
            ],
            "Illustrative pointer edits; current node already known",
          ),
          "links",
          { steps: [{ cue: "First", from: "drop", to: "outro" }] },
        ),
        linkedBeat(
          "Now make Beat point to Drop. Two assignments. The path is Intro, Beat, Drop, Outro. The old ending stays connected.",
          "beat",
          "prepared",
          1,
          cost(
            4,
            "pointer assignments",
            "O(1)",
            [
              row("Insert after known", "O(1)", 1, 2, undefined, [
                { cue: "Drop", value: 2 },
              ]),
              row("Full insertion", "O(1)", 2),
            ],
            "Illustrative pointer edits; current node already known",
          ),
          "links",
          { steps: [{ cue: "Drop", from: "beat", to: "drop" }] },
        ),
        linkedBeat(
          "Save the old next link before replacing it. Otherwise you can lose the rest of the playlist.",
          "drop",
          "inserted",
          0,
        ),
        linkedBeat(
          "Insertion after a known node is constant-time pointer work. Extra songs don't change those two assignments.",
          "drop",
          "inserted",
          1,
        ),
        linkedBeat(
          "Finding a node is separate. Start at the head and follow next to reach your song.",
          "intro",
          "inserted",
          2,
          cost(
            4,
            "node visits",
            "O(n)",
            [
              row("Find Outro", "O(n)", 0, 1),
              row("Worst-case visits", "O(n)", 4),
            ],
            "Illustrative singly linked traversal; no index jump",
          ),
        ),
        linkedBeat(
          "Intro. Beat. Drop. Outro. Four visits in this example. Asking for the last item can mean walking the whole list.",
          "outro",
          "inserted",
          2,
          cost(
            4,
            "node visits",
            "O(n)",
            [
              row("Find Outro", "O(n)", 1, 4, undefined, [
                { cue: "Intro", value: 1 },
                { cue: "Beat", value: 2 },
                { cue: "Drop", value: 3 },
                { cue: "Outro", value: 4 },
              ]),
              row("Worst-case visits", "O(n)", 4),
            ],
            "Illustrative singly linked traversal; no index jump",
          ),
        ),
        linkedBeat(
          "With a million nodes, that search can visit a million. O of n. Having a numeric position doesn't give direct array access.",
          "outro",
          "inserted",
          2,
          cost(
            1000000,
            "node visits",
            "O(n)",
            [
              row("List worst case", "O(n)", 4, 1000000, "million"),
              row("Array index model", "O(1)", 1),
            ],
            "Illustrative traversal vs known-index array access",
          ),
          "scale",
        ),
        linkedBeat(
          "To remove Drop when its predecessor is known, connect Beat straight to Outro. The removed node is now outside the playing chain.",
          "beat",
          "inserted",
          3,
          cost(
            4,
            "pointer assignments",
            "O(1)",
            [
              row("Bypass known node", "O(1)", 0, 1, undefined, [
                { cue: "connect", value: 1 },
              ]),
              row("Insert known node", "O(1)", 2),
            ],
            "Illustrative link edits; predecessor already known",
          ),
          "links",
          { steps: [{ cue: "connect", from: "beat", to: "outro" }] },
        ),
        linkedBeat(
          "Finding that predecessor can cost a traversal. Singly linked nodes don't automatically identify their predecessor.",
          "beat",
          "removed",
          3,
          cost(
            3,
            "node visits",
            "O(n)",
            [
              row("Find Beat", "O(n)", 0, 2, undefined, [
                { cue: "Finding", value: 1 },
                { cue: "traversal", value: 2 },
              ]),
              row("Worst-case visits", "O(n)", 3),
            ],
            "Example: walk from HEAD to find Beat before an edit",
          ),
          "predecessor",
          { walk: ["intro", "beat"] },
        ),
        linkedBeat(
          "Links also use memory, and scattered nodes can be less friendly to caches. Flexible insertion has tradeoffs. Pick for the operations you need.",
          "beat",
          "removed",
          3,
          undefined,
          "memory",
        ),
        linkedBeat(
          "All right, put the drop back. Save Outro as the new node's successor, then connect Beat to Drop again.",
          "drop",
          "removed",
          0,
          cost(
            3,
            "pointer assignments",
            "O(1)",
            [
              row("Insert after known", "O(1)", 0, 2, undefined, [
                { cue: "Save", value: 1 },
                { cue: "connect", value: 2 },
              ]),
              row("Full insertion", "O(1)", 2),
            ],
            "Illustrative pointer edits; current node already known",
          ),
          "links",
          {
            steps: [
              { cue: "Save", from: "drop", to: "outro" },
              { cue: "connect", from: "beat", to: "drop" },
            ],
          },
        ),
        linkedBeat(
          "The path is fixed. Intro, Beat, Drop, Outro. Your playlist finally builds to something, and the rest of the songs survived.",
          "beat",
          "inserted",
          1,
          cost(
            4,
            "node visits",
            "O(n)",
            [
              row("Playback visits", "O(n)", 0, 4, undefined, [
                { cue: "Intro", value: 1 },
                { cue: "Beat", value: 2 },
                { cue: "Drop", value: 3 },
                { cue: "Outro", value: 4 },
              ]),
              row("Connected songs", "O(n)", 4),
            ],
            "Repaired path: all four songs remain connected",
          ),
          "links",
          { walk: ["intro", "beat", "drop", "outro"] },
        ),
      ],
    ),
  },
  {
    id: "recursion",
    title: "Recursion: four friends cannot pick their seats",
    summary:
      "Four factorial descends through real call frames, reaches a base case, and unwinds to 24.",
    sources: [
      "https://courses.cis.cornell.edu/courses/cs2110/2026sp/lectures/lec06/",
      "https://www.cs.cornell.edu/courses/JavaAndDS/recursion/recursion.html",
    ],
    beats: withCosts(callCost(1), [
      callBeat(
        "Four friends. Four seats. Everyone wants to sit somewhere different. How many seating orders can this group chat argue about?",
        1,
        false,
        3,
        undefined,
        { detail: "seating", cues: ["seats", "different"] },
      ),
      callBeat(
        "Four factorial gives the answer: four times three times two times one. A recursive function hands smaller parts to itself.",
        1,
        false,
        2,
        callCost(1),
        { expression: "4! = 4 × 3 × 2 × 1" },
      ),
      callBeat(
        "Fact four needs four times fact three. Keep that unfinished multiplication in its call frame while the smaller call starts.",
        2,
        false,
        2,
        callCost(1, 2, "three"),
        { cue: "three" },
      ),
      callBeat(
        "Fact three needs three times fact two. Another frame waits with its own input and unfinished work.",
        3,
        false,
        2,
        callCost(2, 3, "two"),
        { cue: "two" },
      ),
      callBeat(
        "Fact two needs two times fact one. We're approaching an answer we can return without another call.",
        4,
        false,
        2,
        callCost(3, 4, "one"),
        { cue: "one" },
      ),
      callBeat(
        "At one, return one. That's the base case. With one friend and one seat, there's exactly one seating order.",
        4,
        true,
        1,
        undefined,
        { cue: "return", expression: "fact(1) = 1" },
      ),
      callBeat(
        "Unwind. Fact two gets one back, multiplies by two, and returns two. Its frame can leave.",
        3,
        true,
        2,
        undefined,
        {
          returnStep: {
            from: "fact(1)",
            to: "fact(2)",
            value: 1,
            multiplier: 2,
            result: 2,
          },
          cues: ["back", "returns"],
        },
      ),
      callBeat(
        "Fact three receives two. Three times two is six. Another finished frame returns its result.",
        2,
        true,
        2,
        undefined,
        {
          returnStep: {
            from: "fact(2)",
            to: "fact(3)",
            value: 2,
            multiplier: 3,
            result: 6,
          },
          cues: ["receives", "six"],
        },
      ),
      callBeat(
        "Fact four receives six. Four times six is twenty four seating orders. Somehow none will satisfy everyone.",
        1,
        true,
        3,
        undefined,
        {
          returnStep: {
            from: "fact(3)",
            to: "fact(4)",
            value: 6,
            multiplier: 4,
            result: 24,
          },
          cues: ["receives", "seating"],
        },
      ),
      callBeat(
        "Notice the two directions. Calls travel toward the base case. Results travel back through the unfinished work in reverse order.",
        1,
        true,
        3,
        undefined,
        {
          detail: "directions",
          cues: ["Calls", "Results"],
          trace: {
            calls: ["fact(4)", "fact(3)", "fact(2)", "fact(1)"],
            results: ["1", "2", "6", "24"],
          },
        },
      ),
      callBeat(
        "A recursive definition needs a stopping case and progress toward it. Calling with the same input forever only grows the stack.",
        1,
        true,
        1,
        undefined,
        {
          detail: "progress",
          cues: ["stopping", "same"],
          trace: {
            calls: ["fact(4)", "fact(3)", "fact(2)", "fact(1)"],
            results: ["1", "2", "6", "24"],
            repeated: "fact(4)",
          },
        },
      ),
      beat(
        "For nonnegative integers, this function handles zero by returning one. Validate inputs before applying the example to nonsense.",
        "seating-calls",
        {
          type: "call-stack",
          label: "ZERO FRIENDS / ONE EMPTY ARRANGEMENT",
          expression: "0! = 1 empty seating order",
          calls: [{ label: "fact(0)", state: "returned", value: "1" }],
          result: "1",
        },
        {
          code: code(factorialCode(0, "1"), 1),
          cost: cost(
            0,
            "calls / frames",
            "O(1)",
            [row("Calls entered", "O(1)", 1), row("Peak frames", "O(1)", 1)],
            "Base-case input n=0; one call and one frame",
          ),
        },
      ),
      largerCallBeat(
        "For input n, this simple version makes a linear number of calls and keeps a linear-depth stack. Both scale as O of n.",
      ),
      largerCallBeat(
        "Those counts treat arithmetic as a unit of work. Really large factorials contain huge integers, so multiplication cost grows as well.",
        true,
      ),
      beat(
        "A loop can compute this factorial with constant auxiliary state in that same model. Recursion is useful, but it is not automatically faster.",
        "seating-loop",
        {
          type: "code",
          language: "python",
          lines: [
            "# Same answer: 4! = 24",
            "result = 1",
            "for value in range(2, 5):",
            "    result *= value",
            "# result: 1 -> 2 -> 6 -> 24",
            "# Fixed local state: result + value",
          ],
          highlight: 3,
        },
        {
          cost: cost(
            4,
            "modeled state units",
            "O(1)",
            [
              row("Recursive peak", "O(n)", 4),
              row("Loop state group", "O(1)", 1),
            ],
            "One fixed-size local-state group; excludes big-integer size",
          ),
        },
      ),
      callBeat(
        "Twenty four seating orders. One restaurant reservation. Your function has returned. The group chat, unfortunately, is still running.",
        1,
        true,
        3,
        callCost(4),
        { detail: "seating", cues: ["orders", "running"] },
      ),
    ]),
  },
  {
    id: "bfs-dfs",
    title: "BFS and DFS: escape the dungeon politely",
    summary:
      "One room map shows queue-based layers, depth-first branches, and the limits of shortest-path claims.",
    sources: [
      "https://algs4.cs.princeton.edu/cheatsheet/",
      "https://algs4.cs.princeton.edu/41graph/",
    ],
    beats: withCosts(graphCost(0, 0), [
      graphBeat(
        "You're in room A. Exit F. Two search styles: check nearby rooms, or commit to a hallway.",
        "bfs",
        "A",
        [],
        ["A"],
      ),
      graphBeat(
        "Breadth-first search puts A in a queue. Visit A, then add unseen neighbors B and C.",
        "bfs",
        "A",
        ["A"],
        ["B", "C"],
        graphCost(1, 0, "bfs", 0, [{ cue: "Visit", value: 1 }]),
        "traversal",
        [
          { cue: "Visit", active: "A", visited: ["A"], frontier: [] },
          {
            cue: "neighbors",
            active: "A",
            visited: ["A"],
            frontier: ["B", "C"],
          },
        ],
      ),
      graphBeat(
        "Visit B next. Put D and E behind C. The queue keeps earlier discoveries ahead of later ones.",
        "bfs",
        "B",
        ["A", "B"],
        ["C", "D", "E"],
        graphCost(2, 0, "bfs", 1, [{ cue: "B", value: 2 }]),
        "traversal",
        [
          { cue: "B", active: "B", visited: ["A", "B"], frontier: ["C"] },
          {
            cue: "D",
            active: "B",
            visited: ["A", "B"],
            frontier: ["C", "D", "E"],
          },
        ],
      ),
      graphBeat(
        "Visit C. Add F and G. Rooms one door from A get processed before rooms two doors away.",
        "bfs",
        "C",
        ["A", "B", "C"],
        ["D", "E", "F", "G"],
        graphCost(3, 0, "bfs", 2, [{ cue: "C", value: 3 }]),
        "traversal",
        [
          {
            cue: "C",
            active: "C",
            visited: ["A", "B", "C"],
            frontier: ["D", "E"],
          },
          {
            cue: "Add",
            active: "C",
            visited: ["A", "B", "C"],
            frontier: ["D", "E", "F", "G"],
          },
        ],
      ),
      graphBeat(
        "D, E, F. Exit found. Parent links saved on discovery reconstruct the route A, C, F.",
        "bfs",
        "F",
        ["A", "B", "C", "D", "E", "F"],
        ["G"],
        graphCost(6, 0, "bfs", 3, [
          { cue: "D", value: 4 },
          { cue: "E", value: 5 },
          { cue: "F", value: 6 },
        ]),
        "path",
        [
          {
            cue: "D",
            active: "D",
            visited: ["A", "B", "C", "D"],
            frontier: ["E", "F", "G"],
          },
          {
            cue: "E",
            active: "E",
            visited: ["A", "B", "C", "D", "E"],
            frontier: ["F", "G"],
          },
          {
            cue: "F",
            active: "F",
            visited: ["A", "B", "C", "D", "E", "F"],
            frontier: ["G"],
          },
        ],
      ),
      graphBeat(
        "Two doors. On an unweighted graph, BFS finds a path with the fewest edges. Every door counts equally.",
        "bfs",
        "F",
        ["A", "B", "C", "D", "E", "F"],
        ["G"],
        undefined,
        "path",
      ),
      graphBeat(
        "Reset. Depth-first search starts at A and follows B before trying the other branch. We choose alphabetical neighbor order.",
        "dfs",
        "A",
        ["A"],
        ["A"],
        graphCost(6, 1, "dfs", 0, [{ cue: "starts", value: 1 }]),
        "traversal",
        [{ cue: "starts", active: "A", visited: ["A"], frontier: ["A"] }],
      ),
      graphBeat(
        "Visit B, then D. DFS keeps diving through unexplored neighbors, using recursion or a stack.",
        "dfs",
        "D",
        ["A", "B", "D"],
        ["A", "B", "D"],
        graphCost(6, 3, "dfs", 1, [
          { cue: "B", value: 2 },
          { cue: "D", value: 3 },
        ]),
        "traversal",
        [
          { cue: "B", active: "B", visited: ["A", "B"], frontier: ["A", "B"] },
          {
            cue: "D",
            active: "D",
            visited: ["A", "B", "D"],
            frontier: ["A", "B", "D"],
          },
        ],
      ),
      graphBeat(
        "D has no new neighbor. Backtrack to B, then explore E. Finish this branch before A's other hallway.",
        "dfs",
        "E",
        ["A", "B", "D", "E"],
        ["A", "B", "E"],
        graphCost(6, 4, "dfs", 3, [{ cue: "E", value: 4 }]),
        "traversal",
        [
          {
            cue: "B",
            active: "B",
            visited: ["A", "B", "D"],
            frontier: ["A", "B"],
          },
          {
            cue: "E",
            active: "E",
            visited: ["A", "B", "D", "E"],
            frontier: ["A", "B", "E"],
          },
        ],
      ),
      graphBeat(
        "Visit C, then F. Same exit, different visiting order. DFS can explore far away while nearby choices wait.",
        "dfs",
        "F",
        ["A", "B", "D", "E", "C", "F"],
        ["A", "C", "F"],
        graphCost(6, 6, "dfs", 4, [
          { cue: "C", value: 5 },
          { cue: "F", value: 6 },
        ]),
        "traversal",
        [
          {
            cue: "C",
            active: "C",
            visited: ["A", "B", "D", "E", "C"],
            frontier: ["A", "C"],
          },
          {
            cue: "F",
            active: "F",
            visited: ["A", "B", "D", "E", "C", "F"],
            frontier: ["A", "C", "F"],
          },
        ],
      ),
      graphBeat(
        "This tree has one route to each room. On general graphs with alternative routes, DFS does not guarantee the fewest-edge path.",
        "dfs",
        "F",
        ["A", "B", "D", "E", "C", "F"],
        ["A", "C", "F"],
      ),
      graphBeat(
        "Track visited rooms to stop cycles. For BFS, marking on discovery prevents duplicate queue entries too.",
        "bfs",
        "C",
        ["A", "B", "C", "D", "E", "F"],
        ["G"],
        graphCost(6, 6, "bfs"),
        "visited",
        [
          {
            cue: "cycles",
            active: "C",
            visited: ["A", "B", "C", "D", "E", "F"],
            frontier: ["G"],
          },
        ],
      ),
      graphBeat(
        "A complete traversal using adjacency lists takes O of V plus E time. V counts vertices, and E counts edges. Both searches share that bound.",
        "bfs",
        "G",
        rooms,
        [],
        cost(
          13,
          "modeled work units",
          "O(n)",
          [
            row("BFS V+E model", "O(n)", 0, 13),
            row("DFS V+E model", "O(n)", 0, 13),
          ],
          "Illustrative bound; n = V + E = 7 + 6, not measured visits",
        ),
        "growth",
        undefined,
        ["vertices", "edges"],
      ),
      graphBeat(
        "Our panel writes n for V plus E. An undirected edge appears in both adjacency lists, which changes constants, not this growth class.",
        "bfs",
        "G",
        rooms,
        [],
        undefined,
        "growth",
      ),
      graphBeat(
        "Both can need linear extra memory. BFS keeps a frontier; DFS keeps a stack. If edges have different costs, choose a suitable weighted-path algorithm.",
        "dfs",
        "F",
        ["A", "B", "D", "E", "C", "F"],
        ["A", "C", "F"],
        cost(
          7,
          "peak stored rooms",
          "O(n)",
          [
            row("BFS queue example", "O(n)", 0, 4, "frontier"),
            row("DFS stack example", "O(n)", 0, 3, "stack"),
          ],
          "This seven-room tree: queue peak 4, call-stack peak 3; space O(V)",
        ),
        "memory",
        undefined,
        ["frontier", "stack"],
      ),
      graphBeat(
        "For the fewest equal-cost doors, take BFS. For exploring an entire branch, DFS has you covered. Either way, stop opening the same cupboard.",
        "bfs",
        "F",
        ["A", "B", "C", "D", "E", "F"],
        ["G"],
        graphCost(6, 6, "bfs"),
        "path",
      ),
    ]),
  },
];

export function dsaReelInput(id: string) {
  const reel = dsaReels.find((r) => r.id === id);
  if (!reel) throw new Error("Choose an available DSA lesson.");
  return createSchema.parse({
    title: reel.title,
    mode: "script",
    content: reel.beats.map((b) => b.text).join("\n\n"),
    beats: reel.beats,
    duration: 120,
    voice: "free-cute",
    style: "explainer",
    tone: "Playful",
    rightsConfirmed: true,
  });
}
