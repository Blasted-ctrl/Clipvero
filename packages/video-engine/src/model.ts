import { z } from "zod";
const id = z.string().uuid();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const label = (max: number) => z.string().trim().min(1).max(max);
export const complexitySchema = z.enum([
  "O(1)",
  "O(log n)",
  "O(n)",
  "O(n log n)",
  "O(n²)",
]);
export const costSchema = z.object({
  n: z.number().int().min(0).max(1e6),
  unit: label(20),
  focus: complexitySchema,
  rows: z
    .array(
      z
        .object({
          label: label(20),
          complexity: complexitySchema,
          from: z.number().min(0).max(1e15),
          to: z.number().min(0).max(1e15),
          cue: label(24).optional(),
          events: z
            .array(
              z.object({ cue: label(24), value: z.number().min(0).max(1e15) }),
            )
            .min(1)
            .max(12)
            .optional(),
        })
        .refine(
          (row) =>
            !row.events ||
            (row.events.at(-1)?.value === row.to &&
              row.events.every(
                (event, i, events) =>
                  event.value >= Math.min(row.from, row.to) &&
                  event.value <= Math.max(row.from, row.to) &&
                  (row.to >= row.from
                    ? event.value >= (events[i - 1]?.value ?? row.from)
                    : event.value <= (events[i - 1]?.value ?? row.from)),
              ) &&
              new Set(row.events.map((event) => event.cue.toLowerCase()))
                .size === row.events.length),
          "Counter events must be unique, ordered and end at the declared total.",
        ),
    )
    .min(1)
    .max(2),
  note: label(80),
});
export type Cost = z.infer<typeof costSchema>;
export const presentationSchema = z.object({
  camera: z.enum(["wide", "close"]).default("wide"),
  mascotSide: z.enum(["left", "right"]).default("left"),
  reaction: z.string().trim().max(24).nullable().default(null),
});
export const codePanelSchema = z
  .object({
    lines: z.array(z.string().max(40)).min(1).max(10),
    highlight: z.number().int().nonnegative().optional(),
  })
  .refine(
    (p) => p.highlight === undefined || p.highlight < p.lines.length,
    "Highlight must point to an existing code line.",
  );
/**
 * What the explainer stage shows during one beat. A fixed menu of tested
 * components: script writers choose a type and fill in data, never code.
 */
