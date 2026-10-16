import type { Timeline } from "./model";

/** Clipvero's original sound pack, synthesised by scripts/make-sfx.ts into public/sfx. */
export const sfxNames = [
  "whoosh",
  "swish",
  "pop",
  "tick",
  "blip",
  "ding",
  "chime",
  "thud",
  "buzz",
  "riser",
  "sparkle",
] as const;
export type SfxName = (typeof sfxNames)[number];
export const sfxId = (name: SfxName) => `builtin-sfx-${name}`;
/** Built-in media entries, keyed like the mascot and logo, served from /sfx. */
export const sfxMedia = Object.fromEntries(
  sfxNames.map((name) => [sfxId(name), `/sfx/${name}.mp3`]),
) as Record<string, string>;

export type Cue = { frame: number; sound: SfxName; volume: number };

/**
 * Decides when a sound plays, from the timeline alone, so preview and render agree.
 * Every beat that changes what is on screen gets a cue:
 * - a different diagram or panel: whoosh, just ahead of the cut
 * - the same diagram moving to its next state: tick
 * - a new code block: swish; the same block with a new highlighted line: tick
 * In a conversation only pop-up diagrams get a sound, so dialogue stays clean.
 * Cues closer than six frames apart are merged.
 */
export function planCues(timeline: Timeline): Cue[] {
  if (!timeline.sfx) return [];
  const conversation = timeline.style === "conversation";
  const cues: Cue[] = [];
  const add = (frame: number, sound: SfxName, volume: number) => {
    const at = Math.max(0, Math.round(frame));
    const last = cues[cues.length - 1];
    if (last && at - last.frame < 6) return;
    cues.push({ frame: at, sound, volume });
  };
  let start = 0;
  timeline.scenes.forEach((scene, i) => {
    const previous = timeline.scenes[i - 1];
    const visual = scene.visual;
    if (conversation) {
      if (visual) add(start, "pop", 0.4);
    } else if (i === 0) {
      add(start + 2, "pop", 0.4);
    } else if (
      visual &&
      (!previous?.visual ||
        visual.type !== previous.visual.type ||
        scene.panel !== previous.panel)
    ) {
      add(start - 2, "whoosh", 0.38);
    } else if (visual) {
      add(start, "tick", 0.3);
    }
    if (!conversation && scene.code) {
      const before = previous?.code;
      const sameBlock =
        before && before.lines.join("\n") === scene.code.lines.join("\n");
      if (!sameBlock) add(start + 3, "swish", 0.26);
      else if (before.highlight !== scene.code.highlight)
        add(start + 4, "tick", 0.22);
    }
    start += scene.durationFrames;
  });
  return cues;
}
