/**
 * Phrases that make short-form scripts read as machine-written. Agent scripts
 * that contain them are rejected with the offending line so they can be rewritten.
 */
const rules: { pattern: RegExp; reason: string }[] = [
  {
    pattern:
      /\b(it'?s|this is|that'?s|they'?re|you'?re)\s+not\s+(just\s+)?[^.?!]{1,60}?[,;:—–-]\s*(it'?s|this is|that'?s|they'?re|you'?re|but)\b/i,
    reason: `"It's not X, it's Y" framing`,
  },
  { pattern: /—|–/, reason: "em or en dash" },
  {
    pattern:
      /\b(let'?s dive in|dive into|deep dive|in today'?s video|here'?s the thing|buckle up|game[- ]?changer|in a world where|delve|unlock the (power|secret)|at the end of the day|without further ado|the best part\?|but here'?s the (catch|kicker|twist)|let that sink in|plot twist)\b/i,
    reason: "stock AI phrase",
  },
  { pattern: /(^|[.!?]\s+)imagine\b/i, reason: `"Imagine…" opener` },
  {
    pattern: /\bnot only\b[^.?!]*\bbut also\b/i,
    reason: `"not only… but also"`,
  },
];

export function scriptIssues(script: string) {
  const issues: string[] = [];
  for (const line of script
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean))
    for (const rule of rules)
      if (rule.pattern.test(line))
        issues.push(`${rule.reason}: "${line.slice(0, 120)}"`);
  return issues;
}

export const scriptStyleGuide =
  'Write like a person talking to a friend: short, uneven sentences, one concrete example, a hook in the first line, no tidy summary at the end. Never use "it\'s not X, it\'s Y", em dashes, "imagine…" openers, "let\'s dive in", "here\'s the thing", "game changer" or "not only… but also".';
