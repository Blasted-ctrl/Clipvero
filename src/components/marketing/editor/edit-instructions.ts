/** Deterministic parser for the editor demo's typed instructions (example data only). */

export type CaptionStyle = {
  color: string;
  colorName: string;
  position: "top" | "center" | "bottom";
  size: number;
  visible: boolean;
};

export type EditProposal = { label: string; patch: Partial<CaptionStyle> };

export const captionColors: Record<string, string> = {
  white: "#FFFFFF",
  yellow: "#FACC15",
  violet: "#C4B5FD",
  purple: "#C4B5FD",
  green: "#86EFAC",
  pink: "#F9A8D4",
  orange: "#FDBA74",
};

export const captionSizes = [14, 17, 20, 24] as const;

const title = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

export function parseInstruction(
  input: string,
  current: CaptionStyle,
): EditProposal[] {
  const text = input.toLowerCase();
  const proposals: EditProposal[] = [];

  const colorWord = Object.keys(captionColors).find((name) =>
    new RegExp(`\\b${name}\\b`).test(text),
  );
  if (colorWord && captionColors[colorWord] !== current.color) {
    proposals.push({
      label: `Caption color → ${title(colorWord)}`,
      patch: { color: captionColors[colorWord], colorName: title(colorWord) },
    });
  }

  const position = /\b(top|upper)\b/.test(text)
    ? "top"
    : /\b(center|centre|middle)\b/.test(text)
      ? "center"
      : /\b(bottom|lower)\b/.test(text)
        ? "bottom"
        : null;
  if (position && position !== current.position) {
    proposals.push({
      label: `Caption position → ${title(position)}`,
      patch: { position },
    });
  }

  const index = captionSizes.indexOf(
    current.size as (typeof captionSizes)[number],
  );
  if (
    /\b(bigger|larger|increase)\b/.test(text) &&
    index < captionSizes.length - 1
  ) {
    proposals.push({
      label: `Caption size → ${captionSizes[index + 1]}px`,
      patch: { size: captionSizes[index + 1] },
    });
  } else if (/\b(smaller|decrease|tiny)\b/.test(text) && index > 0) {
    proposals.push({
      label: `Caption size → ${captionSizes[index - 1]}px`,
      patch: { size: captionSizes[index - 1] },
    });
  }

  if (/\b(hide|remove|no)\b.*\bcaptions?\b/.test(text) && current.visible) {
    proposals.push({ label: "Hide captions", patch: { visible: false } });
  } else if (/\b(show|add)\b.*\bcaptions?\b/.test(text) && !current.visible) {
    proposals.push({ label: "Show captions", patch: { visible: true } });
  }

  return proposals;
}
