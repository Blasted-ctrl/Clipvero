/**
 * Typed hand-off between the public hero form and the authenticated creation
 * workflow. The draft travels two ways so it survives sign-in:
 *   1. in the create URL (`mode`, `source`, and `prompt` when short enough), and
 *   2. in localStorage under DRAFT_STORAGE_KEY for longer scripts.
 * The application reads it with `readCreationDraft` and clears it with
 * `clearCreationDraft` once the project exists.
 */
import type { Mode } from "@/lib/model";
import { appRoutes } from "./app-routes";

export const heroSources = ["idea", "script", "url", "upload"] as const;
export type HeroSource = (typeof heroSources)[number];

/** Mirrors `modeSchema` in src/lib/model.ts without bundling zod into public pages. */
export const draftModes = [
  "prompt",
  "script",
  "characters",
  "story",
  "gameplay",
  "explainer",
  "marketing",
  "clips",
] as const satisfies readonly Mode[];
export type DraftMode = (typeof draftModes)[number];
// Compile-time guard: fails if a mode is added to the app and not mirrored here.
const everyModeCovered: Exclude<Mode, DraftMode> extends never ? true : false =
  true;
void everyModeCovered;

export type CreationDraft = {
  version: 1;
  source: HeroSource;
  mode: DraftMode;
  content: string;
  savedAt: number;
};

export const DRAFT_STORAGE_KEY = "clipvero:creation-draft";
const DRAFT_TTL_MS = 1000 * 60 * 60 * 24;
const MAX_URL_PROMPT_LENGTH = 1500;

/** Default creation mode for each hero source. */
export const sourceMode: Record<HeroSource, DraftMode> = {
  idea: "prompt",
  script: "script",
  url: "prompt",
  upload: "clips",
};

const limits: Record<HeroSource, { min: number; max: number }> = {
  idea: { min: 10, max: 1000 },
  script: { min: 40, max: 12000 },
  url: { min: 0, max: 2048 },
  upload: { min: 0, max: 1000 },
};

export function sourceLimit(source: HeroSource) {
  return limits[source];
}

export type DraftValidation =
  { ok: true; content: string } | { ok: false; error: string };

export function validateDraftInput(
  source: HeroSource,
  raw: string,
): DraftValidation {
  const content = raw.trim();
  const { min, max } = limits[source];
  if (source === "url") {
    if (!content) return { ok: false, error: "Paste a link to continue." };
    let parsed: URL;
    try {
      parsed = new URL(content);
    } catch {
      return {
        ok: false,
        error: "Enter a full link that starts with https://",
      };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { ok: false, error: "Only web links (https://) are supported." };
    }
    if (content.length > max)
      return { ok: false, error: "That link is too long." };
    return { ok: true, content: parsed.toString() };
  }
  if (source === "upload") {
    if (content.length > max)
      return {
        ok: false,
        error: `Keep notes under ${max.toLocaleString("en-US")} characters.`,
      };
    return { ok: true, content };
  }
  if (!content) {
    return {
      ok: false,
      error:
        source === "idea"
          ? "Describe the video you want to create."
          : "Paste your script to continue.",
    };
  }
  if (content.length < min) {
    return {
      ok: false,
      error:
        source === "idea"
          ? "Add a little more detail so the video has something to say."
          : `Scripts need at least ${min} characters.`,
    };
  }
  if (content.length > max)
    return {
      ok: false,
      error: `Keep this under ${max.toLocaleString("en-US")} characters.`,
    };
  return { ok: true, content };
}

export function createDraft(
  source: HeroSource,
  content: string,
  mode: DraftMode = sourceMode[source],
  now = Date.now(),
): CreationDraft {
  return { version: 1, source, mode, content, savedAt: now };
}

export function buildCreateHref(draft: CreationDraft): string {
  const params = new URLSearchParams({
    mode: draft.mode,
    source: draft.source,
    draft: "1",
  });
  if (draft.content && draft.content.length <= MAX_URL_PROMPT_LENGTH)
    params.set("prompt", draft.content);
  return `${appRoutes.create}?${params.toString()}`;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function saveCreationDraft(draft: CreationDraft): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function parseCreationDraft(
  value: unknown,
  now = Date.now(),
): CreationDraft | null {
  if (!value || typeof value !== "object") return null;
  const d = value as Partial<CreationDraft>;
  if (
    d.version !== 1 ||
    typeof d.content !== "string" ||
    typeof d.savedAt !== "number"
  )
    return null;
  if (!d.source || !heroSources.includes(d.source)) return null;
  if (!d.mode || !draftModes.includes(d.mode)) return null;
  if (now - d.savedAt > DRAFT_TTL_MS || d.savedAt > now + 60_000) return null;
  if (d.content.length > limits[d.source].max) return null;
  return {
    version: 1,
    source: d.source,
    mode: d.mode,
    content: d.content,
    savedAt: d.savedAt,
  };
}

export function readCreationDraft(now = Date.now()): CreationDraft | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(DRAFT_STORAGE_KEY);
    const draft = raw ? parseCreationDraft(JSON.parse(raw), now) : null;
    if (!draft && raw) store.removeItem(DRAFT_STORAGE_KEY);
    return draft;
  } catch {
    return null;
  }
}

export function clearCreationDraft(): void {
  try {
    storage()?.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}
