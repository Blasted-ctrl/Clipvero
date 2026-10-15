import { z } from "zod";

export const modes = [
  {
    id: "prompt",
    name: "Prompt to video",
    description: "An idea. A story. A finished short.",
    icon: "sparkles",
    ai: true,
  },
  {
    id: "script",
    name: "Script to video",
    description: "Your words, brought to the screen.",
    icon: "text",
    ai: false,
  },
  {
    id: "characters",
    name: "Character stories",
    description: "Original characters. A world of your own.",
    icon: "users",
    ai: true,
  },
  {
    id: "story",
    name: "Narrated stories",
    description: "Give your original stories a voice.",
    icon: "book",
    ai: true,
  },
  {
    id: "gameplay",
    name: "Gameplay stories",
    description: "Your footage, with a story on top.",
    icon: "gamepad",
    ai: false,
  },
  {
    id: "explainer",
    name: "Educational explainer",
    description: "Make a big idea easy to understand.",
    icon: "lightbulb",
    ai: true,
  },
  {
    id: "marketing",
    name: "Product & marketing",
    description: "Put your product in the spotlight.",
    icon: "megaphone",
    ai: true,
  },
  {
    id: "clips",
    name: "Long video to clips",
    description: "Find the moments worth sharing.",
    icon: "scissors",
    ai: true,
  },
] as const;
export const modeSchema = z.enum([
  "prompt",
  "script",
  "characters",
  "story",
  "gameplay",
  "explainer",
  "marketing",
  "clips",
]);
export const voices = [
  "none",
  "alloy",
  "ash",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
] as const;
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
export type Mode = z.infer<typeof modeSchema>;
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
export const createSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    mode: modeSchema,
    content: z.string().trim().min(1).max(12000),
    duration: z.number().int().min(5).max(180).default(30),
    aspect: z.enum(["9:16", "1:1", "16:9"]).default("9:16"),
    voice: z.enum(voices).default("none"),
    tone: z
      .enum([
        "Conversational",
        "Dramatic",
        "Educational",
        "Playful",
        "Professional",
      ])
      .default("Conversational"),
    language: z
      .enum(["English", "Spanish", "French", "German", "Portuguese"])
      .default("English"),
    generateImages: z.boolean().default(false),
    sourceAssetId: id.optional(),
    characterIds: z.array(id).max(4).default([]),
    presetId: id.optional(),
    clipCount: z.number().int().min(1).max(5).default(3),
    rightsConfirmed: z.literal(true),
  })
  .refine(
    (input) =>
      !["script", "gameplay"].includes(input.mode) ||
      input.content.split(/\n\s*\n/).filter((s) => s.trim()).length <= 60,
    "Use at most 60 scenes separated by blank lines.",
  )
  .refine(
    (input) =>
      !input.generateImages ||
      !["script", "gameplay"].includes(input.mode) ||
      input.content.split(/\n\s*\n/).filter((s) => s.trim()).length <= 6,
    "AI illustrations support at most six scenes per video. Combine paragraphs or use your own visuals for longer scripts.",
  );
export type CreateInput = z.infer<typeof createSchema>;
export const characterSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(2000),
  personality: z.string().max(1000),
  appearance: z.string().max(2000),
  voice: z.enum(voices),
  speechStyle: z.string().max(1000),
  continuity: z.string().max(3000),
  referenceAssetId: id.nullable(),
  rightsConfirmed: z.literal(true),
});
export const presetSchema = z.object({
  name: z.string().trim().min(1).max(80),
  accentColor: color,
  captionColor: color,
  fontSize: z.number().int().min(24).max(100),
  captionPosition: z.enum(["center", "bottom"]),
  voice: z.enum(voices),
  tone: z.string().max(100),
  audience: z.string().max(500),
});
export const pipelineSchema = z.object({
  name: z.string().trim().min(1).max(100),
  config: createSchema,
  intervalHours: z.number().int().min(24).max(720),
  maxRuns: z.number().int().min(1).max(120),
  budget: z.number().int().min(1).max(1200),
});
export type Project = {
  id: string;
  title: string;
  mode: Mode;
  status: string;
  timeline: Timeline;
  revision: number;
  renderedRevision: number | null;
  outputAssetId: string | null;
  createdAt: number;
  updatedAt: number;
  scheduledAt: number | null;
  description: string;
};
export type Asset = {
  id: string;
  name: string;
  kind: string;
  mime: string;
  bytes: number;
  duration: number | null;
  provenance: string;
  createdAt: number;
};
export type Job = {
  id: string;
  projectId: string | null;
  pipelineId: string | null;
  kind: string;
  state: string;
  stage: string;
  progress: number | null;
  error: string | null;
  createdAt: number;
  cost: number;
  revision: number;
};
export type Character = z.infer<typeof characterSchema> & { id: string };
export type Preset = z.infer<typeof presetSchema> & { id: string };
export type Pipeline = z.infer<typeof pipelineSchema> & {
  id: string;
  active: boolean;
  nextRun: number;
  runs: number;
  spent: number;
};
export const plans = {
  starter: { name: "Starter", price: 29, videos: 12, credits: 120 },
  creator: { name: "Creator", price: 79, videos: 40, credits: 400 },
  studio: { name: "Studio", price: 199, videos: 120, credits: 1200 },
} as const;
export function estimateCost(input: CreateInput) {
  return (
    Math.ceil(input.duration / 60) +
    (input.mode === "clips"
      ? 5 * input.clipCount
      : (["script", "gameplay"].includes(input.mode) ? 0 : 2) +
        (input.voice !== "none" ? 2 : 0) +
        (input.generateImages ? 5 : 0))
  );
}
