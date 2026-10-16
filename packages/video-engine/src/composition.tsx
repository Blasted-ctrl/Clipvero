import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  Easing,
  useCurrentFrame,
} from "remotion";
import type { Timeline, Scene } from "./model";
import { ConversationComposition } from "./conversation";
import { BeatVisual } from "./beats";
import { CodeLines, CodeTokensContext } from "./code-view";
import type { CodeTokens } from "./code-key";
import { CostPanel, costCount, costValue, cueFrame } from "./cost-panel";
import { linkedFrame } from "./linked-state";
import { graphFrame } from "./graph-state";
import {
  BrandMark,
  ComplexityChart,
  ExplainerBackground,
  Mascot,
  WordCaptions,
  timelineWords,
  type Word,
} from "./explainer";

export type MediaMap = Record<string, { src: string; kind: string }>;
/** Media key for the default mascot image shipped with Clipvero. */
export const BUILTIN_MASCOT = "builtin-mascot";
/** Media key for the channel logo shown in the watermark. */
export const BUILTIN_LOGO = "builtin-logo";
/** Built-in media files, relative to the web app's public folder. */
export const builtinMedia = {
  [BUILTIN_MASCOT]: "/mascots/default.png",
  [BUILTIN_LOGO]: "/brand/logo.png",
};
export type CompositionProps = {
  timeline: Timeline;
  media: MediaMap;
  /** Pre-highlighted code from code-tokens.ts; omitted blocks draw as plain text. */
  code?: CodeTokens;
};
function SceneView({
  scene,
  timeline,
  media,
}: { scene: Scene } & CompositionProps) {
  const frame = useCurrentFrame();
  const asset = scene.assetId ? media[scene.assetId] : null;
  const opacity =
    scene.transition === "fade"
      ? interpolate(frame, [0, 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;
  const caption = scene.captions.length
    ? scene.captions.find((c) => frame >= c.from && frame < c.to)?.text || ""
    : scene.caption;
  return (
    <AbsoluteFill style={{ backgroundColor: scene.background, opacity }}>
      {asset &&
        (asset.kind === "video" ? (
          <OffthreadVideo
            src={asset.src}
            startFrom={Math.round(scene.mediaStart * 30)}
            volume={scene.sourceVolume}
            style={{ width: "100%", height: "100%", objectFit: scene.fit }}
          />
        ) : (
          <Img
            src={asset.src}
            style={{ width: "100%", height: "100%", objectFit: scene.fit }}
          />
        ))}
      {asset && caption && (
        <AbsoluteFill style={{ backgroundColor: "rgba(0,0,0,0.28)" }} />
      )}
      {caption && (
        <AbsoluteFill
          style={{
            justifyContent:
              timeline.captionPosition === "bottom" ? "flex-end" : "center",
            padding: "12% 8%",
            textAlign: "center",
            fontFamily: "Arial, sans-serif",
            color: timeline.captionColor,
          }}
        >
          <div
            style={{
              fontSize: timeline.fontSize,
              fontWeight: 800,
              lineHeight: 1.25,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              textShadow: "0 2px 10px rgba(0,0,0,0.8)",
            }}
          >
            {caption}
          </div>
          <div
            style={{
              height: 5,
              width: 64,
              backgroundColor: timeline.accentColor,
              margin: "24px auto 0",
            }}
          />
        </AbsoluteFill>
      )}
      {scene.narrationId && media[scene.narrationId] && (
        <Audio src={media[scene.narrationId].src} />
      )}
    </AbsoluteFill>
  );
}
/** Word cues from narration, or evenly spaced words when a scene has none. */
function explainerWords(timeline: Timeline): Word[] {
  let offset = 0;
  const words: Word[] = [];
  for (const scene of timeline.scenes) {
    if (scene.captions.length) {
      words.push(
        ...timelineWords({ ...timeline, scenes: [scene] }).map((w) => ({
          ...w,
          from: w.from + offset,
          to: w.to + offset,
        })),
      );
      offset += scene.durationFrames;
      continue;
    }
    if (scene.narrationId) {
      offset += scene.durationFrames;
      continue;
    }
    const parts = scene.caption.split(/\s+/).filter(Boolean);
    const step = scene.durationFrames / Math.max(1, parts.length);
    parts.forEach((text, i) =>
      words.push({
        text,
        from: Math.round(offset + i * step),
        to: Math.round(offset + (i + 1) * step),
      }),
    );
    offset += scene.durationFrames;
  }
  return words;
}
const FADE = 8;
/** The Big O chart persists across consecutive chart beats so it never restarts. */
function ChartLayer({
  timeline,
  starts,
  frame,
  words,
}: {
  timeline: Timeline;
  starts: number[];
  frame: number;
  words: Word[];
}) {
  const index = currentScene(starts, frame);
  const scene = timeline.scenes[index];
  const visibleAt = (i: number) => timeline.scenes[i]?.visual?.type === "chart";
  const into = frame - starts[index];
  const left = starts[index] + scene.durationFrames - frame;
  let visibility = visibleAt(index) ? 1 : 0;
  if (visibleAt(index) && !visibleAt(index - 1))
    visibility = Math.min(1, into / FADE);
  if (visibleAt(index) && !visibleAt(index + 1))
    visibility = Math.min(visibility, left / FADE);
  if (visibility <= 0) return null;
  const visual = scene.visual?.type === "chart" ? scene.visual : null;
  return (
    <ComplexityChart
      words={words}
      focus={visual?.focus ?? null}
      top={200}
      visibility={visibility}
    />
  );
}
function currentScene(starts: number[], frame: number) {
  let index = 0;
  starts.forEach((start, i) => {
    if (frame >= start) index = i;
  });
  return index;
}
function BeatStage({ scenes, accent }: { scenes: Scene[]; accent: string }) {
  const frame = useCurrentFrame();
  const starts = scenes.map((_, i) =>
    scenes.slice(0, i).reduce((sum, s) => sum + s.durationFrames, 0),
  );
  const total = scenes.reduce((sum, scene) => sum + scene.durationFrames, 0);
  const local = Math.min(frame, total - 1);
  const index = currentScene(starts, local);
  const scene = scenes[index];
  if (!scene.visual) return null;
  let visual = scene.visual;
  let previousVisual =
    index > 0 ? (scenes[index - 1].visual ?? undefined) : undefined;
  if (previousVisual?.type === "linked-list" && previousVisual.steps?.length)
    previousVisual = linkedFrame(
      previousVisual,
      scenes[index - 1].durationFrames,
      scenes[index - 1].captions,
    ).visual;
  let visualFrame = local - starts[index];
  if (visual.type === "linked-list" && visual.steps?.length) {
    const resolved = linkedFrame(visual, visualFrame, scene.captions);
    visual = resolved.visual;
    previousVisual = resolved.previous;
    visualFrame = resolved.frame;
  }
  if (visual.type === "graph" && visual.steps?.length) {
    const resolved = graphFrame(
      visual,
      previousVisual,
      visualFrame,
      scene.captions,
    );
    visual = resolved.visual;
    previousVisual = resolved.previous;
    visualFrame = resolved.frame;
  }
  const focus =
    visual.type === "complexity"
      ? visual.focus
      : visual.type === "pointers"
        ? "O(n)"
        : null;
  const trackedRow =
    scene.cost &&
    (visual.type === "pointers"
      ? scene.cost.unit === "pair checks" &&
        scene.cost.n === visual.items.length
        ? scene.cost.rows[0]
        : undefined
      : visual.type === "complexity"
        ? scene.cost.rows.find((row) => row.complexity === focus)
        : (visual.type === "array" ||
              visual.type === "hashmap" ||
              visual.type === "linked-list" ||
              visual.type === "structure") &&
            visual.costRow !== undefined
          ? scene.cost.rows[visual.costRow]
          : undefined);
  if (
    visual.type === "array" &&
    visual.mode === "scan" &&
    visual.costRow !== undefined &&
    scene.cost
  ) {
    const count = costCount(
      scene.cost.rows[visual.costRow],
      local - starts[index],
      scene.durationFrames,
      scene.captions,
    );
    visual = {
      ...visual,
      step: Math.max(0, count - 1),
      showPointer: count > 0,
      showResult: count >= (visual.target ?? visual.items.length - 1) + 1,
    };
  }
  const ease = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  } as const;
  const enter = interpolate(frame, [0, 10], [scene.cost ? 0.65 : 0, 1], ease);
  const exit = interpolate(frame, [total, total + 8], [0, 1], ease);
  const scaleFor = (s: Scene) =>
    s.presentation?.camera === "close" ? (s.cost ? 1.035 : 1.08) : 1;
  const camera = interpolate(
    local - starts[index],
    [0, 16],
    [scaleFor(scenes[Math.max(0, index - 1)]), scaleFor(scene)],
    ease,
  );
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: scene.cost ? 90 : 150,
        height: 600,
        opacity: enter * (1 - exit),
        transformOrigin: scene.cost ? "50% 0%" : "50% 50%",
        transform: `translateY(${(1 - enter) * 26 - exit * 20}px) scale(${(scene.cost ? 0.84 : 1) * camera * (0.94 + 0.06 * enter)})`,
      }}
    >
      <BeatVisual
        v={visual}
        f={
          visualFrame -
          (scene.visual.type === "hashmap" ||
          scene.visual.type === "pointers" ||
          scene.visual.type === "structure" ||
          scene.visual.type === "call-stack"
            ? cueFrame(scene.visual.cue, scene.captions)
            : 0)
        }
        d={scene.durationFrames}
        accent={accent}
        count={
          trackedRow
            ? costCount(
                trackedRow,
                local - starts[index],
                scene.durationFrames,
                scene.captions,
              )
            : undefined
        }
        inputSize={scene.cost?.n}
        cueFrames={
          scene.visual.type === "structure" ||
          scene.visual.type === "call-stack" ||
          scene.visual.type === "graph"
            ? scene.visual.cues?.map((cue) => cueFrame(cue, scene.captions))
            : undefined
        }
        countProgress={
          trackedRow
            ? costValue(
                trackedRow,
                local - starts[index],
                scene.durationFrames,
                scene.captions,
              )
            : undefined
        }
        continuing={index > 0}
        previous={previousVisual}
      />
    </div>
  );
}
function ExplainerComposition({ timeline, media }: CompositionProps) {
  const frame = useCurrentFrame();
  const words = explainerWords(timeline);
  const beats = timeline.scenes.some((scene) => scene.visual);
  const mascotSrc =
    timeline.mascot === "asset" && timeline.mascotAssetId
      ? (media[timeline.mascotAssetId]?.src ?? null)
      : (media[BUILTIN_MASCOT]?.src ?? null);
  const starts = timeline.scenes.map((_, i) =>
    timeline.scenes.slice(0, i).reduce((sum, s) => sum + s.durationFrames, 0),
  );
  const currentIndex = currentScene(starts, frame);
  const current = timeline.scenes[currentIndex];
  const previous = timeline.scenes[Math.max(0, currentIndex - 1)];
  const into = frame - starts[currentIndex];
  const side = current.presentation?.mascotSide === "right" ? 1 : 0;
  const previousSide = previous.presentation?.mascotSide === "right" ? 1 : 0;
  const travel = interpolate(into, [0, 16], [previousSide, side], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const codeOpacity =
    previousSide === side
      ? 1
      : interpolate(into, [12, 20], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  const groups: { from: number; scenes: Scene[] }[] = [];
  timeline.scenes.forEach((scene, i) => {
    const group = groups[groups.length - 1];
    const previous = group?.scenes[group.scenes.length - 1];
    if (
      scene.panel &&
      previous?.panel === scene.panel &&
      previous.visual?.type === scene.visual?.type
    )
      group.scenes.push(scene);
    else groups.push({ from: starts[i], scenes: [scene] });
  });
  return (
    <AbsoluteFill>
      <ExplainerBackground
        visual={beats ? "grid" : timeline.visual}
        words={words}
        accent={timeline.accentColor}
        quiet={Boolean(current.cost)}
      />
      {beats && (
        <ChartLayer
          timeline={timeline}
          starts={starts}
          frame={frame}
          words={words}
        />
      )}
      {beats &&
        groups.map((group) =>
          group.scenes[0].visual?.type !== "chart" ? (
            <Sequence
              key={group.scenes[0].id}
              from={group.from}
              durationInFrames={
                8 +
                group.scenes.reduce(
                  (sum, scene) => sum + scene.durationFrames,
                  0,
                )
              }
            >
              <BeatStage scenes={group.scenes} accent={timeline.accentColor} />
            </Sequence>
          ) : null,
        )}
      {current.cost && (
        <CostPanel
          cost={current.cost}
          frame={into}
          duration={current.durationFrames}
          captions={current.captions}
          accent={timeline.accentColor}
        />
      )}
      {!current.cost && current.presentation?.reaction && (
        <div
          style={{
            position: "absolute",
            top: 755,
            left: 55,
            right: 55,
            textAlign: "center",
            pointerEvents: "none",
            opacity: interpolate(into, [12, 20], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `translateY(${interpolate(into, [12, 22], [12, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
          }}
        >
          <span
            style={{
              display: "inline-block",
              background: timeline.accentColor,
              color: "#08111A",
              padding: "7px 20px",
              borderRadius: 8,
              fontFamily: "Arial, sans-serif",
              fontWeight: 900,
              fontSize: 27,
              transform: "rotate(-2deg)",
            }}
          >
            {current.presentation.reaction}
          </span>
        </div>
      )}
      {current.code &&
        (() => {
          // Size the panel from its line count so it stays clear of the captions.
          const lines = current.code.lines;
          const top = current.cost ? 902 : 820;
          const pad = current.cost ? 12 : 18;
          const lineHeight = Math.max(
            18,
            Math.min(
              current.cost ? 28 : 36,
              Math.floor((1088 - top - pad * 2) / lines.length),
            ),
          );
          const widest = Math.max(...lines.map((line) => line.length));
          const fontSize = Math.max(
            11,
            Math.min(
              20,
              lines.length <= 5 ? 20 : Math.floor(lineHeight * 0.66),
              Math.floor(416 / (widest * 0.56)),
            ),
          );
          return (
            <div
              style={{
                position: "absolute",
                top,
                left: side ? 32 : 240,
                width: 448,
                opacity: codeOpacity,
                padding: `${pad}px 0`,
                border: "1px solid #253140",
                borderRadius: 12,
                background: "#101720",
                fontFamily: "Consolas, monospace",
              }}
            >
              <CodeLines
                lines={lines}
                f={into}
                accent={timeline.accentColor}
                fontSize={fontSize}
                lineHeight={lineHeight}
                highlight={current.code.highlight}
                previous={previous.code ?? undefined}
              />
            </div>
          );
        })()}
      {timeline.brand && (
        <BrandMark
          name={timeline.brand}
          accent={timeline.accentColor}
          logo={media[BUILTIN_LOGO]?.src ?? null}
        />
      )}
      {timeline.scenes.map((scene, i) => {
        const from = starts[i];
        return scene.narrationId && media[scene.narrationId] ? (
          <Sequence
            key={scene.id}
            from={from}
            durationInFrames={scene.durationFrames}
          >
            <Audio src={media[scene.narrationId].src} />
          </Sequence>
        ) : null;
      })}
      <WordCaptions
        words={words}
        color={timeline.captionColor}
        fontSize={timeline.fontSize}
      />
      {timeline.mascot !== "none" && (
        <Mascot
          words={words}
          src={mascotSrc}
          side={travel}
          compact={Boolean(current.cost)}
        />
      )}
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
export function VideoComposition(props: CompositionProps) {
  return (
    <CodeTokensContext.Provider value={props.code ?? {}}>
      <ExplainerOrClassic {...props} />
    </CodeTokensContext.Provider>
  );
}
function ExplainerOrClassic({ timeline, media }: CompositionProps) {
  if (timeline.style === "conversation")
    return (
      <ConversationComposition
        timeline={timeline}
        media={media}
        mascot={media[BUILTIN_MASCOT]?.src ?? null}
        logo={media[BUILTIN_LOGO]?.src ?? null}
      />
    );
  if (timeline.style === "explainer")
    return <ExplainerComposition timeline={timeline} media={media} />;
  return (
    <AbsoluteFill style={{ backgroundColor: "#09090B" }}>
      {timeline.scenes.map((scene, i) => (
        <Sequence
          key={scene.id}
          from={timeline.scenes
            .slice(0, i)
            .reduce((sum, s) => sum + s.durationFrames, 0)}
          durationInFrames={scene.durationFrames}
        >
          <SceneView scene={scene} timeline={timeline} media={media} />
        </Sequence>
      ))}
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