export const visualSchema = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("complexity"),
      focus: complexitySchema,
      label: label(40),
      n: z.number().int().min(2).max(1e6).default(16),
      detail: z
        .enum([
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
        .default("growth"),
    }),
    z.object({
      type: z.literal("pointers"),
      items: z.array(label(12)).min(2).max(9),
      left: z.number().int().nonnegative(),
      right: z.number().int().nonnegative(),
      target: z.number().finite(),
      sum: z.number().finite(),
      status: z.enum([
        "checking",
        "move-left",
        "move-right",
        "found",
        "absent",
      ]),
      cue: label(24).optional(),
      detail: z
        .enum([
          "pair",
          "elimination",
          "movement",
          "scale",
          "sorting",
          "setup",
          "combinations",
          "absent",
        ])
        .default("pair"),
      label: label(40),
    }),
    z.object({
      type: z.literal("linked-list"),
      nodes: z
        .array(
          z.object({
            id: label(8),
            label: label(12),
            address: label(12).optional(),
            next: label(8).nullable(),
          }),
        )
        .min(1)
        .max(6),
      head: label(8),
      active: label(8),
      walk: z.array(label(8)).min(1).max(6).optional(),
      costRow: z.number().int().min(0).max(1).optional(),
      detail: z
        .enum(["links", "memory", "scale", "predecessor"])
        .default("links"),
      rewire: z.object({ from: label(8), to: label(8).nullable() }).optional(),
      steps: z
        .array(
          z.object({ cue: label(24), from: label(8), to: label(8).nullable() }),
        )
        .min(1)
        .max(4)
        .optional(),
      label: label(40),
    }),
    z.object({
      type: z.literal("call-stack"),
      detail: z
        .enum(["calls", "seating", "directions", "progress"])
        .default("calls"),
      cue: label(24).optional(),
      cues: z.array(label(24)).max(4).optional(),
      returnStep: z
        .object({
          from: label(16),
          to: label(16),
          value: z.number().int().min(0).max(1e9),
          multiplier: z.number().int().min(0).max(1000),
          result: z.number().int().min(0).max(1e12),
        })
        .optional(),
      trace: z
        .object({
          calls: z.array(label(16)).min(2).max(6),
          results: z.array(label(12)).min(2).max(6),
          repeated: label(16).optional(),
        })
        .optional(),
      calls: z
        .array(
          z.object({
            label: label(16),
            state: z.enum(["waiting", "active", "returned"]),
            value: label(12).optional(),
          }),
        )
        .min(1)
        .max(6),
      result: label(12).optional(),
      example: z
        .object({ label: label(28), items: z.array(label(12)).min(2).max(6) })
        .optional(),
      expression: label(40).optional(),
      label: label(40),
    }),
    z.object({
      type: z.literal("graph"),
      cues: z.array(label(24)).max(3).optional(),
      nodes: z
        .array(z.object({ id: label(8), label: label(8) }))
        .min(1)
        .max(7),
      edges: z.array(z.object({ from: label(8), to: label(8) })).max(12),
      visited: z.array(label(8)).max(7),
      frontier: z.array(label(8)).max(7),
      active: label(8),
      mode: z.enum(["bfs", "dfs"]),
      detail: z
        .enum(["traversal", "path", "visited", "growth", "memory"])
        .default("traversal"),
      path: z.array(label(8)).min(2).max(7).optional(),
      steps: z
        .array(
          z.object({
            cue: label(24),
            active: label(8),
            visited: z.array(label(8)).max(7),
            frontier: z.array(label(8)).max(7),
          }),
        )
        .min(1)
        .max(7)
        .optional(),
      label: label(40),
    }),
    z.object({
      type: z.literal("roster"),
      names: z.array(label(12)).min(2).max(6),
      target: z.number().int().min(0).max(5),
      found: z.boolean().default(false),
      label: label(36),
    }),
    z.object({
      type: z.literal("binary-grid"),
      label: label(36),
    }),
    z.object({
      type: z.literal("title"),
      text: label(28),
      number: z.string().max(3).optional(),
      subtitle: z.string().max(60).optional(),
    }),
    z.object({
      type: z.literal("chart"),
      focus: z
        .enum(["O(1)", "O(log n)", "O(n)", "O(n log n)", "O(n²)"])
        .optional(),
    }),
    z.object({
      type: z.literal("code"),
      language: z.string().max(16).default("python"),
      lines: z.array(z.string().max(48)).min(1).max(10),
      highlight: z.number().int().min(0).max(9).optional(),
    }),
    z.object({
      type: z.literal("terminal"),
      commands: z
        .array(
          z.object({
            cmd: label(48),
            output: z.array(z.string().max(48)).max(5).default([]),
          }),
        )
        .min(1)
        .max(3),
    }),
    z.object({
      type: z.literal("array"),
      items: z.array(label(12)).min(2).max(9),
      values: z.array(label(16)).min(2).max(9).optional(),
      mode: z.enum(["scan", "binary", "highlight"]).default("scan"),
      target: z.number().int().min(0).max(8).optional(),
      label: z.string().max(40).optional(),
      step: z.number().int().nonnegative().max(8).optional(),
      showResult: z.boolean().default(true),
      showPointer: z.boolean().default(true),
      costRow: z.number().int().min(0).max(1).optional(),
      emptyAt: z.number().int().min(0).max(9).optional(),
      searchFor: z.number().finite().optional(),
      detail: z
        .enum([
          "search",
          "halving",
          "scale",
          "doubling",
          "sorted",
          "access",
          "absent",
          "bounds",
          "trace",
          "contacts",
        ])
        .default("search"),
    }),
    z.object({
      type: z.literal("hashmap"),
      key: label(14),
      value: z.string().max(14).optional(),
      bucket: z.number().int().min(0).max(5),
      action: z.enum(["insert", "lookup", "hold"]).default("insert"),
      detail: z
        .enum([
          "route",
          "chain",
          "probing",
          "scale",
          "long-keys",
          "worst-case",
          "build",
          "update",
          "message",
        ])
        .default("route"),
      chainOrder: z.array(label(12)).max(6).default([]),
      longKey: label(48).optional(),
      message: label(40).optional(),
      costRow: z.number().int().min(0).max(1).optional(),
      cue: label(24).optional(),
      entries: z
        .array(
          z.object({ key: label(12), bucket: z.number().int().min(0).max(5) }),
        )
        .max(6)
        .default([]),
    }),
    z.object({
      type: z.literal("structure"),
      kind: z.enum(["stack", "queue"]),
      operation: z.enum(["auto", "list-front", "empty-guard"]).default("auto"),
      detail: z
        .enum([
          "none",
          "draft-reveal",
          "large-list",
          "implementation",
          "draft-payoff",
        ])
        .default("none"),
      cue: label(24).optional(),
      cues: z.array(label(24)).max(5).optional(),
      costRow: z.number().int().min(0).max(1).optional(),
      items: z.array(label(12)).max(5),
      action: z.enum(["hold", "add", "remove"]),
      item: label(12).optional(),
      label: label(40),
    }),
    z.object({
      type: z.literal("counter"),
      label: label(32),
      from: z.number().min(0).max(1e15),
      to: z.number().min(0).max(1e15),
      prefix: z.string().max(3).optional(),
      suffix: z.string().max(12).optional(),
    }),
    z.object({
      type: z.literal("flow"),
      steps: z.array(label(22)).min(2).max(5),
    }),
    z.object({
      type: z.literal("compare"),
      left: z.object({ title: label(18), points: z.array(label(28)).max(3) }),
      right: z.object({ title: label(18), points: z.array(label(28)).max(3) }),
      winner: z.enum(["left", "right", "none"]).default("none"),
    }),
  ])
  .superRefine((v, ctx) => {
    const invalid = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (v.type === "pointers") {
      const absent = v.status === "absent";
      if (
        (absent ? v.left !== v.right : v.left >= v.right) ||
        v.right >= v.items.length
      )
        invalid(
          absent
            ? "Exhausted pointers must meet at an existing index."
            : "Pointers must be distinct ordered existing indices.",
        );
      const numbers = v.items.map(Number);
      if (
        numbers.some(
          (n, i) => !Number.isFinite(n) || (i > 0 && n < numbers[i - 1]),
        )
      )
        invalid("Two-pointer values must be sorted numbers.");
      if (absent !== (v.detail === "absent"))
        invalid(
          "An absent result requires the absent proof detail and status.",
        );
      if (absent) {
        let left = 0,
          right = numbers.length - 1;
        while (left < right) {
          const sum = numbers[left] + numbers[right];
          if (sum === v.target) {
            invalid(
              "An absent search cannot contain a matching distinct pair.",
            );
            break;
          }
          if (sum < v.target) left++;
          else right--;
        }
        if (left !== right || v.left !== left)
          invalid(
            "Absent pointers must show the actual exhausted trace endpoint.",
          );
        if (v.sum !== 0)
          invalid(
            "An absent state has no pair sum; use zero and suppress the equation.",
          );
      } else if (numbers[v.left] + numbers[v.right] !== v.sum)
        invalid("The sum must match the pointed values.");
      if (v.status === "found" && v.sum !== v.target)
        invalid("Found pointers must equal the target.");
      if (
        (v.status === "move-left" && v.sum >= v.target) ||
        (v.status === "move-right" && v.sum <= v.target)
      )
        invalid("Pointer movement must follow the sum comparison.");
    }
    if (v.type === "linked-list" || v.type === "graph") {
      const ids = new Set(v.nodes.map((n) => n.id));
      if (ids.size !== v.nodes.length || !ids.has(v.active))
        invalid("Diagram node IDs must be unique and active must exist.");
      if (v.type === "linked-list") {
        if (
          !ids.has(v.head) ||
          v.nodes.some((n) => n.next !== null && !ids.has(n.next)) ||
          (v.rewire &&
            (!ids.has(v.rewire.from) ||
              (v.rewire.to !== null && !ids.has(v.rewire.to))))
        )
          invalid("Linked-list pointers must reference existing nodes.");
        if (
          v.steps &&
          (new Set(v.steps.map((step) => step.cue.toLowerCase())).size !==
            v.steps.length ||
            v.steps.some(
              (step) =>
                !ids.has(step.from) || (step.to !== null && !ids.has(step.to)),
            ))
        )
          invalid(
            "Narrated link changes need unique cues and existing node references.",
          );
        if (
          v.walk &&
          (new Set(v.walk).size !== v.walk.length ||
            v.walk.some(
              (node, i) =>
                !ids.has(node) ||
                (i > 0 &&
                  (v.rewire?.from === v.walk![i - 1]
                    ? v.rewire.to
                    : v.nodes.find((n) => n.id === v.walk![i - 1])?.next) !==
                    node),
            ))
        )
          invalid("A traversal must follow existing next pointers in order.");
      } else if (
        v.edges.some((e) => !ids.has(e.from) || !ids.has(e.to)) ||
        [...v.visited, ...v.frontier].some((n) => !ids.has(n)) ||
        new Set(v.visited).size !== v.visited.length ||
        new Set(v.frontier).size !== v.frontier.length
      )
        invalid(
          "Graph edges and traversal must reference unique existing nodes.",
        );
      if (v.type === "graph") {
        if (
          v.steps?.some(
            (step) =>
              !ids.has(step.active) ||
              [...step.visited, ...step.frontier].some((id) => !ids.has(id)) ||
              new Set(step.visited).size !== step.visited.length ||
              new Set(step.frontier).size !== step.frontier.length,
          )
        )
          invalid(
            "Every narrated traversal step must reference valid unique nodes.",
          );
        if (
          v.path?.some(
            (id, i, path) =>
              !ids.has(id) ||
              (i > 0 &&
                !v.edges.some(
                  (edge) =>
                    (edge.from === path[i - 1] && edge.to === id) ||
                    (edge.to === path[i - 1] && edge.from === id),
                )),
          )
        )
          invalid("A route must follow existing graph edges.");
      }
    }
    if (v.type === "roster" && v.target >= v.names.length)
      ctx.addIssue({ code: "custom", message: "Roster target must exist." });
    if (v.type === "array" && v.values && v.values.length !== v.items.length)
      invalid("Array value labels must match the visible item count.");
    if (
      v.type === "array" &&
      v.emptyAt !== undefined &&
      (v.emptyAt > v.items.length || v.showResult || v.showPointer)
    )
      invalid(
        "An empty search range cannot show a candidate or successful result.",
      );
    if (
      v.type === "array" &&
      ["bounds", "absent", "trace"].includes(v.detail)
    ) {
      if (
        (v.detail === "bounds" || v.detail === "trace") &&
        v.searchFor === undefined
      )
        invalid("A binary-search proof needs its numeric target value.");
      if (v.searchFor !== undefined) {
        const values = v.items.map(Number);
        if (
          v.items.some((item) => !item.trim()) ||
          values.some(
            (value, i) =>
              !Number.isFinite(value) || (i > 0 && value < values[i - 1]),
          )
        )
          invalid(
            "A binary-search proof needs finite numeric items in sorted order.",
          );
        const found = values.indexOf(v.searchFor);
        const next = values.findIndex((value) => value > v.searchFor!);
        const insertion = next < 0 ? values.length : next;
        if (
          v.detail === "trace" &&
          (found < 0 ||
            (v.target !== undefined && values[v.target] !== v.searchFor))
        )
          invalid(
            "A successful search trace must point to its matching target.",
          );
        if (
          (v.detail === "bounds" || v.detail === "absent") &&
          (found >= 0 || v.emptyAt !== insertion)
        )
          invalid(
            "An absent search proof must use the correct empty range for its target.",
          );
      }
    }
    if (v.type === "hashmap") {
      const keys = new Set([
        v.key,
        ...v.entries.filter((e) => e.bucket === v.bucket).map((e) => e.key),
      ]);
      if (
        new Set(v.chainOrder).size !== v.chainOrder.length ||
        v.chainOrder.some((key) => !keys.has(key))
      )
        invalid("Chain order must reference unique keys in the active bucket.");
    }
    if (
      v.type === "array" &&
      v.target !== undefined &&
      v.target >= v.items.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Array target must be an existing index.",
      });
    if (
      v.type === "code" &&
      v.highlight !== undefined &&
      v.highlight >= v.lines.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Code highlight must be an existing line.",
      });
    if (
      v.type === "structure" &&
      ((v.action === "add" && (!v.item || v.items.length >= 5)) ||
        (v.action === "remove" && !v.items.length))
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Add needs an item and a free slot; remove needs a nonempty structure.",
      });
    if (
      v.type === "structure" &&
      v.operation === "empty-guard" &&
      (v.items.length !== 0 || v.action !== "hold")
    )
      invalid("The empty guard requires an empty held collection.");
    if (
      v.type === "structure" &&
      v.operation === "list-front" &&
      v.kind !== "queue"
    )
      invalid("Front removal belongs to the queue/list illustration.");
    if (v.type === "structure") {
      if (
        v.detail === "draft-reveal" &&
        (v.kind !== "stack" ||
          v.action !== "hold" ||
          v.cues?.length !== v.items.length)
      )
        invalid(
          "Draft reveals need a held stack and one spoken cue for each item.",
        );
      if (
        v.detail === "large-list" &&
        (v.kind !== "queue" ||
          v.operation !== "list-front" ||
          v.action !== "hold" ||
          v.costRow === undefined)
      )
        invalid(
          "Large-list proofs need a held list-front model and bound cost row.",
        );
      if (
        (v.detail === "implementation" || v.detail === "draft-payoff") &&
        v.kind !== "queue"
      )
        invalid("Queue comparison and draft payoff details require a queue.");
    }
    if (v.type === "call-stack") {
      if (
        v.returnStep &&
        (v.returnStep.value * v.returnStep.multiplier !== v.returnStep.result ||
          v.result !== String(v.returnStep.result) ||
          v.calls.at(-1)?.label !== v.returnStep.to ||
          v.cues?.length !== 2)
      )
        invalid(
          "A return step needs matching arithmetic, final caller/result and receive/result cues.",
        );
      if (
        v.detail === "seating" &&
        (!v.example || v.example.items.length < 4 || v.cues?.length !== 2)
      )
        invalid(
          "Seating detail needs original people and two arrangement cues.",
        );
      if (
        (v.detail === "directions" || v.detail === "progress") &&
        (!v.trace ||
          v.trace.calls.length !== v.trace.results.length ||
          v.cues?.length !== 2 ||
          (v.detail === "progress" && !v.trace.repeated))
      )
        invalid(
          "Call-direction and progress proofs need matching bounded traces and two spoken cues.",
        );
    }
  });
