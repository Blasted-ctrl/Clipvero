"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  FileText,
  Lightbulb,
  Link2,
  CornerDownLeft,
  Upload,
} from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/components/ui/button";
import { capabilities } from "../data/capabilities";
import { trialCredits } from "../data/site";
import { appRoutes } from "../lib/app-routes";
import {
  buildCreateHref,
  createDraft,
  heroSources,
  saveCreationDraft,
  sourceLimit,
  sourceMode,
  validateDraftInput,
  type DraftMode,
  type HeroSource,
} from "../lib/creation-draft";
import { m } from "../motion/motion";

const tabMeta: Record<
  HeroSource,
  { label: string; icon: typeof Lightbulb; submit: string }
> = {
  idea: { label: "Idea", icon: Lightbulb, submit: "Create video" },
  script: { label: "Script", icon: FileText, submit: "Create video" },
  url: { label: "URL", icon: Link2, submit: "Save link and continue" },
  upload: { label: "Upload", icon: Upload, submit: "Continue to upload" },
};

export const heroExample =
  "A 30-second launch video for a reusable coffee cup. Focus on the leak-proof lid, a morning commute and fewer disposable cups.";

type Props = {
  defaultSource?: HeroSource;
  /** Creation mode for idea submissions, e.g. "characters" on that feature page. */
  ideaMode?: DraftMode;
  /** Creation mode for script submissions, e.g. "gameplay" on that feature page. */
  scriptMode?: DraftMode;
  defaultValue?: string;
  example?: string;
  showExploreLink?: boolean;
  className?: string;
};

