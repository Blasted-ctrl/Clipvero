import { Easing, interpolate } from "remotion";
import { complexitySchema, type Cost, type Scene } from "./model";

export function growthValue(kind: Cost["focus"], n: number) {
  switch (kind) {
    case "O(1)":
      return 1;
    case "O(log n)":
      return Math.log2(Math.max(1, n));
    case "O(n)":
      return n;
    case "O(n log n)":
      return n * Math.log2(Math.max(1, n));
    case "O(n²)":
      return n * n;
  }
}
const clean = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");
export const cueFrame = (
  cue: string | undefined,
  captions: Scene["captions"],
) =>
  cue ? (captions.find((c) => clean(c.text) === clean(cue))?.from ?? 0) : 0;
/** Start at the narrated cue when supplied; all counters are modeled operations, not wall-clock measurements. */
export function costValue(
  row: Cost["rows"][number],
  frame: number,
  duration: number,
  captions: Scene["captions"],
) {
  if (row.events?.length) {
    let value = row.from;
    for (const event of row.events) {
      const caption = captions.find((c) => clean(c.text) === clean(event.cue));
      if (!caption) break;
      const start = caption.from;
      if (frame < start) break;
      value = interpolate(frame, [start, start + 6], [value, event.value], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.cubic),
      });
    }
    return value;
  }
  if (row.cue && !captions.some((c) => clean(c.text) === clean(row.cue!)))
    return row.from;
  const cue = cueFrame(row.cue, captions);
  const end = Math.max(cue + 1, Math.min(duration - 1, cue + 36));
  const progress = interpolate(frame, [cue, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return row.from + (row.to - row.from) * progress;
}
export function costCount(
  row: Cost["rows"][number],
  frame: number,
  duration: number,
  captions: Scene["captions"],
) {
  return Math.round(costValue(row, frame, duration, captions));
}
export function GrowthStrip({
  focus,
  accent,
}: {
  focus: Cost["focus"];
  accent: string;
}) {
  return (
    <div style={{ display: "flex", gap: 7 }}>
      {complexitySchema.options.map((kind) => {
        const active = kind === focus;
        const points = Array.from({ length: 25 }, (_, i) => {
          const n = 1 + (i * 15) / 24;
          return `${6 + i * 3.4},${30 - (growthValue(kind, n) / growthValue(kind, 16)) * 24}`;
        }).join(" ");
        return (
          <div
            key={kind}
            style={{
              flex: 1,
              padding: "4px 2px",
              borderRadius: 7,
              background: active ? `${accent}16` : "#101720",
              border: `1px solid ${active ? accent : "#27323F"}`,
              textAlign: "center",
            }}
          >
            <svg width="94" height="32" viewBox="0 0 94 32">
              <path d="M6 2 V30 H90" stroke="#384553" fill="none" />
              <polyline
                points={points}
                fill="none"
                stroke={active ? accent : "#748497"}
                strokeWidth={active ? 2.5 : 1.5}
              />
            </svg>
            <div style={{ fontSize: 17, color: active ? accent : "#A7B4C3" }}>
              {kind}
            </div>
          </div>
        );
      })}
    </div>
  );
}
export function CostPanel({
  cost,
  frame,
  duration,
  captions,
  accent,
}: {
  cost: Cost;
  frame: number;
  duration: number;
  captions: Scene["captions"];
  accent: string;
}) {
  return (
    <div
      data-cost-panel
      style={{
        position: "absolute",
        top: 614,
        left: 32,
        width: 656,
        color: "#E9EEF4",
        fontFamily: "Consolas, monospace",
        background: "#0C131D",
        border: "1px solid #2A3747",
        borderRadius: 12,
        padding: "12px 18px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 18,
          color: "#A3B1C2",
          marginBottom: 6,
        }}
      >
        <span>n = {cost.n.toLocaleString("en-US")}</span>
        <span>{cost.unit}</span>
      </div>
      <div style={{ display: "flex", gap: 24, marginBottom: 7 }}>
        {cost.rows.map((row) => (
          <div key={row.label} style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 16, color: "#A3B1C2" }}>
                {row.label}
              </span>
              <span
                style={{
                  fontSize: 15,
                  color: row.complexity === cost.focus ? accent : "#A3B1C2",
                }}
              >
                {row.complexity}
              </span>
            </div>
            <div
              style={{
                fontSize: 31,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                color: row.complexity === cost.focus ? accent : "#F3F6FA",
                lineHeight: "35px",
              }}
            >
              {costCount(row, frame, duration, captions).toLocaleString(
                "en-US",
              )}
            </div>
          </div>
        ))}
      </div>
      <GrowthStrip focus={cost.focus} accent={accent} />
      <div
        style={{
          marginTop: 7,
          color: "#9EAFC1",
          fontSize: 14,
          lineHeight: "17px",
        }}
      >
        {cost.note}
      </div>
      <div
        style={{
          marginTop: 3,
          color: "#8196AD",
          fontSize: 11,
          lineHeight: "13px",
        }}
      >
        GROWTH SHAPES · EACH SCALED · COUNTS ARE EXAMPLES
      </div>
    </div>
  );
}