export type Visual = z.infer<typeof visualSchema>;
function validCostBinding(value: { visual: Visual | null; cost: Cost | null }) {
  const v = value.visual;
  if (
    (v?.type !== "array" &&
      v?.type !== "hashmap" &&
      v?.type !== "linked-list" &&
      v?.type !== "structure") ||
    v.costRow === undefined
  )
    return true;
  const row = value.cost?.rows[v.costRow];
  if (
    !row ||
    !Number.isInteger(row.from) ||
    !Number.isInteger(row.to) ||
    row.events?.some((event) => !Number.isInteger(event.value))
  )
    return false;
  if (v.type === "structure") {
    const n = v.detail === "large-list" ? value.cost?.n : v.items.length;
    return Boolean(
      v.operation === "list-front" &&
      n !== undefined &&
      n >= 1 &&
      row.from === 0 &&
      row.to === n - 1 &&
      row.complexity === "O(n)",
    );
  }
  if (v.type === "linked-list")
    return Boolean(
      value.cost?.unit === "node visits" &&
      v.walk &&
      row.from <= v.walk.length &&
      row.to <= v.walk.length,
    );
  if (v.type === "hashmap") {
    const maximum =
      v.detail === "long-keys" ? Array.from(v.longKey ?? v.key).length : 6;
    return Boolean(
      row &&
      row.from <= maximum &&
      row.to <= maximum &&
      (v.detail !== "long-keys" ||
        (value.cost?.n === maximum && value.cost.unit === "characters read")),
    );
  }
  if (v.detail === "sorted" || v.detail === "access")
    return Boolean(
      value.cost?.n === 5 &&
      row.from <= 4 &&
      row.to <= 4 &&
      (v.detail === "sorted"
        ? value.cost.unit === "adjacent swaps"
        : value.cost.unit === "access steps"),
    );
  return Boolean(
    row &&
    v.mode === "scan" &&
    (v.detail !== "contacts" || row.to <= (v.target ?? 0) + 1) &&
    value.cost?.n === v.items.length &&
    row.from <= v.items.length &&
    row.to <= v.items.length,
  );
}
export const storyboardBeatSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1)
      .max(1600)
      .refine(
        (text) => !/\n\s*\n/.test(text),
        "Keep each storyboard beat in one paragraph.",
      ),
    chapter: z.string().max(24).nullable().default(null),
    panel: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,40}$/)
      .nullable()
      .default(null),
    code: codePanelSchema.nullable().default(null),
    cost: costSchema.nullable().default(null),
    presentation: presentationSchema.nullable().default(null),
    visual: visualSchema,
  })
  .refine(
    validCostBinding,
    "Bind a scan to an existing cost row counting this array's elements.",
  );
