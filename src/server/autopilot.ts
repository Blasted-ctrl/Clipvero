import { z } from "zod";
import { batchSchema } from "@/lib/automation";
import { createSchema, estimateCost, type CreateInput } from "@/lib/model";
import { all, one, run } from "./db";
import { AppError } from "./errors";
import { createBatch, createGrant, revokeGrant } from "./automation";
import { availableWriters, writeText } from "./text-router";
import { markTopicUsed, nextTopics, similar, type TopicIdea } from "./topics";
import { scriptStyleGuide } from "@/lib/script-style";

/**
 * A content run: "make N videos over the next H hours". Topics come from the
 * ideas library first, then are brainstormed and deduplicated against everything
 * already made. Videos are queued under an internal, token-less agent grant, so
 * the allowance, credit budget, schedule and approval policy are the same ones
 * an external agent is held to, and the owner can revoke the run like any grant.
 */
export const contentRunSchema = z
  .object({
    count: z.number().int().min(1).max(200),
    hours: z.number().int().min(1).max(144),
    style: z.enum(["explainer", "conversation"]).default("explainer"),
    voice: z.enum(["free-cute", "free-warm", "free-deep"]).default("free-cute"),
    backgroundAssetId: z.string().uuid().optional(),
    duration: z.number().int().min(30).max(120).default(60),
    niche: z
      .string()
      .trim()
      .min(3)
      .max(200)
      .default("data structures and algorithms for beginners"),
    connectionIds: z.array(z.string().uuid()).max(2).default([]),
    /** Publish to Instagram without a per-video review, within this run's limits. */
    automatic: z.boolean().default(false),
  })
  .strict()
  .refine(
    (run) => run.style !== "conversation" || run.backgroundAssetId,
    "Choose your gameplay recording for conversation videos.",
  );
export type ContentRun = z.infer<typeof contentRunSchema>;

const MARGIN_MINUTES = 6 * 60;

/** One video's request, shared by the cost estimate and the real batch. */
export function runVideo(
  run: ContentRun,
  topic: { topic: string; angle: string },
): CreateInput {
  return createSchema.parse({
    title: topic.topic.slice(0, 120),
    mode: "explainer",
    content: `${topic.topic}. ${topic.angle}`.trim().slice(0, 12000),
    duration: run.duration,
    aspect: "9:16",
    voice: run.voice,
    tone: "Educational",
    language: "English",
    generateImages: false,
    style: run.style,
    visual: "grid",
    sourceAssetId:
      run.style === "conversation" ? run.backgroundAssetId : undefined,
    rightsConfirmed: true,
  });
}

/** Credits one video of this run reserves, and the schedule that fits the window. */
export function planRun(run: ContentRun, now = Date.now()) {
  const perVideo = estimateCost(
    runVideo(run, { topic: "Estimate", angle: "" }),
  );
  const interval = Math.max(15, Math.floor((run.hours * 60) / run.count));
  const windowMinutes = Math.max(run.hours * 60, run.count * interval);
  if (windowMinutes + MARGIN_MINUTES > 7 * 24 * 60)
    throw new AppError(
      422,
      "That many videos can't fit in one window at a safe spacing. Lower the count or lengthen the window to under a week.",
    );
  const startAt = now + 2 * 60000;
  return {
    perVideo,
    interval,
    startAt,
    endAt: startAt + windowMinutes * 60000,
    expiresHours: Math.ceil((windowMinutes + MARGIN_MINUTES) / 60),
  };
}

const brainstormSchema = z.object({
  topics: z
    .array(
      z.object({
        topic: z.string().trim().min(3).max(90),
        angle: z.string().trim().max(200).default(""),
      }),
    )
    .max(40),
});

/** Every topic already used or queued, so new ones don't repeat. */
function knownTopics(workspace: string) {
  return [
    ...all<{ topic: string }>(
      "SELECT topic FROM topic_ideas WHERE workspace_id=?",
      workspace,
    ).map((r) => r.topic),
    ...all<{ title: string }>(
      "SELECT title FROM projects WHERE workspace_id=?",
      workspace,
    ).map((r) => r.title),
  ];
}

