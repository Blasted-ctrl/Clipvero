import type { Timeline } from "./model";

/** One coloured run of code text. */
export type CodeToken = { content: string; color: string };
/** Highlighted blocks keyed by {@link codeKey}; computed in Node, passed to the renderer as data. */
export type CodeTokens = Record<string, CodeToken[][]>;

export const codeKey = (lines: string[], language: string) =>
  `${language}\n${lines.join("\n")}`;

/** Best guess when a panel doesn't name its language. */
export function guessLanguage(lines: string[]) {
  const text = lines.join("\n");
  if (/#include|std::|::|\bnullptr\b|\bvoid\s+\w+\(/.test(text)) return "cpp";
  if (/\b(const|let|var|function)\b|=>|;\s*$/m.test(text)) return "javascript";
  if (/\b(public|private|static)\b.*\(|\bnew\s+\w+</.test(text)) return "java";
  return "python";
}

/** Every distinct code block a timeline shows. */
export function timelineCode(timeline: Timeline) {
  const blocks = new Map<string, { lines: string[]; language: string }>();
  for (const scene of timeline.scenes)
    for (const lines of [
      scene.code?.lines,
      scene.visual?.type === "code" ? scene.visual.lines : undefined,
    ])
      if (lines) {
        const language =
          scene.visual?.type === "code" && scene.visual.lines === lines
            ? scene.visual.language
            : guessLanguage(lines);
        blocks.set(codeKey(lines, language), { lines, language });
      }
  return [...blocks.values()];
}
