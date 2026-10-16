import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  Video,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BeatVisual } from "./beats";
import { SfxLayer } from "./sfx-layer";
import { BrandMark, WordCaptions, timelineWords, type Word } from "./explainer";
import type { Timeline } from "./model";

type Media = Record<string, { src: string; kind: string }>;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Two hosts talk a topic through over the owner's background recording, with
 * diagrams popping up on the lines that need them.
 */
export function ConversationComposition({
  timeline,
  media,
  mascot,
  logo,
}: {
  timeline: Timeline;
  media: Media;
  mascot: string | null;
  logo: string | null;
}) {
  const frame = useCurrentFrame();
  const words = timelineWords(timeline);
  const starts = timeline.scenes.map((_, i) =>
    timeline.scenes.slice(0, i).reduce((sum, s) => sum + s.durationFrames, 0),
  );
  let index = 0;
  starts.forEach((start, i) => {
    if (frame >= start) index = i;
  });
  const active = timeline.scenes[index]?.speaker ?? 0;
  const background = timeline.backgroundAssetId
    ? media[timeline.backgroundAssetId]
    : undefined;
  const speakers = timeline.speakers.length
    ? timeline.speakers
    : [
        { name: "Byte", color: "#F472B6", voice: "", assetId: null },
        { name: "Theo", color: "#60A5FA", voice: "", assetId: null },
      ];
  const lineWords = (i: number) =>
    words.filter(
      (w) =>
        w.from >= starts[i] &&
        w.from < starts[i] + timeline.scenes[i].durationFrames,
    );
  return (
    <AbsoluteFill style={{ backgroundColor: "#05070D" }}>
      {background?.kind === "video" ? (
        <Video
          src={background.src}
          muted
          loop
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : background ? (
        <Img
          src={background.src}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(circle at 50% 30%, #13203A 0%, #05070D 70%)",
          }}
        />
      )}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.7) 100%)",
        }}
      />
      {timeline.scenes.map((scene, i) =>
        scene.narrationId && media[scene.narrationId] ? (
          <Sequence
            key={scene.id}
            from={starts[i]}
            durationInFrames={scene.durationFrames}
          >
            <Audio src={media[scene.narrationId].src} />
          </Sequence>
        ) : null,
      )}
      {timeline.scenes.map((scene, i) =>
        scene.visual ? (
          <Sequence
            key={`pop-${scene.id}`}
            from={starts[i]}
            durationInFrames={scene.durationFrames}
          >
            <Popup
              scene={scene}
              accent={
                speakers[scene.speaker ?? 0]?.color ?? timeline.accentColor
              }
            />
          </Sequence>
        ) : null,
      )}
      {speakers.map((speaker, i) => (
        <Host
          key={speaker.name}
          side={i === 0 ? "left" : "right"}
          name={speaker.name}
          color={speaker.color}
          active={active === i}
          words={active === i ? lineWords(index) : []}
          src={
            speaker.assetId && media[speaker.assetId]
              ? media[speaker.assetId].src
              : i === 0
                ? mascot
                : null
          }
        />
      ))}
      <WordCaptions words={words} color="#FFFFFF" fontSize={46} top="57%" />
      {timeline.brand && (
        <BrandMark
          name={timeline.brand}
          accent={timeline.accentColor}
          logo={logo}
        />
      )}
      <SfxLayer timeline={timeline} media={media} />
      {timeline.musicAssetId && media[timeline.musicAssetId] && (
        <Audio
          src={media[timeline.musicAssetId].src}
          volume={timeline.musicVolume}
          loop
        />
      )}
    </AbsoluteFill>
  );
}