/** Asks the script writer for fresh topics until the queue can cover `needed`. */
async function brainstorm(workspace: string, needed: number, niche: string) {
  const known = knownTopics(workspace);
  const fresh: { topic: string; angle: string }[] = [];
  for (let round = 0; round < 4 && fresh.length < needed; round++) {
    const want = Math.min(30, needed - fresh.length + 5);
    const avoid = [...known, ...fresh.map((t) => t.topic)].slice(-120);
    const { text } =
      await writeText(`You plan short educational videos (Instagram Reels, 45-90 s) for the ByteTheory tech channel.
Niche: ${niche}.
List ${want} DISTINCT, specific, self-contained video topics (one concept each, e.g. "Why binary search needs a sorted list"), each with a one-line angle that makes it interesting. Prefer concrete concepts a beginner can see animated. Vary the area: arrays, hashing, trees, graphs, sorting, recursion, complexity, memory, concurrency, the web.
Do NOT repeat or paraphrase any of these existing topics: ${JSON.stringify(avoid)}.
${scriptStyleGuide}
Reply with ONLY JSON: {"topics":[{"topic":"...","angle":"..."}]}`);
    let topics;
    try {
      topics = brainstormSchema.parse(
        JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)),
      ).topics;
    } catch {
      continue;
    }
    for (const topic of topics)
      if (
        ![...known, ...fresh.map((t) => t.topic)].some((t) =>
          similar(t, topic.topic),
        )
      )
        fresh.push(topic);
  }
  for (const topic of fresh)
    run(
      "INSERT INTO topic_ideas(id,workspace_id,source_id,chapter,topic,angle,style,created_at) VALUES (?,?,NULL,NULL,?,?,'explainer',?)",
      crypto.randomUUID(),
      workspace,
      topic.topic,
      topic.angle,
      Date.now(),
    );
  return fresh.length;
}

/** The next `count` topics: the ideas library first, then brainstormed ones. */
export async function pickTopics(
  workspace: string,
  count: number,
  niche: string,
) {
  let topics = nextTopics(workspace, count);
  if (topics.length < count) {
    await brainstorm(workspace, count - topics.length, niche);
    topics = nextTopics(workspace, count);
  }
  return topics;
}

export type RunResult = {
  grantId: string;
  requested: number;
  queued: number;
  perVideoCredits: number;
  intervalMinutes: number;
  firstUpload: number | null;
  lastUpload: number | null;
  automatic: boolean;
  topics: string[];
  stoppedBecause: string | null;
};

export async function startContentRun(
  workspace: string,
  data: unknown,
): Promise<RunResult> {
  const input = contentRunSchema.parse(data);
  if (!availableWriters().length)
    throw new AppError(
      503,
      "Autopilot needs a script writer. Add an AI API key to .env or install Claude Code or Codex.",
    );
  const plan = planRun(input);
  const total = plan.perVideo * input.count;
  const credits =
    one<{ credits: number }>(
      "SELECT credits FROM workspaces WHERE id=?",
      workspace,
    )?.credits ?? 0;
  if (credits < total)
    throw new AppError(
      402,
      `${input.count} videos reserve ${total} credits (${plan.perVideo} each) and this workspace has ${credits}. You can make ${Math.floor(credits / plan.perVideo)} now.`,
    );
  const topics = await pickTopics(workspace, input.count, input.niche);
  if (topics.length < input.count)
    throw new AppError(
      502,
      `Only ${topics.length} new topics could be found. Add books or notes to the ideas folder, or lower the count.`,
    );
  const publishing = input.connectionIds.length
    ? {
        connectionIds: input.connectionIds,
        automatic: input.automatic,
        startAt: plan.startAt,
        intervalMinutes: plan.interval,
        endAt: plan.endAt,
      }
    : undefined;
  // The token is discarded: nothing outside Clipvero can act on this grant.
  const { grant } = createGrant(workspace, {
    name: `Autopilot ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
    runLimit: input.count,
    creditLimit: total,
    expiresHours: plan.expiresHours,
    ...(publishing ? { publishing } : {}),
  });
  let queued = 0;
  let stoppedBecause: string | null = null;
  const used: TopicIdea[] = [];
  try {
    for (let i = 0; i < topics.length; i += 8) {
      const chunk = topics.slice(i, i + 8);
      const batch = createBatch(
        grant.id,
        batchSchema.parse({
          requestId: crypto.randomUUID(),
          videos: chunk.map((topic) => runVideo(input, topic)),
        }),
      );
      batch.videos.forEach((video, k) =>
        markTopicUsed(workspace, chunk[k].id, video.id),
      );
      queued += chunk.length;
      used.push(...chunk);
    }
  } catch (error) {
    stoppedBecause =
      error instanceof Error ? error.message : "Queueing stopped unexpectedly.";
    if (!queued) revokeGrant(workspace, grant.id);
  }
  return {
    grantId: grant.id,
    requested: input.count,
    queued,
    perVideoCredits: plan.perVideo,
    intervalMinutes: plan.interval,
    firstUpload: publishing && queued ? plan.startAt : null,
    lastUpload:
      publishing && queued
        ? plan.startAt + (queued - 1) * plan.interval * 60000
        : null,
    automatic: Boolean(publishing && input.automatic),
    topics: used.map((t) => t.topic),
    stoppedBecause,
  };
}
