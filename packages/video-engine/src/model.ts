import { z } from "zod";
const id = z.string().uuid();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
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
  })
  .refine(
    (s) => s.captions.every((c) => c.from < c.to && c.to <= s.durationFrames),
    "Caption timestamps must fit inside their scene.",
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
    scenes: z.array(sceneSchema).min(1).max(60),
  })
  .refine(
    (t) => t.scenes.reduce((s, x) => s + x.durationFrames, 0) <= 5400,
    "Videos may be at most 180 seconds.",
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
    scenes,
  });
}
