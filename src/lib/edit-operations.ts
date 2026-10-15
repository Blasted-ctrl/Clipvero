import { z } from "zod";
import { duration, timelineSchema, type Timeline } from "./model";
export const editOperationsSchema = z
  .array(
    z.discriminatedUnion("op", [
      z.object({
        op: z.literal("captionColor"),
        value: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      }),
      z.object({
        op: z.literal("accentColor"),
        value: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      }),
      z.object({
        op: z.literal("captionPosition"),
        value: z.enum(["center", "bottom"]),
      }),
      z.object({
        op: z.literal("musicVolume"),
        value: z.number().min(0).max(1),
      }),
      z.object({
        op: z.literal("duration"),
        value: z.number().min(1).max(180),
      }),
      z.object({
        op: z.literal("sceneCaption"),
        scene: z.number().int().min(1).max(60),
        value: z.string().max(1600),
      }),
      z.object({
        op: z.literal("removeScene"),
        scene: z.number().int().min(1).max(60),
      }),
    ]),
  )
  .min(1)
  .max(10);
export function applyEdits(
  timeline: Timeline,
  operations: z.infer<typeof editOperationsSchema>,
) {
  const next = structuredClone(timeline);
  for (const edit of editOperationsSchema.parse(operations)) {
    if (edit.op === "duration") {
      const total = duration(next),
        target = Math.round(edit.value * 30);
      let rest = target;
      next.scenes.forEach((s, i) => {
        s.durationFrames =
          i === next.scenes.length - 1
            ? rest
            : Math.max(
                15,
                Math.min(
                  rest - 15 * (next.scenes.length - i - 1),
                  Math.round((s.durationFrames * target) / total),
                ),
              );
        rest -= s.durationFrames;
      });
    } else if (edit.op === "sceneCaption") {
      const scene = next.scenes[edit.scene - 1];
      if (!scene) throw new Error("That scene does not exist.");
      scene.caption = edit.value;
      scene.captions = [];
    } else if (edit.op === "removeScene") {
      if (!next.scenes[edit.scene - 1])
        throw new Error("That scene does not exist.");
      next.scenes.splice(edit.scene - 1, 1);
    } else if (edit.op === "musicVolume") next.musicVolume = edit.value;
    else if (edit.op === "captionPosition") next.captionPosition = edit.value;
    else if (edit.op === "accentColor") next.accentColor = edit.value;
    else if (edit.op === "captionColor") next.captionColor = edit.value;
  }
  return timelineSchema.parse(next);
}
export function parseQuickEdit(command: string) {
  const volume = command.match(/music.*?(\d+(?:\.\d+)?)\s*%/i),
    seconds = command.match(/(?:video|duration).*?(\d+)\s*seconds?/i),
    color = command.match(/caption.*?(#[0-9a-fA-F]{6})/i);
  if (volume)
    return editOperationsSchema.parse([
      { op: "musicVolume", value: Number(volume[1]) / 100 },
    ]);
  if (seconds)
    return editOperationsSchema.parse([
      { op: "duration", value: Number(seconds[1]) },
    ]);
  if (color)
    return editOperationsSchema.parse([
      { op: "captionColor", value: color[1] },
    ]);
  if (/caption.*bottom/i.test(command))
    return editOperationsSchema.parse([
      { op: "captionPosition", value: "bottom" },
    ]);
  if (/caption.*center/i.test(command))
    return editOperationsSchema.parse([
      { op: "captionPosition", value: "center" },
    ]);
  throw new Error(
    "Try ‘music at 10%’, ‘video 30 seconds’, ‘captions at bottom’, or ‘caption color #FFFFFF’. Other instructions need an AI provider.",
  );
}