export const sceneSchema = z
  .object({
    id,
    script: z.string().max(1600),
    caption: z.string().max(1600),
    durationFrames: z.number().int().min(15).max(5400),
    background: color,
    assetId: id.nullable(),
    narrationId: id.nullable(),
    sourceVolume: z.number().min(0).max(1).default(0),
    captions: z
      .array(
        z.object({
          id,
          from: z.number().int().nonnegative(),
          to: z.number().int().positive(),
          text: z.string().max(500),
        }),
      )
      .max(200)
      .default([]),
    mediaStart: z.number().min(0).max(14400),
    transition: z.enum(["cut", "fade"]),
    fit: z.enum(["cover", "contain"]),
    // Conversation videos: index into timeline.speakers for who says this line.
    speaker: z.number().int().min(0).max(1).nullable().default(null),
    visual: visualSchema.nullable().default(null),
    chapter: z.string().max(24).nullable().default(null),
    panel: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,40}$/)
      .nullable()
      .default(null),
    code: codePanelSchema.nullable().default(null),
    cost: costSchema.nullable().default(null),
    presentation: presentationSchema.nullable().default(null),
  })
  .refine(
    (s) => s.captions.every((c) => c.from < c.to && c.to <= s.durationFrames),
    "Caption timestamps must fit inside their scene.",
  )
  .refine(
    validCostBinding,
    "Bind a scan to an existing cost row counting this array's elements.",
  );
