import type { Scene, Visual } from "./model";

/** Resolve narrated traversal events before rendering, using the actual caption clock. */
export function graphFrame(
  visual: Extract<Visual, { type: "graph" }>,
  previous: Visual | undefined,
  frame: number,
  captions: Scene["captions"],
) {
  const clean = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");
  const initial =
    previous?.type === "graph" &&
    previous.mode === visual.mode &&
    previous.nodes.map((n) => n.id).join("|") ===
      visual.nodes.map((n) => n.id).join("|")
      ? previous
      : {
          ...visual,
          visited: [],
          frontier: [visual.nodes[0].id],
          active: visual.nodes[0].id,
        };
  let current = initial;
  let before = initial;
  let start = 0;
  for (const step of visual.steps ?? []) {
    const cue = captions.find(
      (caption) => clean(caption.text) === clean(step.cue),
    );
    if (!cue || frame < cue.from) break;
    before = current;
    current = { ...visual, ...step };
    start = cue.from;
  }
  return {
    visual: {
      ...visual,
      active: current.active,
      visited: current.visited,
      frontier: current.frontier,
    },
    previous: before,
    frame: frame - start,
  };
}

export function graphMemoryExample(v: Extract<Visual, { type: "graph" }>) {
  const neighbors = (id: string) =>
    [
      ...new Set(
        v.edges.flatMap((e) =>
          e.from === id ? [e.to] : e.to === id ? [e.from] : [],
        ),
      ),
    ].sort();
  const queue = [v.nodes[0].id],
    seen = new Set(queue);
  let widest = [...queue];
  while (queue.length) {
    const id = queue.shift()!;
    for (const next of neighbors(id))
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    if (queue.length > widest.length) widest = [...queue];
  }
  seen.clear();
  let deepest: string[] = [];
  const visit = (id: string, path: string[]) => {
    seen.add(id);
    const nextPath = [...path, id];
    if (nextPath.length > deepest.length) deepest = nextPath;
    for (const next of neighbors(id))
      if (!seen.has(next)) visit(next, nextPath);
  };
  visit(v.nodes[0].id, []);
  return { queue: widest, stack: deepest };
}
