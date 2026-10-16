import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Timeline } from "./model";

export type Word = { text: string; from: number; to: number };

/** Absolute-frame word cues across all scenes. */
export function timelineWords(timeline: Timeline): Word[] {
  let offset = 0;
  const words: Word[] = [];
  for (const scene of timeline.scenes) {
    for (const cue of scene.captions)
      words.push({
        text: cue.text,
        from: cue.from + offset,
        to: cue.to + offset,
      });
    offset += scene.durationFrames;
  }
  return words;
}

const endsSentence = (text: string) => /[.!?]["')\]]*$/.test(text.trim());

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export function ExplainerBackground({
  visual,
  words,
  accent,
  quiet = false,
}: {
  visual: Timeline["visual"];
  words: Word[];
  accent: string;
  quiet?: boolean;
}) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const shift = 0;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#080C12",
        backgroundImage: `radial-gradient(ellipse at 50% 35%, ${accent}0D 0%, #080C12 58%, #030508 100%)`,
      }}
    >
      <svg width={width} height={height} style={{ position: "absolute" }}>
        {Array.from({ length: Math.ceil(width / 60) + 2 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={i * 60 - shift}
            x2={i * 60 - shift}
            y1={0}
            y2={height}
            stroke="#ffffff"
            strokeOpacity={quiet ? 0.018 : 0.04}
          />
        ))}
        {Array.from({ length: Math.ceil(height / 60) + 2 }, (_, i) => (
          <line
            key={`h${i}`}
            y1={i * 60 - shift}
            y2={i * 60 - shift}
            x1={0}
            x2={width}
            stroke="#ffffff"
            strokeOpacity={quiet ? 0.018 : 0.04}
          />
        ))}
        {Array.from({ length: quiet ? 0 : 14 }, (_, i) => {
          const x =
            ((i * 137 + frame * (0.4 + (i % 4) * 0.2)) % (width + 80)) - 40;
          const y = (i * 211) % height;
          return (
            <circle
              key={`p${i}`}
              cx={x}
              cy={y + Math.sin((frame + i * 20) / 30) * 18}
              r={3 + (i % 3) * 2}
              fill={accent}
              fillOpacity={0.08}
            />
          );
        })}
      </svg>
      {visual === "complexity" && <ComplexityChart words={words} />}
    </AbsoluteFill>
  );
}

const curves = [
  { label: "O(1)", color: "#34D399", f: () => 1 },
  { label: "O(log n)", color: "#60A5FA", f: (n: number) => Math.log2(n + 1) },
  { label: "O(n)", color: "#FBBF24", f: (n: number) => n },
  {
    label: "O(n log n)",
    color: "#F472B6",
    f: (n: number) => n * Math.log2(n + 1),
  },
  { label: "O(n²)", color: "#F87171", f: (n: number) => n * n },
];

/** Which curve the narration is talking about, from the words spoken so far. */
const focusRules: [RegExp, string][] = [
  [/squared|n²|quadratic/i, "O(n²)"],
  [/n log n|log-linear/i, "O(n log n)"],
  [/\blog\b|logarithm|halv/i, "O(log n)"],
  [/linear|straight|\bo of n\b/i, "O(n)"],
  [/constant|flat|o of one|\bo\(1\)/i, "O(1)"],
];
function spokenFocus(words: Word[], frame: number) {
  let focus: string | null = null;
  const spoken = words.filter((w) => w.from <= frame);
  // Look at a sliding window so phrases like "O of n squared" match as a whole.
  for (let i = 0; i < spoken.length; i++) {
    const phrase = spoken
      .slice(Math.max(0, i - 3), i + 1)
      .map((w) => w.text)
      .join(" ");
    for (const [rule, label] of focusRules)
      if (rule.test(phrase)) {
        focus = label;
        break;
      }
  }
  return focus;
}