export const timelineSchema = z
  .object({
    schemaVersion: z.literal(1),
    fps: z.literal(30),
    aspect: z.enum(["9:16", "1:1", "16:9"]),
    fontSize: z.number().int().min(24).max(100),
    captionColor: color,
    accentColor: color,
    captionPosition: z.enum(["center", "bottom"]),
    musicAssetId: id.nullable(),
    musicVolume: z.number().min(0).max(1),
    // "explainer" adds an animated background, word-by-word captions and a mascot.
    style: z.enum(["classic", "explainer", "conversation"]).default("classic"),
    backgroundAssetId: id.nullable().default(null),
    speakers: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(16),
          color,
          voice: z.string().max(24),
          assetId: id.nullable().default(null),
        }),
      )
      .max(2)
      .default([]),
    topic: z.string().max(32).default(""),
    brand: z.string().max(24).default(""),
    /** Short sound effects on scene and diagram changes (explainer and conversation looks). */
    sfx: z.boolean().default(true),
    visual: z.enum(["grid", "complexity"]).default("grid"),
    mascot: z.enum(["none", "default", "asset"]).default("none"),
    mascotAssetId: id.nullable().default(null),
    scenes: z.array(sceneSchema).min(1).max(60),
  })
  .refine(
    (t) => t.scenes.reduce((s, x) => s + x.durationFrames, 0) <= 5400,
    "Videos may be at most 180 seconds.",
  )
  .refine(
    (t) =>
      t.style !== "explainer" ||
      (t.aspect === "9:16" && t.scenes.every((s) => !s.assetId)),
    "Animated explainers use vertical diagrams. Switch to Classic captions to use scene media or another aspect ratio.",
  )
  .refine((t) => {
    const ids = t.scenes.flatMap((s) => [s.id, ...s.captions.map((c) => c.id)]);
    return new Set(ids).size === ids.length;
  }, "Timeline object IDs must be unique.");