/** A diagram card that pops in for one line of dialogue. */
function Popup({
  scene,
  accent,
}: {
  scene: Timeline["scenes"][number];
  accent: string;
}) {
  const frame = useCurrentFrame();
  const d = scene.durationFrames;
  const pop = interpolate(frame, [0, 9], [0.82, 1], {
    ...clamp,
    easing: Easing.out(Easing.back(1.6)),
  });
  const opacity = Math.min(
    interpolate(frame, [0, 6], [0, 1], clamp),
    interpolate(frame, [d - 6, d], [1, 0], clamp),
  );
  return (
    <div
      style={{
        position: "absolute",
        left: 22,
        right: 22,
        top: 110,
        height: 560,
        borderRadius: 28,
        background: "rgba(6,9,18,0.78)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
        overflow: "hidden",
        opacity,
        transform: `scale(${pop})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: -20,
          height: 600,
        }}
      >
        <BeatVisual v={scene.visual!} f={frame} d={d} accent={accent} />
      </div>
    </div>
  );
}

/** One host at the bottom: lifts on each spoken word, dims while the other talks. */
function Host({
  side,
  name,
  color,
  active,
  words,
  src,
}: {
  side: "left" | "right";
  name: string;
  color: string;
  active: boolean;
  words: Word[];
  src: string | null;
}) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const word = words.find((w) => frame >= w.from && frame < w.to);
  const lift = word
    ? Math.sin(
        ((frame - word.from) / Math.max(1, word.to - word.from)) * Math.PI,
      ) * 14
    : 0;
  const tall = height * 0.3;
  const wide = tall * 0.74;
  return (
    <div
      style={{
        position: "absolute",
        bottom: height * 0.015 + lift,
        [side]: width * 0.02,
        width: wide,
        height: tall,
        opacity: active ? 1 : 0.55,
        transform: `scale(${active ? 1 : 0.9})`,
        transformOrigin: "50% 100%",
        // A single filter avoids Chrome painting a grey box behind transparent PNGs.
        filter: active ? "drop-shadow(0 12px 18px rgba(0,0,0,0.6))" : "none",
      }}
    >
      {src ? (
        <Img
          src={src}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      ) : (
        <TheoHost talking={Boolean(word)} frame={frame} />
      )}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: -4,
          transform: "translateX(-50%)",
          padding: "4px 14px",
          borderRadius: 999,
          background: active ? color : "rgba(0,0,0,0.6)",
          color: active ? "#0B0A18" : "#E5E7EB",
          fontFamily: "Arial, sans-serif",
          fontWeight: 900,
          fontSize: 22,
        }}
      >
        {name}
      </div>
    </div>
  );
}

/** Original co-host: a calm engineer in a hoodie with glasses and headphones. */
function TheoHost({ talking, frame }: { talking: boolean; frame: number }) {
  const blink = frame % 110 < 4;
  const mouth = talking ? 3 + Math.abs(Math.sin(frame * 0.7)) * 8 : 2;
  return (
    <svg viewBox="0 0 300 460" width="100%" height="100%">
      <path d="M70 300 Q150 250 230 300 L250 460 L50 460 Z" fill="#1E3A8A" />
      <path
        d="M118 262 Q150 300 182 262 L176 316 Q150 330 124 316 Z"
        fill="#1D4ED8"
      />
      <path
        d="M128 300 L128 360 M172 300 L172 360"
        stroke="#93C5FD"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <rect x="132" y="230" width="36" height="40" fill="#E8B796" />
      <path
        d="M86 246 Q150 284 214 246"
        stroke="#111827"
        strokeWidth="12"
        fill="none"
      />
      <circle cx="86" cy="246" r="14" fill="#111827" />
      <circle cx="214" cy="246" r="14" fill="#111827" />
      <ellipse cx="150" cy="160" rx="72" ry="80" fill="#F1C7A6" />
      <path
        d="M78 150 Q72 70 150 64 Q232 66 224 150 Q214 112 196 118 Q186 92 166 106 Q150 84 134 104 Q114 88 104 116 Q90 108 78 150 Z"
        fill="#1F2937"
      />
      <rect
        x="98"
        y="142"
        width="44"
        height="32"
        rx="8"
        fill="none"
        stroke="#0F172A"
        strokeWidth="5"
      />
      <rect
        x="158"
        y="142"
        width="44"
        height="32"
        rx="8"
        fill="none"
        stroke="#0F172A"
        strokeWidth="5"
      />
      <line
        x1="142"
        y1="156"
        x2="158"
        y2="156"
        stroke="#0F172A"
        strokeWidth="5"
      />
      {blink ? (
        <>
          <line
            x1="110"
            y1="160"
            x2="130"
            y2="160"
            stroke="#0F172A"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <line
            x1="170"
            y1="160"
            x2="190"
            y2="160"
            stroke="#0F172A"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <circle cx="120" cy="159" r="7" fill="#0F172A" />
          <circle cx="180" cy="159" r="7" fill="#0F172A" />
          <circle cx="122" cy="156" r="2.5" fill="#fff" />
          <circle cx="182" cy="156" r="2.5" fill="#fff" />
        </>
      )}
      <path
        d="M104 130 Q120 124 136 132 M164 132 Q180 124 196 130"
        stroke="#1F2937"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="150" cy="206" rx="13" ry={mouth} fill="#7F1D1D" />
    </svg>
  );
}
