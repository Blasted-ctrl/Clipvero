import { highlight } from "@code-hike/lighter";
import { codeKey, timelineCode, type CodeTokens } from "./code-key";
import type { Timeline } from "./model";

/**
 * Highlights a timeline's code in Node with @code-hike/lighter (MIT), using the
 * grammars bundled in the package, so renders never touch the network.
 * Blocks in unknown languages are skipped and draw as plain text.
 */
export async function highlightTimelineCode(
  timeline: Timeline,
): Promise<CodeTokens> {
  const tokens: CodeTokens = {};
  for (const { lines, language } of timelineCode(timeline)) {
    try {
      const result = await highlight(lines.join("\n"), language, "github-dark");
      tokens[codeKey(lines, language)] = result.lines.map((line) =>
        line.map((token) => ({
          content: token.content,
          color: token.style.color ?? "#C9D1D9",
        })),
      );
    } catch {
      // Unsupported language: leave it out.
    }
  }
  return tokens;
}