export type Timeline = z.infer<typeof timelineSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export function dimensions(aspect: Timeline["aspect"]) {
  return aspect === "9:16"
    ? { width: 720, height: 1280 }
    : aspect === "16:9"
      ? { width: 1280, height: 720 }
      : { width: 720, height: 720 };
}
export function duration(t: Timeline) {
  return t.scenes.reduce((s, x) => s + x.durationFrames, 0);
}
export function scriptTimeline(
  script: string,
  aspect: Timeline["aspect"] = "9:16",
  seconds = 30,
): Timeline {
  const chunks = script
    .split(/\n\s*\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (chunks.length > 60)
    throw new Error(
      "Use at most 60 scenes, separated by blank lines. No script content has been saved.",
    );
  const parts = chunks.length ? chunks : ["Your story starts here."];
  const frames = Math.max(15 * parts.length, Math.round(seconds * 30));
  const words = parts.map((s) => Math.max(1, s.split(/\s+/).length));
  const total = words.reduce((a, b) => a + b, 0);
  let remaining = frames;
  const scenes = parts.map((text, i) => {
    const length =
      i === parts.length - 1
        ? remaining
        : Math.max(
            15,
            Math.min(
              remaining - 15 * (parts.length - i - 1),
              Math.round((frames * words[i]) / total),
            ),
          );
    remaining -= length;
    return {
      id: crypto.randomUUID(),
      script: text,
      caption: text,
      durationFrames: length,
      background: ["#151125", "#101B23", "#1E1624"][i % 3],
      assetId: null,
      narrationId: null,
      sourceVolume: 0,
      captions: [],
      mediaStart: 0,
      transition: "cut" as const,
      fit: "cover" as const,
      visual: null,
      chapter: null,
      speaker: null,
      panel: null,
      code: null,
      cost: null,
      presentation: null,
    };
  });
  return timelineSchema.parse({
    schemaVersion: 1,
    fps: 30,
    aspect,
    fontSize: 52,
    captionColor: "#F5F5F7",
    accentColor: "#8B5CF6",
    captionPosition: "center",
    musicAssetId: null,
    musicVolume: 0.15,
    style: "classic",
    topic: "",
    brand: "",
    visual: "grid",
    mascot: "none",
    mascotAssetId: null,
    backgroundAssetId: null,
    speakers: [],
    scenes,
  });
}
