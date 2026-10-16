import { evolvePath, getLength } from "@remotion/paths";

/**
 * The hash-map route (key → hash → bucket) split where the query chip changes
 * direction. `at` is the chip's progress (0-1) when it reaches each segment's end.
 */
export function routeSegments(targetX: number) {
  return [
    { d: "M210 181 V196", at: 0.15 },
    { d: "M210 196 Q210 204 360 204", at: 0.4 },
    { d: "M360 204 V270", at: 0.55 },
    { d: `M360 270 Q360 302 ${targetX} 315`, at: 0.9 },
    { d: `M${targetX} 315 V342`, at: 1 },
  ];
}

export const routePath = (targetX: number) =>
  `M210 181 V196 Q210 204 360 204 V270 Q360 302 ${targetX} 315 V342`;

/** Share of the route's length covered when the chip is at `move` (0-1). */
export function routeProgress(move: number, targetX: number) {
  const segments = routeSegments(targetX);
  const lengths = segments.map((segment) => getLength(segment.d));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let covered = 0;
  let start = 0;
  segments.forEach((segment, i) => {
    const share = Math.max(
      0,
      Math.min(1, (move - start) / (segment.at - start)),
    );
    covered += lengths[i] * share;
    start = segment.at;
  });
  return covered / total;
}

/** SVG dash props that draw the route up to the chip. */
export function routeTrail(move: number, targetX: number) {
  return evolvePath(routeProgress(move, targetX), routePath(targetX));
}
