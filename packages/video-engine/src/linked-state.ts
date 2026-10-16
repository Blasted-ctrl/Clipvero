import type { Scene, Visual } from "./model";

/** A beat stores the initial links; spoken events apply assignments in order. */
export function linkedFrame(
  visual: Extract<Visual, { type: "linked-list" }>,
  frame: number,
  captions: Scene["captions"],
) {
  const clean = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");
  let current = { ...visual, rewire: undefined } as typeof visual;
  let previous = current;
  let start = 0;
  for (const step of visual.steps ?? []) {
    const cue = captions.find(
      (caption) => clean(caption.text) === clean(step.cue),
    );
    if (!cue || frame < cue.from) break;
    previous = current;
    current = {
      ...current,
      active: step.from,
      nodes: current.nodes.map((node) =>
        node.id === step.from ? { ...node, next: step.to } : node,
      ),
      rewire: { from: step.from, to: step.to },
    };
    start = cue.from;
  }
  return { visual: current, previous, frame: frame - start };
}