/** Big O growth curves that grow once across the video and spotlight the curve being discussed. */
export function ComplexityChart({
  words,
  focus: forced,
  top = 150,
  visibility = 1,
}: {
  words: Word[];
  focus?: string | null;
  top?: number;
  visibility?: number;
}) {
  const frame = useCurrentFrame();
  const { width, durationInFrames } = useVideoConfig();
  const grow = interpolate(frame, [15, durationInFrames * 0.75], [0, 1], clamp);
  const fade = visibility;
  const appear = interpolate(frame, [0, 15], [0, 1], clamp);
  const focus = forced ?? spokenFocus(words, frame);
  const maxN = 20;
  const n = Math.max(1, grow * maxN);
  const left = 90,
    w = width - 150,
    h = 440;
  const yMax = maxN * 1.6;
  const point = (x: number, value: number) => {
    const px = left + (x / maxN) * w;
    const py = top + h - (Math.min(value, yMax) / yMax) * h;
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  };
  return (
    <svg
      width={width}
      height={700}
      style={{ position: "absolute", top: 0, opacity: appear * fade }}
    >
      <rect
        x={left - 30}
        y={top - 40}
        width={w + 60}
        height={h + 90}
        rx={28}
        fill="#0B0A18"
        fillOpacity={0.55}
        stroke="#ffffff"
        strokeOpacity={0.08}
      />
      <line
        x1={left}
        y1={top}
        x2={left}
        y2={top + h}
        stroke="#C4B5FD"
        strokeWidth={3}
      />
      <line
        x1={left}
        y1={top + h}
        x2={left + w}
        y2={top + h}
        stroke="#C4B5FD"
        strokeWidth={3}
      />
      <text
        x={left + w}
        y={top + h + 34}
        fill="#C4B5FD"
        fontSize={22}
        textAnchor="end"
        fontFamily="Arial, sans-serif"
      >
        input size n = {Math.round(n)}
      </text>
      <text
        x={left + 10}
        y={top - 12}
        fill="#C4B5FD"
        fontSize={22}
        fontFamily="Arial, sans-serif"
      >
        steps
      </text>
      {curves.map((curve, index) => {
        const dim = focus && focus !== curve.label;
        const samples = Array.from({ length: 48 }, (_, i) => {
          const x = (n * i) / 47;
          return point(x, curve.f(x));
        });
        const end = samples[samples.length - 1].split(",").map(Number);
        // Keep labels apart: each curve's label sits at least 32px below the faster one.
        const labelY = Math.max(
          end[1] - 12,
          top + 24 + (curves.length - 1 - index) * 32,
        );
        const nearEdge = end[0] > left + w - 170;
        return (
          <g key={curve.label}>
            <polyline
              points={samples.join(" ")}
              fill="none"
              stroke={curve.color}
              strokeWidth={focus === curve.label ? 10 : 6}
              strokeOpacity={dim ? 0.25 : 1}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={
                focus === curve.label
                  ? { filter: `drop-shadow(0 0 10px ${curve.color})` }
                  : undefined
              }
            />
            <circle cx={end[0]} cy={end[1]} r={9} fill={curve.color} />
            <text
              x={nearEdge ? end[0] - 16 : end[0] + 14}
              y={labelY}
              textAnchor={nearEdge ? "end" : "start"}
              fill={curve.color}
              fillOpacity={
                interpolate(grow, [0.25, 0.4], [0, 1], clamp) * (dim ? 0.35 : 1)
              }
              strokeOpacity={interpolate(grow, [0.25, 0.4], [0, 1], clamp)}
              fontSize={26}
              fontWeight={800}
              fontFamily="Arial, sans-serif"
              stroke="#0B0A18"
              strokeWidth={6}
              paintOrder="stroke"
            >
              {curve.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Short caption phrase in a dark pill; the word being spoken is bright, the rest dimmed. */
export function WordCaptions({
  words,
  color,
  fontSize,
  top = "86%",
}: {
  words: Word[];
  color: string;
  fontSize: number;
  top?: string;
}) {
  const frame = useCurrentFrame();
  const groups: Word[][] = [];
  for (const word of words) {
    const last = groups[groups.length - 1];
    if (
      !last ||
      last.length >= 4 ||
      last.reduce((n, w) => n + w.text.length + 1, word.text.length) > 24 ||
      word.from - last[last.length - 1].to > 10 ||
      endsSentence(last[last.length - 1].text)
    )
      groups.push([word]);
    else last.push(word);
  }
  const index = groups.findIndex(
    (g, i) =>
      frame >= g[0].from &&
      frame < (groups[i + 1]?.[0].from ?? g[g.length - 1].to + 6),
  );
  if (index < 0) return null;
  const group = groups[index];
  const enter = interpolate(frame - group[0].from, [0, 5], [0, 1], clamp);
  return (
    <AbsoluteFill
      style={{
        top,
        height: "8%",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          opacity: enter,
          transform: `translateY(${(1 - enter) * 10}px)`,
          maxWidth: "88%",
          padding: "12px 16px",
          borderRadius: 12,
          background: "rgba(0,0,0,0.6)",
          fontFamily: "Arial, sans-serif",
          fontSize: Math.min(
            fontSize,
            group.some((w) => w.text.length > 18) ? 28 : 42,
          ),
          fontWeight: 800,
          letterSpacing: -0.5,
          textAlign: "center",
          overflowWrap: "anywhere",
        }}
      >
        {group.map((w, i) => {
          const active = frame >= w.from && frame < w.to;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                color: active ? "#0B1018" : color,
                background: active ? "#FFFFFF" : "transparent",
                borderRadius: 6,
                padding: "4px 7px",
                marginRight: i < group.length - 1 ? 2 : 0,
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

/** Narrator at the lower left: lifts slightly on every spoken word, rests between words. */
export function Mascot({
  words,
  src,
  side = 0,
  compact = false,
}: {
  words: Word[];
  src: string | null;
  side?: number;
  compact?: boolean;
}) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const word = words.find((w) => frame >= w.from && frame < w.to);
  const lift = word
    ? Math.sin(
        ((frame - word.from) / Math.max(1, word.to - word.from)) * Math.PI,
      ) * 12
    : 0;
  const enter = interpolate(frame, [0, 10], [0, 1], clamp);
  const tall = height * (compact ? 0.145 : 0.21);
  return (
    <div
      style={{
        position: "absolute",
        left: width * 0.02 + side * (width * 0.96 - tall * (src ? 0.74 : 0.66)),
        bottom: height * 0.17 + lift + Math.sin(side * Math.PI) * 24,
        width: tall * (src ? 0.74 : 0.66),
        height: tall,
        opacity: enter,
        filter: "drop-shadow(0 12px 18px rgba(0,0,0,0.55))",
      }}
    >
      {src ? (
        <Img
          src={src}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      ) : (
        <DefaultMascot talking={Boolean(word)} frame={frame} />
      )}
    </div>
  );
}

/** The channel watermark: icon tile plus account name, top left. */
export function BrandMark({
  name,
  accent,
  logo,
}: {
  name: string;
  accent: string;
  logo: string | null;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 28,
        top: 34,
        display: "flex",
        alignItems: "center",
        gap: 12,
        opacity: 0.92,
      }}
    >
      {logo ? (
        <Img src={logo} style={{ width: 46, height: 46, borderRadius: 23 }} />
      ) : (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: `linear-gradient(135deg, ${accent}, #6366F1)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Segoe UI', Arial, sans-serif",
            fontWeight: 900,
            fontSize: 24,
            color: "#fff",
            boxShadow: `0 0 18px ${accent}66`,
          }}
        >
          {name.replace(/^@/, "").charAt(0).toUpperCase()}
        </div>
      )}
      <div
        style={{
          fontFamily: "'Segoe UI', Arial, sans-serif",
          fontWeight: 700,
          fontSize: 26,
          color: "#F5F5F7",
          letterSpacing: 0.2,
        }}
      >
        {name}
      </div>
    </div>
  );
}

/** Original Clipvero mascot: a small anime-style student guide. */
function DefaultMascot({
  talking,
  frame,
}: {
  talking: boolean;
  frame: number;
}) {
  const blink = frame % 96 < 4;
  const mouth = talking ? 4 + Math.abs(Math.sin(frame * 0.7)) * 9 : 2;
  return (
    <svg viewBox="0 0 300 460" width="100%" height="100%">
      {/* back hair */}
      <path
        d="M62 120 Q40 260 70 330 L230 330 Q262 250 238 120 Z"
        fill="#1E1B3A"
      />
      {/* legs */}
      <rect x="112" y="352" width="26" height="86" rx="12" fill="#FBE3D6" />
      <rect x="162" y="352" width="26" height="86" rx="12" fill="#FBE3D6" />
      <rect x="110" y="398" width="30" height="44" rx="10" fill="#22203F" />
      <rect x="160" y="398" width="30" height="44" rx="10" fill="#22203F" />
      <ellipse cx="124" cy="446" rx="20" ry="9" fill="#3B2A22" />
      <ellipse cx="176" cy="446" rx="20" ry="9" fill="#3B2A22" />
      {/* skirt */}
      <path d="M92 300 L208 300 L236 368 L64 368 Z" fill="#2E3A7A" />
      <path
        d="M100 300 L92 368 M130 300 L126 368 M170 300 L174 368 M200 300 L208 368"
        stroke="#24306A"
        strokeWidth="4"
      />
      {/* shirt */}
      <path d="M96 200 Q150 186 204 200 L214 306 L86 306 Z" fill="#F7F7FB" />
      {/* arms */}
      <path
        d="M98 210 Q70 250 84 300"
        stroke="#F7F7FB"
        strokeWidth="26"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M202 210 Q238 236 230 196"
        stroke="#F7F7FB"
        strokeWidth="26"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="84" cy="304" r="13" fill="#FBE3D6" />
      <circle cx="230" cy="190" r="13" fill="#FBE3D6" />
      {/* sailor collar and bow */}
      <path
        d="M104 198 L150 248 L196 198 L214 222 L150 262 L86 222 Z"
        fill="#2E3A7A"
      />
      <path
        d="M110 206 L150 250 L190 206"
        stroke="#F7F7FB"
        strokeWidth="3"
        fill="none"
      />
      <path
        d="M150 250 L126 270 L140 278 L150 262 L160 278 L174 270 Z"
        fill="#F472B6"
      />
      <circle cx="150" cy="256" r="7" fill="#EC4899" />
      {/* neck and head */}
      <rect x="138" y="180" width="24" height="24" fill="#F6D5C5" />
      <ellipse cx="150" cy="126" rx="78" ry="74" fill="#FBE3D6" />
      {/* bangs */}
      <path
        d="M70 128 Q74 46 150 44 Q228 46 230 128 Q214 96 198 112 Q188 82 170 104 Q156 76 140 104 Q122 80 110 110 Q94 92 70 128 Z"
        fill="#26224A"
      />
      <path
        d="M72 124 Q64 180 76 222 L90 214 Q82 170 86 128 Z"
        fill="#26224A"
      />
      <path
        d="M228 124 Q236 180 224 222 L210 214 Q218 170 214 128 Z"
        fill="#26224A"
      />
      <rect
        x="190"
        y="74"
        width="26"
        height="7"
        rx="3"
        fill="#F472B6"
        transform="rotate(-18 203 77)"
      />
      {/* eyes */}
      {blink ? (
        <>
          <path
            d="M100 138 Q118 146 136 138"
            stroke="#26224A"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M164 138 Q182 146 200 138"
            stroke="#26224A"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <ellipse cx="118" cy="138" rx="17" ry="22" fill="#5B3FD1" />
          <ellipse cx="182" cy="138" rx="17" ry="22" fill="#5B3FD1" />
          <ellipse cx="118" cy="144" rx="11" ry="14" fill="#2E1F7A" />
          <ellipse cx="182" cy="144" rx="11" ry="14" fill="#2E1F7A" />
          <circle cx="112" cy="130" r="6" fill="#fff" />
          <circle cx="176" cy="130" r="6" fill="#fff" />
          <circle cx="124" cy="150" r="3" fill="#fff" />
          <circle cx="188" cy="150" r="3" fill="#fff" />
          <path
            d="M98 116 Q118 108 136 116"
            stroke="#26224A"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M164 116 Q182 108 202 116"
            stroke="#26224A"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        </>
      )}
      {/* blush and mouth */}
      <ellipse cx="102" cy="168" rx="12" ry="6" fill="#F9A8D4" opacity="0.7" />
      <ellipse cx="198" cy="168" rx="12" ry="6" fill="#F9A8D4" opacity="0.7" />
      <ellipse cx="150" cy="176" rx="9" ry={mouth} fill="#B83260" />
    </svg>
  );
}
