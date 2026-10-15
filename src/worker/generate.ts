import { resolve } from "node:path";
import { readFile, unlink } from "node:fs/promises";
import { dataDir, one, run } from "../server/db";
import { getAsset, insertProject } from "../server/projects";
import { stage, usage, type JobRow } from "../server/jobs";
import { openAI, type AIProvider } from "../server/providers";
import { binary, execute, storeMedia } from "../server/media";
import {
  createSchema,
  scriptTimeline,
  timelineSchema,
  type Character,
  type CreateInput,
} from "../lib/model";
import { renderProject } from "./render";

export async function generate(job: JobRow, provider: AIProvider = openAI) {
  const input = createSchema.parse(JSON.parse(job.input));
  if (input.mode === "clips") return generateClips(job, input, provider);
  stage(job.id, "Generating script");
  const characters = input.characterIds.map((id) => {
    const row = one<{ data: string }>(
      "SELECT data FROM characters WHERE workspace_id=? AND id=?",
      job.workspaceId,
      id,
    );
    if (!row) throw new Error("A selected character is no longer available.");
    return JSON.parse(row.data) as Character;
  });
  const suppliedScript = ["script", "gameplay"].includes(input.mode);
  const result = suppliedScript
    ? {
        title: input.title,
        description: "",
        scenes: input.content.split(/\n\s*\n/).filter(Boolean),
        usage: {},
      }
    : await provider.script(input, JSON.stringify(characters));
  if (!suppliedScript) usage(job, "text_generation", 1, result.usage);
  const timeline = scriptTimeline(
    result.scenes.join("\n\n"),
    input.aspect,
    input.duration,
  );
  const reference = characters.find(
    (c) => c.referenceAssetId,
  )?.referenceAssetId;
  const referencePath = reference
    ? resolve(dataDir, "assets", getAsset(job.workspaceId, reference).filename)
    : undefined;
  for (let i = 0; i < timeline.scenes.length; i++) {
    const scene = timeline.scenes[i];
    if (input.voice !== "none") {
      stage(
        job.id,
        `Generating narration · scene ${i + 1} of ${timeline.scenes.length}`,
      );
      const audio = await storeMedia(
        job.workspaceId,
        await provider.speech(scene.script, input.voice),
        "audio/mpeg",
        `Narration ${i + 1}.mp3`,
        `AI-generated speech. OpenAI ${process.env.OPENAI_SPEECH_MODEL || "gpt-4o-mini-tts"}, voice ${input.voice}. Synthetic voice; no impersonation.`,
      );
      scene.narrationId = audio.id;
      scene.durationFrames = Math.ceil((audio.duration! + 0.15) * 30);
      const transcript = await provider.transcribe(
        resolve(dataDir, "assets", audio.filename),
      );
      scene.captions = transcript.segments.map((s) => ({
        id: crypto.randomUUID(),
        from: Math.round(s.start * 30),
        to: Math.min(scene.durationFrames, Math.ceil(s.end * 30)),
        text: s.text,
      }));
      usage(job, "speech_synthesis", scene.script.length, {
        assetId: audio.id,
      });
      usage(job, "caption_alignment", audio.duration!);
    }
    if (input.generateImages) {
      stage(
        job.id,
        `Preparing visuals · scene ${i + 1} of ${timeline.scenes.length}`,
      );
      const image = await storeMedia(
        job.workspaceId,
        await provider.image(
          `Original vertical editorial illustration, no text, for this scene: ${scene.script}. Character appearance references: ${JSON.stringify(characters.map((c) => c.appearance))}. Preserve the approved reference where supplied; do not use protected characters.`,
          referencePath,
        ),
        "image/png",
        `Scene ${i + 1}.png`,
        `AI-generated image. OpenAI ${process.env.OPENAI_IMAGE_MODEL || "gpt-image-2"}. Reference-conditioned: ${Boolean(referencePath)}. Consistency requires human review.`,
      );
      scene.assetId = image.id;
      usage(job, "image_generation", 1, { assetId: image.id });
    } else if (input.sourceAssetId) scene.assetId = input.sourceAssetId;
  }
  timelineSchema.parse(timeline);
  const project = insertProject(
    job.workspaceId,
    { ...input, title: input.title || result.title },
    timeline,
  );
  run(
    "UPDATE projects SET description=?,status='rendering' WHERE id=?",
    result.description,
    project.id,
  );
  run("UPDATE jobs SET project_id=? WHERE id=?", project.id, job.id);
  job.projectId = project.id;
  await renderProject(job, project.timeline, project.id, project.revision);
}
async function generateClips(
  job: JobRow,
  input: CreateInput,
  provider: AIProvider,
) {
  const source = getAsset(job.workspaceId, input.sourceAssetId!);
  if (source.kind !== "video" || !source.duration)
    throw new Error("Select a video with a valid duration.");
  stage(job.id, "Extracting source audio");
  const temp = resolve(dataDir, `${job.id}.mp3`);
  try {
    await execute(binary("ffmpeg"), [
      "-y",
      "-i",
      resolve(dataDir, "assets", source.filename),
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      "32k",
      temp,
    ]);
    if ((await readFile(temp)).byteLength > 24 * 1024 * 1024)
      throw new Error(
        "The extracted audio is too large for transcription. Trim the source to under 90 minutes.",
      );
    stage(job.id, "Transcribing source");
    const transcript = await provider.transcribe(temp);
    usage(job, "transcription", source.duration);
    const segments = transcript.segments.filter(
      (s) => s.end > s.start && s.end <= source.duration! + 0.1,
    );
    if (!segments.length)
      throw new Error("No timestamped speech was found in this source.");
    stage(job.id, "Finding coherent segments");
    const groups: { start: number; end: number; text: string }[] = [];
    let current: { start: number; end: number; text: string } | undefined;
    for (const s of segments) {
      if (!current || s.end - current.start > input.duration) {
        if (current) groups.push(current);
        current = { ...s };
      } else
        current = {
          start: current.start,
          end: s.end,
          text: `${current.text} ${s.text}`,
        };
    }
    if (current) groups.push(current);
    const selected = groups
      .filter((g) => g.end - g.start >= 3)
      .sort(
        (a, b) =>
          Math.abs(a.end - a.start - input.duration) -
          Math.abs(b.end - b.start - input.duration),
      )
      .slice(0, input.clipCount);
    if (!selected.length)
      throw new Error(
        "No complete speech segments longer than three seconds were found.",
      );
    for (let i = 0; i < selected.length; i++) {
      const g = selected[i];
      const timeline = scriptTimeline(
        g.text,
        input.aspect,
        Math.min(180, g.end - g.start),
      );
      timeline.scenes[0].assetId = source.id;
      timeline.scenes[0].mediaStart = g.start;
      timeline.scenes[0].sourceVolume = 1;
      timeline.scenes[0].captions = segments
        .filter((s) => s.start >= g.start && s.end <= g.end)
        .map((s) => ({
          id: crypto.randomUUID(),
          from: Math.round((s.start - g.start) * 30),
          to: Math.round((s.end - g.start) * 30),
          text: s.text,
        }));
      const project = insertProject(
        job.workspaceId,
        {
          ...input,
          sourceAssetId: undefined,
          title: `${input.title} · clip ${i + 1}`.slice(0, 120),
        },
        timeline,
      );
      if (i === 0) {
        run("UPDATE jobs SET project_id=? WHERE id=?", project.id, job.id);
        job.projectId = project.id;
      }
      await renderProject(job, project.timeline, project.id, project.revision);
    }
  } finally {
    await unlink(temp).catch(() => {});
  }
}
