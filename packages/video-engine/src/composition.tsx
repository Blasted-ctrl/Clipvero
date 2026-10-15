import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import type { Timeline, Scene } from "./model";

export type MediaMap = Record<string, { src: string; kind: string }>;
export type CompositionProps = { timeline: Timeline; media: MediaMap };
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
export function VideoComposition({ timeline, media }: CompositionProps) {
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
