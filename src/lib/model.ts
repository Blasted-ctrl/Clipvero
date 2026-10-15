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
export {
  sceneSchema,
  timelineSchema,
  dimensions,
  duration,
  scriptTimeline,
} from "@clipvero/video-engine/model";
export type { Timeline, Scene } from "@clipvero/video-engine/model";
import { type Timeline } from "@clipvero/video-engine/model";
export type Mode = z.infer<typeof modeSchema>;
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
