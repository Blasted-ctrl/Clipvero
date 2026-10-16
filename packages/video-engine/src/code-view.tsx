import { createContext, useContext } from "react";
import { Easing, interpolate } from "remotion";
import {
  codeKey,
  guessLanguage,
  type CodeToken,
  type CodeTokens,
} from "./code-key";

/**
 * Syntax-highlighted code for video. Tokens are computed in Node (see
 * code-tokens.ts) and arrive as data, so drawing is a pure function of the frame
 * number and never waits on a download. Without tokens it draws plain text.
 */
export const CodeTokensContext = createContext<CodeTokens>({});

/** The first `chars` characters across all tokens, for a typing effect. */
export function sliceTokens(tokens: CodeToken[], chars: number) {
  const out: CodeToken[] = [];
  let left = chars;
  for (const token of tokens) {
    if (left <= 0) break;
    out.push(
      token.content.length <= left
        ? token
        : { ...token, content: token.content.slice(0, left) },
    );
    left -= token.content.length;
  }
  return out;
}

const glide = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
  easing: Easing.inOut(Easing.cubic),
} as const;

export function CodeLines({
  lines,
  language = guessLanguage(lines),
  f,
  accent,
  fontSize,
  lineHeight,
  highlight,
  previous,
  chars = Infinity,
  fallback,
}: {
  lines: string[];
  language?: string;
  f: number;
  accent: string;
  fontSize: number;
  lineHeight: number;
  highlight?: number;
  /** The previous beat's block, so unchanged lines stay put and the bar glides. */
  previous?: { lines: string[]; highlight?: number };
  /** Characters to show, counted across the whole block. */
  chars?: number;
  fallback?: (line: string) => React.ReactNode;
}) {
  const tokens =
    useContext(CodeTokensContext)[codeKey(lines, language)] ?? null;
  const hasFocus = highlight !== undefined;
  const from = previous?.highlight ?? highlight ?? 0;
  const barLine = hasFocus
    ? interpolate(f, [0, 14], [from, highlight], glide)
    : 0;
  const offsets = lines.map((_, i) =>
    lines.slice(0, i).reduce((sum, line) => sum + line.length + 1, 0),
  );
  return (
    <div style={{ position: "relative", fontFamily: "Consolas, monospace" }}>
      {hasFocus && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: barLine * lineHeight,
            height: lineHeight,
            background: `${accent}2A`,
            borderLeft: `3px solid ${accent}`,
            boxShadow: `0 0 18px ${accent}33`,
          }}
        />
      )}
      {lines.map((line, i) => {
        const isNew = previous ? !previous.lines.includes(line) : false;
        const enter = isNew
          ? interpolate(f, [i * 2, i * 2 + 10], [0, 1], glide)
          : 1;
        const shown = Math.max(0, Math.min(line.length, chars - offsets[i]));
        const row = tokens?.[i];
        return (
          <div
            key={i}
            style={{
              position: "relative",
              height: lineHeight,
              lineHeight: `${lineHeight}px`,
              padding: "0 14px",
              fontSize,
              whiteSpace: "pre",
              opacity: enter * (hasFocus && highlight !== i ? 0.5 : 1),
              transform: `translateY(${(1 - enter) * 8}px)`,
            }}
          >
            {row
              ? sliceTokens(row, shown).map((token, j) => (
                  <span key={j} style={{ color: token.color }}>
                    {token.content}
                  </span>
                ))
              : fallback
                ? fallback(line.slice(0, shown))
                : line.slice(0, shown)}
          </div>
        );
      })}
    </div>
  );
}