export function HeroComposer({
  defaultSource = "idea",
  ideaMode = sourceMode.idea,
  scriptMode = sourceMode.script,
  defaultValue = "",
  example = heroExample,
  showExploreLink = true,
  className,
}: Props) {
  const router = useRouter();
  const uid = useId();
  const [source, setSource] = useState<HeroSource>(defaultSource);
  const [values, setValues] = useState<Record<HeroSource, string>>({
    idea: "",
    script: "",
    url: "",
    upload: "",
    [defaultSource]: defaultValue,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fieldRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const tabRefs = useRef<Record<HeroSource, HTMLButtonElement | null>>({
    idea: null,
    script: null,
    url: null,
    upload: null,
  });

  const modeFor = (from: HeroSource): DraftMode =>
    from === "idea"
      ? ideaMode
      : from === "script"
        ? scriptMode
        : sourceMode[from];
  const value = values[source];
  const limit = sourceLimit(source);
  const fieldId = `${uid}-field`;
  const errorId = `${uid}-error`;
  const helpId = `${uid}-help`;

  function select(next: HeroSource, focusTab = false) {
    setSource(next);
    setError(null);
    if (focusTab) tabRefs.current[next]?.focus();
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    const index = heroSources.indexOf(source);
    const keys: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    if (event.key in keys) {
      event.preventDefault();
      select(
        heroSources[
          (index + keys[event.key] + heroSources.length) % heroSources.length
        ],
        true,
      );
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      select(
        event.key === "Home"
          ? heroSources[0]
          : heroSources[heroSources.length - 1],
        true,
      );
    }
  }

  function submit() {
    if (pending) return;
    const result = validateDraftInput(source, value);
    if (!result.ok) {
      setError(result.error);
      fieldRef.current?.focus();
      return;
    }
    setError(null);
    setPending(true);
    const draft = createDraft(source, result.content, modeFor(source));
    saveCreationDraft(draft);
    router.push(buildCreateHref(draft));
  }

  return (
    <form
      noValidate
      // Without JavaScript (or before hydration) the browser submits the same query the script builds.
      action={appRoutes.create}
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className={cn("w-full", className)}
      aria-label="Start a video"
    >
      <input type="hidden" name="mode" value={modeFor(source)} />
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="draft" value="1" />
      <div
        data-invalid={Boolean(error)}
        className="mk-composer mk-card p-2 text-left"
      >
        <div
          role="tablist"
          aria-label="Start from"
          className="mk-composer-tabs grid grid-cols-4 gap-1 p-1"
        >
          {heroSources.map((id) => {
            const meta = tabMeta[id];
            const TabIcon = meta.icon;
            const selected = source === id;
            return (
              <button
                key={id}
                ref={(el) => {
                  tabRefs.current[id] = el;
                }}
                type="button"
                role="tab"
                id={`${uid}-tab-${id}`}
                aria-selected={selected}
                aria-controls={`${uid}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(id)}
                onKeyDown={onTabKey}
                className="mk-tab px-2 text-sm sm:text-[0.9375rem]"
              >
                {selected && (
                  <m.span
                    layoutId={`${uid}-tab-pill`}
                    className="mk-tab-indicator mk-tab-indicator-accent"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                    aria-hidden="true"
                  />
                )}
                <TabIcon
                  size={16}
                  aria-hidden="true"
                  className="relative z-10 hidden min-[380px]:block"
                />
                <span className="relative z-10">{meta.label}</span>
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`${uid}-panel`}
          aria-labelledby={`${uid}-tab-${source}`}
          className="px-1 pt-2"
        >
          <label htmlFor={fieldId} className="sr-only">
            {source === "idea" && "Describe the video you want to create"}
            {source === "script" && "Your script"}
            {source === "url" && "Link to a page or article"}
            {source === "upload" &&
              "What should we look for in your recording? (optional)"}
          </label>
          {source === "url" ? (
            <input
              ref={fieldRef}
              id={fieldId}
              name="prompt"
              type="url"
              inputMode="url"
              autoComplete="url"
              className="mk-input text-base"
              placeholder="Paste an article or product URL"
              value={value}
              aria-invalid={Boolean(error)}
              aria-describedby={`${helpId}${error ? ` ${errorId}` : ""}`}
              onChange={(event) => {
                setValues((current) => ({
                  ...current,
                  url: event.target.value,
                }));
                if (error) setError(null);
              }}
            />
          ) : (
            <textarea
              ref={fieldRef}
              id={fieldId}
              name="prompt"
              className={cn(
                "mk-textarea text-base",
                source === "script" && "min-h-[160px]",
              )}
              placeholder={
                source === "idea"
                  ? "A product launch. A podcast highlight. What are we making?"
                  : source === "script"
                    ? "Paste your script. It's used word for word unless you ask for a rewrite."
                    : "Optional: what should we look for? e.g. the moments where we disagree about remote work"
              }
              value={value}
              maxLength={limit.max + 200}
              aria-invalid={Boolean(error)}
              aria-describedby={`${helpId}${error ? ` ${errorId}` : ""}`}
              onChange={(event) => {
                const next = event.target.value;
                setValues((current) => ({ ...current, [source]: next }));
                if (error) setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  submit();
                }
              }}
            />
          )}

          <div className="flex flex-col gap-3 px-2 pb-2 pt-1 sm:flex-row sm:items-end sm:justify-between">
            <div
              id={helpId}
              className="flex min-h-11 flex-wrap items-center gap-2 text-[0.8125rem] text-(--muted)"
            >
              {source === "idea" && (
                <button
                  type="button"
                  onClick={() => {
                    setValues((current) => ({ ...current, idea: example }));
                    setError(null);
                    fieldRef.current?.focus();
                  }}
                  className="mk-composer-example inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-[0.8125rem] text-(--secondary) transition-colors hover:text-(--text)"
                >
                  <CornerDownLeft
                    size={14}
                    aria-hidden="true"
                    className="text-(--accent-hover)"
                  />
                  Use a sample brief
                </button>
              )}
              {source === "script" && (
                <span className="mk-mono" aria-live="polite">
                  {value.trim().length.toLocaleString("en-US")} /{" "}
                  {limit.max.toLocaleString("en-US")}
                </span>
              )}
              {source === "url" && (
                <>
                  <span className="mk-badge mk-badge-upcoming">Upcoming</span>
                  <span>
                    {capabilities.urlImport.label} is on the way. Your link is
                    saved to your draft.
                  </span>
                </>
              )}
              {source === "upload" && (
                <span>
                  Uploads happen in your private studio after you sign in.
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={pending}
              className="mk-btn mk-btn-primary mk-btn-lg w-full sm:w-auto"
            >
              {pending ? (
                <>
                  <span
                    className="mk-spinner size-4 border-2"
                    aria-hidden="true"
                  />
                  Opening studio…
                </>
              ) : (
                <>
                  {tabMeta[source].submit}
                  <ArrowRight
                    className="mk-btn-arrow"
                    size={17}
                    aria-hidden="true"
                  />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <p
        id={errorId}
        role="alert"
        aria-live="assertive"
        className={cn("mk-error text-left", error && "mt-3")}
      >
        {error}
      </p>

      {showExploreLink && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[0.9375rem]">
          <Link
            href="/explore"
            className="mk-link inline-flex min-h-11 items-center gap-1.5 font-medium"
          >
            Explore examples
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <span className="hidden text-(--muted) sm:inline" aria-hidden="true">
            ·
          </span>
          <span className="text-[0.8125rem] text-(--muted)">
            {trialCredits} trial credits · No card required
          </span>
        </div>
      )}
    </form>
  );
}
