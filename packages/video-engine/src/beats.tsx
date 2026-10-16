import { Easing, interpolate } from "remotion";
import { CodeLines } from "./code-view";
import type { CSSProperties, ReactNode } from "react";
import type { Visual } from "./model";
import { HashmapDiagram } from "./hashmap";
import { ArrayDetails } from "./array-details";
import { ContactList } from "./contact-list";
import { ComplexityProof } from "./complexity-proof";
import { PointersVisual } from "./pointer-proof";
import { LinkedListVisual, CallStackVisual, GraphVisual } from "./dsa-visuals";

/** Everything a beat component needs; all motion derives from these frame numbers. */
export type BeatProps = {
  f: number; // frame within this beat
  d: number; // beat length in frames
  accent: string;
  continuing?: boolean;
  previous?: Visual;
  count?: number;
  countProgress?: number;
  inputSize?: number;
  cueFrames?: number[];
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (f: number, from: number, to: number) =>
  interpolate(f, [from, to], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
const mono = "Consolas, 'Cascadia Code', 'Courier New', monospace";
const sans = "Arial, sans-serif";
const panel: CSSProperties = {
  background: "#101720",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 22,
  boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
};

function Center({
  children,
  height,
}: {
  children: ReactNode;
  height?: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}

function RosterBeat({
  v,
  f,
  d,
  accent,
  continuing,
}: BeatProps & { v: Extract<Visual, { type: "roster" }> }) {
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: sans }}>
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 40,
          right: 40,
          textAlign: "center",
          fontSize: v.label.length > 28 ? 34 : 42,
          fontWeight: 900,
          color: "#fff",
        }}
      >
        {v.label}
      </div>
      {v.names.map((name, i) => {
        const t = continuing ? 1 : ease(f, i * 3, i * 3 + 12);
        const chosen = v.found && i === v.target;
        const scanIndex =
          f < d * 0.6
            ? Math.min(
                v.names.length - 1,
                Math.floor(f / Math.max(1, (d * 0.6) / v.names.length)),
              )
            : v.target;
        const scan = !v.found && scanIndex === i;
        const pop = chosen
          ? interpolate(f, [0, 8, 15], [1, 1.055, 1], clamp)
          : 1;
        return (
          <div
            key={name}
            style={{
              position: "absolute",
              top: 92 + i * (v.names.length > 5 ? 78 : 92),
              left: 74,
              right: 74,
              height: v.names.length > 5 ? 66 : 76,
              ...panel,
              display: "flex",
              alignItems: "center",
              gap: 20,
              padding: "0 20px",
              opacity: t,
              transform: `translateX(${(1 - t) * (i % 2 ? 90 : -90)}px) scale(${(0.82 + t * 0.18) * pop})`,
              border: `2px solid ${chosen || scan ? accent : "#293746"}`,
              background: chosen ? accent : "#101923",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: chosen ? "#101923" : `${accent}25`,
                display: "grid",
                placeItems: "center",
                color: accent,
                fontSize: 26,
                fontWeight: 800,
              }}
            >
              {name[0]}
            </div>
            <span
              style={{
                color: chosen ? "#0B1018" : "#fff",
                fontSize: 32,
                fontWeight: 800,
              }}
            >
              {name}
            </span>
            <span
              style={{
                marginLeft: "auto",
                color: chosen ? "#0B1018" : accent,
                fontSize: chosen ? 36 : 24,
              }}
            >
              {chosen ? "♥" : "→"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function BinaryGridBeat({
  v,
  f,
  accent,
}: BeatProps & { v: Extract<Visual, { type: "binary-grid" }> }) {
  const reveal = ease(f, 0, 16);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        fontFamily: mono,
        textAlign: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "40px 25px 80px",
          display: "grid",
          gridTemplateColumns: "repeat(10,1fr)",
          color: accent,
          fontSize: 27,
          opacity: 0.13,
        }}
      >
        {Array.from({ length: 70 }, (_, i) => (
          <span
            key={i}
            style={{ opacity: 0.35 + 0.65 * Math.abs(Math.sin(f / 24 + i)) }}
          >
            {(i * 7 + Math.floor(f / 24)) % 2}
          </span>
        ))}
      </div>
      <svg width="720" height="600" style={{ position: "absolute", inset: 0 }}>
        <path
          d="M 190 240 L 190 320 L 360 400 L 530 320 L 530 240"
          fill="none"
          stroke={accent}
          strokeWidth="4"
          strokeDasharray="700"
          strokeDashoffset={700 * (1 - ease(f, 12, 32))}
        />
        <circle
          cx="360"
          cy="400"
          r={10 + 6 * Math.sin(f / 15) ** 2}
          fill={accent}
        />
      </svg>
      {["0", "1"].map((digit, i) => (
        <div
          key={digit}
          style={{
            ...panel,
            position: "absolute",
            left: 100 + i * 340,
            top: 110,
            width: 180,
            height: 180,
            display: "grid",
            placeItems: "center",
            fontSize: 132,
            fontWeight: 900,
            color: i ? "#0B1018" : accent,
            background: i ? accent : "#101923",
            border: `2px solid ${accent}`,
            opacity: reveal,
            transform: `translateX(${(1 - reveal) * (i ? 90 : -90)}px) scale(${0.7 + 0.3 * reveal})`,
          }}
        >
          {digit}
        </div>
      ))}
      <div
        style={{
          position: "absolute",
          top: 460,
          left: 40,
          right: 40,
          color: "#fff",
          fontSize: 38,
          fontWeight: 800,
          opacity: ease(f, 18, 30),
        }}
      >
        {v.label}
      </div>
    </div>
  );
}

function TitleBeat({
  v,
  f,
  accent,
}: BeatProps & { v: Extract<Visual, { type: "title" }> }) {
  const glow = 0.6 + Math.sin(f / 10) * 0.25;
  return (
    <Center>
      {v.number && (
        <div
          style={{
            fontFamily: sans,
            fontSize: 150,
            fontWeight: 900,
            lineHeight: 1,
            color: accent,
            opacity: ease(f, 0, 10),
            textShadow: `0 0 ${30 * glow}px ${accent}`,
          }}
        >
          {v.number}
        </div>
      )}
      <div
        style={{
          fontFamily: sans,
          fontSize: v.text.length > 16 ? 54 : 70,
          fontWeight: 900,
          letterSpacing: 4,
          color: "#F5F7FA",
          textTransform: "uppercase",
          textAlign: "center",
          padding: "0 40px",
          textShadow: "0 2px 12px #000000",
          opacity: ease(f, 0, 10),
          transform: `scale(${interpolate(f, [0, 8, 14], [0.82, 1.03, 1], clamp)})`,
        }}
      >
        {v.text}
      </div>
      {v.subtitle && (
        <div
          style={{
            fontFamily: mono,
            fontSize: 24,
            color: "#C7D2DF",
            opacity: ease(f, 18, 30),
            border: "1px solid #334155",
            borderRadius: 10,
            padding: "8px 16px",
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          {v.subtitle}
        </div>
      )}
    </Center>
  );
}

const keywords =
  /\b(def|for|in|return|if|else|elif|while|import|from|class|const|let|var|function|new|true|false|True|False|None|null|and|or|not)\b/;
function highlightCode(line: string, accent: string) {
  const parts = line
    .split(/(\s+|[()[\]{}:,.=+\-*/<>]|"[^"]*"|'[^']*'|#.*$|\/\/.*$)/)
    .filter(Boolean);
  return parts.map((part, i) => {
    let color = "#E5E7EB";
    if (keywords.test(part)) color = accent;
    else if (/^["']/.test(part)) color = "#86EFAC";
    else if (/^\d+$/.test(part)) color = "#FDBA74";
    else if (/^(#|\/\/)/.test(part)) color = "#6B7280";
    else if (/^[()[\]{}:,.=+\-*/<>]$/.test(part)) color = "#A5B4FC";
    return (
      <span key={i} style={{ color }}>
        {part}
      </span>
    );
  });
}

function CodeBeat({
  v,
  f,
  d,
  accent,
  continuing,
  previous,
}: BeatProps & { v: Extract<Visual, { type: "code" }> }) {
  const total = v.lines.reduce((sum, line) => sum + line.length + 1, 0);
  const budget = continuing
    ? total
    : interpolate(f, [6, Math.max(12, d * 0.35)], [0, total], clamp);
  const typedAll = budget >= total;
  return (
    <div
      style={{
        ...panel,
        position: "absolute",
        left: 30,
        right: 30,
        top: "50%",
        transform: "translateY(-50%)",
        padding: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "16px 20px",
          background: "rgba(255,255,255,0.05)",
        }}
      >
        {["#F87171", "#FBBF24", "#34D399"].map((c) => (
          <div
            key={c}
            style={{ width: 14, height: 14, borderRadius: 7, background: c }}
          />
        ))}
        <div
          style={{
            marginLeft: "auto",
            fontFamily: mono,
            fontSize: 20,
            color: "#9CA3AF",
          }}
        >
          {v.language}
        </div>
      </div>
      <div style={{ padding: "18px 0 24px" }}>
        <CodeLines
          lines={v.lines}
          f={f}
          accent={accent}
          fontSize={Math.min(
            31,
            880 / Math.max(...v.lines.map((line) => line.length)),
          )}
          lineHeight={Math.min(52, 450 / v.lines.length)}
          highlight={typedAll ? v.highlight : undefined}
          previous={previous?.type === "code" ? previous : undefined}
          chars={budget}
          fallback={(text) => highlightCode(text, accent)}
        />
      </div>
    </div>
  );
}

function TerminalBeat({
  v,
  f,
  d,
}: BeatProps & { v: Extract<Visual, { type: "terminal" }> }) {
  const slot = (d * 0.85) / v.commands.length;
  const green = "#4ADE80";
  return (
    <div
      style={{
        ...panel,
        position: "absolute",
        left: 30,
        right: 30,
        top: "50%",
        transform: "translateY(-50%)",
        minHeight: 440,
        background: "rgba(3,12,6,0.9)",
        border: `1px solid ${green}55`,
        boxShadow: `0 0 40px ${green}22`,
        padding: "22px 26px",
        fontFamily: mono,
        fontSize: 29,
        lineHeight: "46px",
        color: green,
      }}
    >
      <div
        style={{
          color: "#6EE7B7",
          opacity: 0.6,
          fontSize: 20,
          marginBottom: 10,
        }}
      >
        bash — clipvero@learn
      </div>
      {v.commands.map((command, i) => {
        const start = i * slot + 4;
        if (f < start) return null;
        const typed = Math.floor(
          interpolate(
            f,
            [start, start + command.cmd.length * 1.3],
            [0, command.cmd.length],
            clamp,
          ),
        );
        const outputAt = start + command.cmd.length * 1.3 + 6;
        return (
          <div key={i}>
            <div style={{ whiteSpace: "pre" }}>
              <span style={{ color: "#A7F3D0" }}>$ </span>
              {command.cmd.slice(0, typed)}
              {typed < command.cmd.length && <span>▍</span>}
            </div>
            {f >= outputAt &&
              command.output.map((line, j) => (
                <div
                  key={j}
                  style={{
                    whiteSpace: "pre",
                    color: "#D1FAE5",
                    opacity: ease(f, outputAt + j * 3, outputAt + j * 3 + 6),
                  }}
                >
                  {line}
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}

function ArrayBeat({
  v,
  f,
  d,
  accent,
  continuing,
  previous,
  countProgress,
  inputSize,
  count,
}: BeatProps & { v: Extract<Visual, { type: "array" }> }) {
  if (v.detail === "contacts")
    return (
      <ContactList
        v={v}
        f={f}
        d={d}
        accent={accent}
        continuing={continuing}
        previous={previous}
        count={count}
      />
    );
  const n = v.items.length;
  const size = Math.min(108, Math.floor(630 / n) - 8);
  const target = v.target ?? n - 1;
  const run = d * 0.8;
  // Pointer path: every index for a scan, halving midpoints for a binary search.
  const path: { mid: number; lo: number; hi: number }[] = [];
  if (v.mode === "binary") {
    let lo = 0,
      hi = n - 1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      path.push({ mid, lo, hi });
      if (mid === target) break;
      if (mid < target) lo = mid + 1;
      else hi = mid - 1;
    }
  } else if (v.mode === "scan") {
    for (let i = 0; i <= target; i++) path.push({ mid: i, lo: 0, hi: n - 1 });
  } else path.push({ mid: target, lo: 0, hi: n - 1 });
  const step = Math.min(
    path.length - 1,
    v.step ?? Math.floor(interpolate(f, [8, run], [0, path.length], clamp)),
  );
  const current = path[Math.max(0, step)];
  const hasPointer =
    v.showPointer &&
    v.emptyAt === undefined &&
    (v.mode !== "highlight" || v.target !== undefined);
  const found =
    v.showResult !== false &&
    v.mode !== "highlight" &&
    step === path.length - 1 &&
    (v.step !== undefined ||
      f > 8 + (run - 8) * ((path.length - 0.5) / path.length));
  const query = v.mode === "binary" ? v.items[target] : undefined;
  const priorRange =
    previous?.type === "array" && previous.mode === "binary"
      ? path[Math.min(path.length - 1, previous.step ?? 0)]
      : current;
  const boundPosition = (bound: "lo" | "hi") =>
    interpolate(
      f,
      [0, 18],
      [
        priorRange[bound] * (size + 8) + size / 2,
        current[bound] * (size + 8) + size / 2,
      ],
      { ...clamp, easing: Easing.inOut(Easing.cubic) },
    );
  return (
    <>
      <Center height={v.detail !== "search" ? 320 : undefined}>
        {v.label && (
          <div
            style={{
              fontFamily: mono,
              fontSize: query ? 22 : 28,
              marginBottom: query ? 14 : 38,
              color: "#C7D2DF",
              letterSpacing: 1,
              ...(query
                ? {
                    width: 630,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 20,
                  }
                : {}),
            }}
          >
            {query ? (
              <>
                <span style={{ textAlign: "left", maxWidth: 340 }}>
                  {v.label}
                </span>
                <span
                  data-search-target={query}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "8px 18px",
                    background: "#101A26",
                    border: `1px solid ${accent}`,
                    borderRadius: 10,
                    color: accent,
                  }}
                >
                  <span style={{ fontSize: 17 }}>TARGET</span>
                  <strong style={{ fontSize: 42 }}>{query}</strong>
                </span>
              </>
            ) : (
              v.label
            )}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              top: -48,
              left: 0,
              color: accent,
              fontSize: 34,
              fontWeight: 900,
              transform: `translateX(${
                countProgress !== undefined && v.mode === "scan"
                  ? Math.max(0, countProgress - 1) * (size + 8) + size / 2 - 12
                  : interpolate(
                      f,
                      [0, 12],
                      [
                        (previous?.type === "array"
                          ? previous.mode === "binary"
                            ? path[
                                Math.min(path.length - 1, previous.step ?? 0)
                              ].mid
                            : (previous.target ?? current.mid)
                          : current.mid) *
                          (size + 8) +
                          size / 2 -
                          12,
                        current.mid * (size + 8) + size / 2 - 12,
                      ],
                      { ...clamp, easing: Easing.inOut(Easing.cubic) },
                    )
              }px)`,
              opacity: hasPointer ? (continuing ? 1 : ease(f, 12, 22)) : 0,
            }}
          >
            ↓
          </div>
          {v.items.map((item, i) => {
            const isCurrent = hasPointer && i === current.mid;
            const outside =
              v.mode === "binary" && (i < current.lo || i > current.hi);
            const visited = v.mode === "scan" && i < current.mid;
            const hit = found && i === target;
            const enter = continuing
              ? 1
              : ease(f + (query ? 10 : 0), i * 2, i * 2 + 10);
            const pop = continuing
              ? 1
              : interpolate(
                  f + (query ? 10 : 0),
                  [i * 2, i * 2 + 8, i * 2 + 14],
                  [0.5, 1.08, 1],
                  clamp,
                );
            return (
              <div
                key={i}
                style={{
                  width: size,
                  height: Math.max(88, size),
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: mono,
                  fontWeight: 800,
                  fontSize: Math.min(
                    size * 0.38,
                    (size - 8) / Math.max(1, item.length * 0.62),
                  ),
                  color: hit || isCurrent ? "#0B1018" : "#FFFFFF",
                  background:
                    hit || isCurrent ? accent : "rgba(255,255,255,0.08)",
                  border: `2px solid ${hit || isCurrent ? accent : "rgba(255,255,255,0.18)"}`,
                  opacity: enter * (outside || visited ? 0.18 : 1),
                  transform: `translateY(${(1 - enter) * 65 + (isCurrent ? -16 : 0)}px) scale(${pop})`,
                  boxShadow: isCurrent ? `0 0 20px ${accent}25` : "none",
                }}
              >
                {item}
              </div>
            );
          })}
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            position: "relative",
            paddingBottom: query ? 24 : 0,
          }}
        >
          {query &&
            ["lo", "hi"].map((bound) => (
              <div
                key={bound}
                data-search-bound={bound}
                style={{
                  position: "absolute",
                  left: boundPosition(bound as "lo" | "hi"),
                  top: bound === "lo" ? 26 : 48,
                  fontFamily: mono,
                  fontSize: 16,
                  color: accent,
                  transform: "translateX(-50%)",
                  whiteSpace: "nowrap",
                }}
              >
                {bound.toUpperCase()}{" "}
                {f < 18 &&
                priorRange[bound as "lo" | "hi"] !==
                  current[bound as "lo" | "hi"]
                  ? `${priorRange[bound as "lo" | "hi"]} → ${current[bound as "lo" | "hi"]}`
                  : current[bound as "lo" | "hi"]}
              </div>
            ))}
          {v.items.map((_, i) => (
            <div
              key={i}
              style={{
                width: size,
                textAlign: "center",
                fontFamily: mono,
                fontSize: 22,
                color: "#6B7280",
              }}
            >
              {hasPointer && i === current.mid ? "▲" : i}
            </div>
          ))}
        </div>
        <div
          style={{
            fontFamily: mono,
            fontSize: 28,
            color: found ? accent : "#9CA3AF",
          }}
        >
          {v.emptyAt !== undefined
            ? `lo ${v.emptyAt} > hi ${v.emptyAt - 1} · not found`
            : v.mode === "highlight" || !hasPointer
              ? ""
              : found
                ? `found in ${path.length} step${path.length > 1 ? "s" : ""}`
                : v.mode === "binary"
                  ? `candidate ${v.items[current.mid]} · lo ${current.lo} / hi ${current.hi}`
                  : `step ${step + 1}`}
        </div>
      </Center>
      <ArrayDetails
        visual={v}
        frame={f}
        accent={accent}
        inputSize={inputSize}
        count={count}
        countProgress={countProgress}
      />
    </>
  );
}

function StructureBeat({
  v,
  f,
  d,
  accent,
  cueFrames,
  countProgress,
  inputSize,
}: BeatProps & { v: Extract<Visual, { type: "structure" }> }) {
  const t =
    v.operation === "list-front"
      ? ease(f, 0, 6)
      : ease(f, 4, Math.min(28, Math.max(14, d * 0.4)));
  const stack = v.kind === "stack";
  const removed = stack ? v.items.length - 1 : 0;
  const entries = v.action === "add" ? [...v.items, v.item!] : v.items;
  const largeList = v.detail === "large-list";
  const modeledSize = Math.max(1, inputSize ?? entries.length);
  const modeledShifts = Math.max(0, modeledSize - 1);
  const shiftProgress = Math.min(
    modeledShifts,
    Math.max(0, countProgress ?? 0),
  );
  const cueAt = (index: number, fallback: number) =>
    cueFrames?.[index] ?? fallback;
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: mono }}>
      <div
        style={{
          position: "absolute",
          top: 18,
          left: 40,
          right: 40,
          textAlign: "center",
          color: "#FFFFFF",
          fontSize: 26,
          fontWeight: 700,
        }}
      >
        {v.label}
      </div>
      <div
        style={{
          position: "absolute",
          top: 70,
          left: 40,
          right: 40,
          textAlign: "center",
          color: accent,
          fontSize: 22,
        }}
      >
        {v.operation === "list-front"
          ? "PYTHON LIST · SHIFT REMAINING ENTRIES"
          : v.operation === "empty-guard"
            ? "CHECK BEFORE REMOVING"
            : stack
              ? "LAST IN → FIRST OUT"
              : "FIRST IN → FIRST OUT"}
      </div>
      {!largeList && (
        <div
          style={{
            position: "absolute",
            left: stack ? 200 : 30,
            top: stack ? 125 : 245,
            width: stack ? 320 : 660,
            height: stack ? 370 : 100,
            border: stack ? "4px solid #43546A" : "2px solid #334155",
            borderRadius: stack ? 28 : 14,
            background: stack
              ? "linear-gradient(160deg,#152132,#0A1018)"
              : "#101923",
          }}
        />
      )}
      {stack && (
        <div
          style={{
            position: "absolute",
            left: 290,
            top: 143,
            width: 140,
            height: 7,
            borderRadius: 4,
            background: "#52677D",
          }}
        />
      )}
      {!stack && !largeList && v.operation !== "empty-guard" && (
        <div
          style={{
            position: "absolute",
            left: 40,
            right: 40,
            top: 120,
            textAlign: "center",
            color: "#91A4B9",
            fontSize: 18,
            letterSpacing: 3,
          }}
        >
          SERVE FIRST ← ARRIVAL ORDER ← JOIN HERE
        </div>
      )}
      {!largeList &&
        entries.map((item, i) => {
          const entering = v.action === "add" && i === entries.length - 1;
          const leaving = v.action === "remove" && i === removed;
          const reveal =
            v.detail === "draft-reveal"
              ? ease(f, cueAt(i, i * 18), cueAt(i, i * 18) + 6)
              : 1;
          const move =
            v.operation === "list-front" && i > 0 && v.action === "remove"
              ? Math.min(
                  1,
                  Math.max(
                    0,
                    (countProgress ?? t * (entries.length - 1)) - (i - 1),
                  ),
                )
              : t;
          const x = stack
            ? 220
            : 42 + i * 126 - (v.action === "remove" && i > 0 ? move * 126 : 0);
          const y = stack ? 425 - i * 65 : 260;
          return (
            <div
              key={`${i}-${item}`}
              style={{
                position: "absolute",
                left:
                  x +
                  (!stack && entering
                    ? (1 - t) * 130
                    : !stack && leaving
                      ? -t * 130
                      : 0),
                top:
                  y +
                  (stack && entering
                    ? -(1 - t) * 180
                    : stack && leaving
                      ? -t * 150
                      : 0),
                width: stack ? 280 : 112,
                height: 52,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: (entering ? t : leaving ? 1 - t : 1) * reveal,
                transform: `translateY(${(1 - reveal) * 22}px) scale(${entering ? interpolate(t, [0, 0.75, 1], [0.75, 1.06, 1]) : 0.96 + 0.04 * reveal})`,
                borderRadius: 10,
                color: entering || leaving ? "#08111A" : "#FFFFFF",
                background: entering || leaving ? accent : "#172332",
                border: `2px solid ${entering || leaving ? accent : "#43546A"}`,
                fontSize: stack ? 32 : 26,
                fontWeight: 800,
              }}
            >
              {!stack && (
                <svg
                  width="70"
                  height="88"
                  viewBox="0 0 70 88"
                  style={{ position: "absolute", bottom: 62, left: 21 }}
                >
                  <path
                    d="M20 18 L14 2"
                    stroke={accent}
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M12 20 H58 L51 80 Q35 87 19 80 Z"
                    fill="#E5C79D"
                    stroke="#F7E3C4"
                    strokeWidth="3"
                  />
                  <path
                    d="M17 45 H53 L50 78 H20 Z"
                    fill={accent}
                    opacity=".35"
                  />
                  <path
                    d="M9 20 Q35 11 61 20"
                    fill="none"
                    stroke="#FAEAD2"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                  {[24, 35, 46].map((cx, i) => (
                    <circle
                      key={cx}
                      cx={cx}
                      cy={72 - (i % 2) * 6}
                      r="4"
                      fill="#302239"
                    />
                  ))}
                  <path
                    d="M23 30 L25 51"
                    stroke="#FFFFFF"
                    strokeOpacity=".6"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              )}
              {item}
              {v.operation === "list-front" && !stack && (
                <span
                  style={{
                    position: "absolute",
                    top: 60,
                    left: 0,
                    width: "100%",
                    color: "#B8C6D6",
                    fontSize: 18,
                  }}
                >
                  [{i > 0 && move >= 1 ? i - 1 : i}]
                </span>
              )}
            </div>
          );
        })}
      {v.operation === "list-front" && !largeList && v.action === "remove" && (
        <div
          style={{
            position: "absolute",
            top: 390,
            left: 60,
            right: 60,
            display: "flex",
            gap: 16,
          }}
        >
          {entries.slice(1).map((item, index) => {
            const moved = (countProgress ?? 0) >= index + 1;
            return (
              <div
                key={item}
                style={{
                  ...panel,
                  flex: 1,
                  padding: "16px 10px",
                  textAlign: "center",
                  fontSize: 22,
                  color: moved ? accent : "#A5B3C3",
                  borderColor: moved ? accent : "#293746",
                }}
              >
                {item}
                <div style={{ marginTop: 8, fontSize: 20 }}>
                  index {index + 1} → {index}
                </div>
                <div style={{ marginTop: 8, fontSize: 17 }}>
                  {moved ? "REFERENCE MOVED" : "WAITING"}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {largeList && (
        <div
          data-large-list-proof
          style={{ position: "absolute", top: 130, left: 35, right: 35 }}
        >
          <div
            style={{
              textAlign: "center",
              fontSize: 28,
              color: "#FFFFFF",
              marginBottom: 28,
            }}
          >
            COMPRESSED VIEW · {modeledSize.toLocaleString("en-US")} ITEMS
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {["0", "1", "2", "…", String(modeledSize - 1)].map(
              (index, position) => (
                <div
                  key={`${position}-${index}`}
                  style={{
                    ...panel,
                    flex: 1,
                    height: 76,
                    display: "grid",
                    placeItems: "center",
                    fontSize: position === 4 ? 20 : 28,
                    color: position === 0 ? accent : "#E4EAF2",
                    opacity:
                      position === 0 ? 1 - Math.min(1, shiftProgress) * 0.7 : 1,
                  }}
                >
                  [{index}]
                </div>
              ),
            )}
          </div>
          <div
            style={{
              marginTop: 18,
              color: accent,
              fontSize: 20,
              textAlign: "center",
            }}
          >
            ← every surviving reference moves one slot
          </div>
          <div style={{ marginTop: 36, ...panel, padding: 22 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 24,
                color: "#FFFFFF",
              }}
            >
              <span>list.pop(0)</span>
              <span style={{ color: accent }}>
                {Math.round(shiftProgress).toLocaleString("en-US")} shifts
              </span>
            </div>
            <div
              style={{
                marginTop: 16,
                height: 15,
                background: "#233142",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${(100 * shiftProgress) / Math.max(1, modeledShifts)}%`,
                  height: "100%",
                  background: accent,
                }}
              />
            </div>
            <div
              style={{
                marginTop: 22,
                paddingTop: 20,
                borderTop: "1px solid #344152",
                display: "flex",
                justifyContent: "space-between",
                fontSize: 22,
                color: "#D8E2ED",
              }}
            >
              <span>deque.popleft()</span>
              <span>fixed end operation</span>
            </div>
          </div>
        </div>
      )}
      {v.detail === "implementation" && (
        <div
          style={{
            position: "absolute",
            top: 380,
            left: 55,
            right: 55,
            ...panel,
            padding: "14px 20px",
            fontSize: 21,
          }}
        >
          {[
            ["list.pop()", "O(1) amortized"],
            ["deque.popleft()", "O(1)"],
            ["list.pop(0)", "O(n) shifts"],
          ].map(([operation, complexity], index) => (
            <div
              key={operation}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 0",
                color:
                  f >= cueAt(index === 0 ? 0 : 1, index * 22)
                    ? index === 2
                      ? "#E3D6BF"
                      : accent
                    : "#8392A4",
              }}
            >
              <span>{operation}</span>
              <span>{complexity}</span>
            </div>
          ))}
        </div>
      )}
      {v.detail === "draft-payoff" && (
        <div
          style={{
            position: "absolute",
            top: 370,
            left: 100,
            right: 100,
            ...panel,
            padding: "18px 24px",
            opacity: ease(f, cueAt(0, 60), cueAt(0, 60) + 10),
          }}
        >
          <div style={{ color: "#9CAEC2", fontSize: 18, letterSpacing: 2 }}>
            BACK IN DRAFTS
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 16,
              fontSize: 28,
            }}
          >
            <span style={{ color: "#FFFFFF" }}>hey</span>
            <span style={{ color: accent, fontSize: 19 }}>KEPT</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 12,
              fontSize: 28,
            }}
          >
            <span style={{ color: "#8392A4", textDecoration: "line-through" }}>
              u up?
            </span>
            <span style={{ color: accent, fontSize: 19 }}>NEVER SENT</span>
          </div>
        </div>
      )}
      {v.operation === "empty-guard" && (
        <div
          style={{
            position: "absolute",
            top: 280,
            left: 40,
            right: 40,
            textAlign: "center",
            fontSize: 32,
            color: accent,
          }}
        >
          EMPTY · return None
        </div>
      )}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: 40,
          right: 40,
          textAlign: "center",
          color: "#C7D2DF",
          fontSize: 25,
        }}
      >
        {largeList
          ? `${modeledSize.toLocaleString("en-US")} − 1 = ${modeledShifts.toLocaleString("en-US")} reference moves`
          : v.operation === "empty-guard"
            ? "0 items · no removal attempted"
            : v.action === "add"
              ? `${stack ? "push" : "enqueue"}(${v.item})`
              : v.action === "remove"
                ? `${v.operation === "list-front" ? "list.pop(0)" : stack ? "pop()" : "dequeue()"} → ${v.items[removed]}`
                : `${v.items.length} ${v.items.length === 1 ? "item" : "items"}`}
      </div>
    </div>
  );
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString("en-US");
}
function CounterBeat({
  v,
  f,
  d,
  accent,
}: BeatProps & { v: Extract<Visual, { type: "counter" }> }) {
  const t = ease(f, 6, d * 0.7);
  // Count on a log scale for huge ranges so every digit gets screen time.
  const value =
    v.to > v.from * 1000 && v.from >= 1
      ? Math.exp(Math.log(v.from) + (Math.log(v.to) - Math.log(v.from)) * t)
      : v.from + (v.to - v.from) * t;
  const text = `${v.prefix ?? ""}${formatNumber(value)}`;
  return (
    <Center>
      <div
        style={{
          fontFamily: mono,
          fontSize: 26,
          color: "#C7D2DF",
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        {v.label}
      </div>
      <div
        style={{
          fontFamily: sans,
          fontWeight: 900,
          fontSize: text.length > 12 ? 64 : 92,
          color: "#fff",
          textShadow: `0 0 30px ${accent}`,
        }}
      >
        {text}
      </div>
      {v.suffix && (
        <div
          style={{
            fontFamily: sans,
            fontSize: 34,
            fontWeight: 700,
            color: accent,
          }}
        >
          {v.suffix}
        </div>
      )}
    </Center>
  );
}

function FlowBeat({
  v,
  f,
  d,
  accent,
}: BeatProps & { v: Extract<Visual, { type: "flow" }> }) {
  const n = v.steps.length;
  const gap = Math.min(130, 540 / n);
  const progress = interpolate(f, [6, d * 0.8], [0, n - 1], clamp);
  const top = (600 - gap * (n - 1)) / 2;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {v.steps.map((step, i) => {
        const lit = progress >= i - 0.05;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 110,
              right: 110,
              top: top + i * gap - 40,
              height: 80,
              ...panel,
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: sans,
              fontWeight: 800,
              fontSize: 34,
              color: lit ? "#fff" : "#6B7280",
              border: `2px solid ${lit ? accent : "rgba(255,255,255,0.1)"}`,
              boxShadow: lit ? `0 0 26px ${accent}55` : "none",
            }}
          >
            {step}
          </div>
        );
      })}
      {Array.from({ length: n - 1 }, (_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 359,
            width: 2,
            top: top + i * gap + 40,
            height: gap - 80,
            background: "rgba(255,255,255,0.18)",
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          left: 348,
          top: top + progress * gap - 12,
          width: 24,
          height: 24,
          borderRadius: 12,
          background: accent,
          boxShadow: `0 0 22px ${accent}`,
          opacity: progress < n - 1 ? 1 : 0,
        }}
      />
    </div>
  );
}

function CompareBeat({
  v,
  f,
  d,
  accent,
}: BeatProps & { v: Extract<Visual, { type: "compare" }> }) {
  const crowned = f > d * 0.6;
  const card = (
    side: "left" | "right",
    data: { title: string; points: string[] },
    delay: number,
  ) => {
    const win = crowned && v.winner === side;
    const lose = crowned && v.winner !== "none" && v.winner !== side;
    return (
      <div
        style={{
          ...panel,
          flex: 1,
          minHeight: 330,
          padding: "30px 24px",
          opacity: ease(f, delay, delay + 10) * (lose ? 0.5 : 1),
          border: `2px solid ${win ? "#4ADE80" : "rgba(255,255,255,0.12)"}`,
          boxShadow: win ? "0 0 34px #4ADE8066" : panel.boxShadow,
          transform: `translateY(${(1 - ease(f, delay, delay + 10)) * 20}px)`,
        }}
      >
        <div
          style={{
            fontFamily: sans,
            fontWeight: 900,
            fontSize: 38,
            color: win ? "#4ADE80" : "#fff",
            marginBottom: 16,
          }}
        >
          {data.title} {win ? "✓" : ""}
        </div>
        {data.points.map((point, i) => (
          <div
            key={i}
            style={{
              fontFamily: sans,
              fontSize: 28,
              lineHeight: 1.35,
              color: "#D1D5DB",
              marginBottom: 10,
              opacity: ease(f, delay + 10 + i * 8, delay + 18 + i * 8),
            }}
          >
            <span style={{ color: accent }}>• </span>
            {point}
          </div>
        ))}
      </div>
    );
  };
  return (
    <div
      style={{
        position: "absolute",
        left: 24,
        right: 24,
        top: "50%",
        transform: "translateY(-50%)",
        display: "flex",
        gap: 18,
        alignItems: "stretch",
      }}
    >
      {card("left", v.left, 4)}
      {card("right", v.right, 14)}
    </div>
  );
}

/** Renders one beat's visual; "chart" is drawn by the caller because it spans beats. */
export function BeatVisual({ v, ...props }: BeatProps & { v: Visual }) {
  switch (v.type) {
    case "pointers":
      return <PointersVisual v={v} {...props} />;
    case "linked-list":
      return <LinkedListVisual v={v} {...props} />;
    case "call-stack":
      return <CallStackVisual v={v} {...props} />;
    case "graph":
      return <GraphVisual v={v} {...props} />;
    case "complexity":
      return <ComplexityProof v={v} {...props} />;
    case "roster":
      return <RosterBeat v={v} {...props} />;
    case "binary-grid":
      return <BinaryGridBeat v={v} {...props} />;
    case "title":
      return <TitleBeat v={v} {...props} />;
    case "code":
      return <CodeBeat v={v} {...props} />;
    case "terminal":
      return <TerminalBeat v={v} {...props} />;
    case "array":
      return <ArrayBeat v={v} {...props} />;
    case "hashmap":
      return <HashmapDiagram v={v} {...props} />;
    case "structure":
      return <StructureBeat v={v} {...props} />;
    case "counter":
      return <CounterBeat v={v} {...props} />;
    case "flow":
      return <FlowBeat v={v} {...props} />;
    case "compare":
      return <CompareBeat v={v} {...props} />;
    case "chart":
      return null;
  }
}
