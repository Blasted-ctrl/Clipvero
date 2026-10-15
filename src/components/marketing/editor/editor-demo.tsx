"use client";

import { AnimatePresence } from "motion/react";
import {
  Captions,
  Crop,
  Mic,
  Scissors,
  Sparkles,
  Type,
  Wand2,
} from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/components/ui/button";
import { formatDuration } from "../data/showcase";
import { m } from "../motion/motion";
import { PreviewLabel } from "../ui/primitives";
import {
  captionColors,
  captionSizes,
  parseInstruction,
  type CaptionStyle,
  type EditProposal,
} from "./edit-instructions";

type Excerpt = { id: string; start: number; end: number; text: string };

/** Example transcript excerpts for the demo. Not a real recording. */
const excerpts: Excerpt[] = [
  {
    id: "a",
    start: 494,
    end: 532,
    text: "Remote work isn't the problem. Bad meetings are.",
  },
  {
    id: "b",
    start: 1862,
    end: 1900,
    text: "We tried a four-day week for a quarter. Here's what broke.",
  },
  {
    id: "c",
    start: 3441,
    end: 3475,
    text: "Async is a skill, and most teams never practice it.",
  },
  {
    id: "d",
    start: 3850,
    end: 3881,
    text: "The best meeting I had this year was a shared document.",
  },
];

const voices = ["Original audio", "Alloy", "Coral", "Sage", "Onyx"] as const;
const TRIM_PAD = 6;

const stamp = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const rest = seconds % 3600;
  return h
    ? `${h}:${formatDuration(rest).padStart(5, "0")}`
    : formatDuration(rest);
};

function Switch({
  checked,
  onChange,
  label,
  icon: Icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  icon: typeof Crop;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-1 text-left"
    >
      <span className="flex items-center gap-2.5 text-[0.9375rem]">
        <Icon size={16} aria-hidden="true" className="text-(--secondary)" />
        {label}
      </span>
      <span className="mk-switch" aria-hidden="true" />
    </button>
  );
}

function Studio() {
  return (
    <div className="absolute inset-0 bg-[radial-gradient(70%_90%_at_50%_100%,#27203d,#0d0c14)]">
      <span className="absolute inset-x-0 bottom-0 h-[28%] bg-[#141220]" />
      <span className="absolute left-1/2 top-[18%] h-[46%] w-px bg-white/5" />
      {[0, 1].map((speaker) => (
        <div
          key={speaker}
          className="absolute bottom-[22%] flex -translate-x-1/2 flex-col items-center"
          style={{ left: speaker === 0 ? "42%" : "58%" }}
        >
          <span
            className={cn(
              "aspect-square w-[6cqw] rounded-full",
              speaker === 0
                ? "bg-[radial-gradient(circle_at_50%_38%,#fcd34d_0_34%,#3f3f46_35%)]"
                : "bg-[radial-gradient(circle_at_50%_38%,#fca5a5_0_34%,#3f3f46_35%)]",
            )}
          />
          <span
            className={cn(
              "-mt-[1cqw] h-[7cqw] w-[9cqw] rounded-t-[4cqw]",
              speaker === 0 ? "bg-[#f59e0b]" : "bg-[#ef4444]",
            )}
          />
          <span className="h-[1.5cqw] w-[12cqw] rounded-sm bg-[#3b3352]" />
        </div>
      ))}
      <span className="absolute left-[2.5cqw] top-[2.5cqw] flex items-center gap-[1cqw] rounded bg-black/50 px-[1.5cqw] py-[0.6cqw] text-[1.8cqw] font-semibold tracking-widest text-white/80">
        <span className="size-[1.4cqw] rounded-full bg-[#ef4444]" /> EP 48
      </span>
    </div>
  );
}

export function EditorDemo() {
  const uid = useId();
  const [selected, setSelected] = useState(excerpts[0]);
  const [trim, setTrim] = useState({
    in: excerpts[0].start,
    out: excerpts[0].end,
  });
  const [reframe, setReframe] = useState(true);
  const [voice, setVoice] = useState<(typeof voices)[number]>("Original audio");
  const [caption, setCaption] = useState(excerpts[0].text);
  const [style, setStyle] = useState<CaptionStyle>({
    color: captionColors.white,
    colorName: "White",
    position: "bottom",
    size: 17,
    visible: true,
  });
  const [instruction, setInstruction] = useState("");
  const [proposals, setProposals] = useState<EditProposal[] | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  function choose(excerpt: Excerpt) {
    setSelected(excerpt);
    setTrim({ in: excerpt.start, out: excerpt.end });
    setCaption(excerpt.text);
  }

  function propose() {
    const next = parseInstruction(instruction, style);
    setProposals(next);
    setApplied(null);
  }

  function apply() {
    if (!proposals?.length) return;
    setStyle((current) =>
      proposals.reduce((acc, p) => ({ ...acc, ...p.patch }), current),
    );
    setApplied(proposals.map((p) => p.label).join(" · "));
    setProposals(null);
    setInstruction("");
  }

  const min = selected.start - TRIM_PAD;
  const max = selected.end + TRIM_PAD;
  const length = trim.out - trim.in;

  return (
    <div className="mk-card mk-card-raised overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--border) px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 text-[0.875rem] text-(--secondary)">
          <Scissors size={15} aria-hidden="true" />
          <span className="mk-mono">episode-48-remote-work.mp4</span>
          <span className="hidden text-(--muted) sm:inline">· 1:12:40</span>
        </div>
        <PreviewLabel />
      </div>

      <div className="grid lg:grid-cols-[1.15fr_1fr]">
        {/* Source and excerpts */}
        <div className="flex min-w-0 flex-col gap-5 border-b border-(--border) p-4 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="relative aspect-video overflow-hidden rounded-xl border border-white/[0.06] [container-type:inline-size]">
            <Studio />
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-y-0 left-1/2 w-[31.64%] -translate-x-1/2 border-2 border-(--accent-hover) bg-(--accent)/10 shadow-[0_0_0_999px_rgb(0_0_0/0.45)] transition-opacity duration-500",
                reframe ? "opacity-100" : "opacity-0",
              )}
            />
            <span className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-[0.6875rem] font-medium text-white/80">
              {reframe ? "9:16 center crop" : "Original 16:9"}
            </span>
          </div>

          <div
            role="group"
            aria-labelledby={`${uid}-excerpts`}
            className="min-w-0"
          >
            <p id={`${uid}-excerpts`} className="mk-overline mb-3">
              Suggested excerpts
            </p>
            <div className="flex flex-col gap-2">
              {excerpts.map((excerpt) => {
                const isSelected = excerpt.id === selected.id;
                return (
                  <button
                    key={excerpt.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => choose(excerpt)}
                    className={cn(
                      "group flex min-h-11 w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors duration-200",
                      isSelected
                        ? "border-(--accent)/60 bg-(--accent)/10"
                        : "border-(--border) bg-(--bg)/40 hover:border-[#3a3a44] hover:bg-(--surface-2)",
                    )}
                  >
                    <span
                      className={cn(
                        "mk-mono mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[0.75rem]",
                        isSelected
                          ? "bg-(--accent) text-white"
                          : "bg-(--surface-2) text-(--secondary)",
                      )}
                    >
                      {stamp(excerpt.start)}
                    </span>
                    <span
                      className={cn(
                        "text-[0.9375rem] leading-snug",
                        isSelected
                          ? "text-(--text)"
                          : "text-(--secondary) group-hover:text-(--text)",
                      )}
                    >
                      “{excerpt.text}”
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-(--border) bg-(--bg)/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="mk-overline">Trim</span>
              <span
                className="mk-mono text-[0.8125rem] text-(--secondary)"
                aria-live="polite"
              >
                {stamp(trim.in)} – {stamp(trim.out)} · {length}s
              </span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`${uid}-in`} className="mk-field">
                  In point
                </label>
                <input
                  id={`${uid}-in`}
                  type="range"
                  min={min}
                  max={max}
                  value={trim.in}
                  aria-valuetext={stamp(trim.in)}
                  onChange={(e) =>
                    setTrim((t) => ({
                      ...t,
                      in: Math.min(Number(e.target.value), t.out - 3),
                    }))
                  }
                />
              </div>
              <div>
                <label htmlFor={`${uid}-out`} className="mk-field">
                  Out point
                </label>
                <input
                  id={`${uid}-out`}
                  type="range"
                  min={min}
                  max={max}
                  value={trim.out}
                  aria-valuetext={stamp(trim.out)}
                  onChange={(e) =>
                    setTrim((t) => ({
                      ...t,
                      out: Math.max(Number(e.target.value), t.in + 3),
                    }))
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* Output and controls */}
        <div className="grid min-w-0 gap-6 p-4 sm:grid-cols-[minmax(0,200px)_1fr] sm:p-6">
          <div className="mx-auto w-full max-w-[200px]">
            <div className="mk-video-frame border border-white/[0.08] [container-type:inline-size]">
              <div
                className="absolute left-1/2 top-1/2 aspect-video w-full [container-type:inline-size] transition-transform duration-700"
                style={{
                  transform: reframe
                    ? "translate(-50%, -50%) scale(3.1605)"
                    : "translate(-50%, -50%)",
                  transitionTimingFunction: "cubic-bezier(.22,1,.36,1)",
                }}
              >
                <Studio />
              </div>
              <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-1 text-[0.6875rem] font-medium text-white">
                {voice === "Original audio" ? (
                  <Mic size={11} aria-hidden="true" />
                ) : (
                  <span className="mk-eq h-2.5" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                )}
                {voice === "Original audio"
                  ? "Original audio"
                  : `Narration · ${voice}`}
              </span>
              <AnimatePresence>
                {style.visible && caption.trim() && (
                  <m.p
                    key="caption"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className={cn(
                      "absolute inset-x-3 text-center font-extrabold leading-tight [text-shadow:0_2px_0_rgb(0_0_0/0.7),0_0_14px_rgb(0_0_0/0.6)] transition-[top,bottom] duration-500",
                      style.position === "top" && "top-[14%]",
                      style.position === "center" && "top-1/2 -translate-y-1/2",
                      style.position === "bottom" && "bottom-[14%]",
                    )}
                    style={{ color: style.color, fontSize: `${style.size}px` }}
                  >
                    {caption}
                  </m.p>
                )}
              </AnimatePresence>
            </div>
            <p className="mt-2 text-center text-[0.75rem] text-(--muted)">
              9:16 output · {length}s clip
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col divide-y divide-(--border) rounded-xl border border-(--border) bg-(--bg)/40 px-3">
              <Switch
                checked={style.visible}
                onChange={(visible) => setStyle((s) => ({ ...s, visible }))}
                label="Captions"
                icon={Captions}
              />
              <Switch
                checked={reframe}
                onChange={setReframe}
                label="Reframe to vertical"
                icon={Crop}
              />
            </div>

            <div>
              <label htmlFor={`${uid}-voice`} className="mk-field">
                Narration
              </label>
              <select
                id={`${uid}-voice`}
                className="mk-select"
                value={voice}
                onChange={(e) =>
                  setVoice(e.target.value as (typeof voices)[number])
                }
              >
                {voices.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor={`${uid}-caption`} className="mk-field">
                <Type size={13} aria-hidden="true" /> Scene caption
              </label>
              <input
                id={`${uid}-caption`}
                className="mk-input mk-input-boxed min-h-11 py-2 text-[0.9375rem]"
                value={caption}
                maxLength={120}
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                propose();
              }}
              className="flex flex-col gap-2"
            >
              <label htmlFor={`${uid}-instruction`} className="mk-field">
                <Wand2 size={13} aria-hidden="true" /> Edit instruction
              </label>
              <div className="flex gap-2">
                <input
                  id={`${uid}-instruction`}
                  className="mk-input mk-input-boxed min-h-11 min-w-0 py-2 text-[0.9375rem]"
                  placeholder="yellow captions at the top"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                />
                <button
                  type="submit"
                  className="mk-btn mk-btn-secondary mk-btn-sm min-h-11"
                  disabled={!instruction.trim()}
                >
                  Propose
                </button>
              </div>
              <div aria-live="polite" className="min-h-6">
                {proposals && proposals.length > 0 && (
                  <div className="mk-rise flex flex-col gap-2 rounded-xl border border-(--accent)/40 bg-(--accent)/10 p-3">
                    <ul className="flex flex-col gap-1 text-[0.875rem]">
                      {proposals.map((p) => (
                        <li key={p.label} className="flex items-center gap-2">
                          <Sparkles
                            size={13}
                            aria-hidden="true"
                            className="text-(--accent-hover)"
                          />
                          {p.label}
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={apply}
                        className="mk-btn mk-btn-primary mk-btn-sm"
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        onClick={() => setProposals(null)}
                        className="mk-btn mk-btn-ghost mk-btn-sm"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                )}
                {proposals && proposals.length === 0 && (
                  <p className="text-[0.8125rem] text-(--secondary)">
                    Specify a caption color, position, size or visibility. For
                    example, “bigger violet captions in the center”.
                  </p>
                )}
                {applied && (
                  <p className="text-[0.8125rem] text-[#86efac]">
                    Applied: {applied}
                  </p>
                )}
              </div>
            </form>

            <ul className="flex flex-col gap-1.5 text-[0.8125rem] text-(--muted)">
              {["Regenerate individual elements", "Speaker-following crop"].map(
                (label) => (
                  <li key={label} className="flex flex-wrap items-center gap-2">
                    <span className="mk-badge mk-badge-upcoming">Upcoming</span>
                    {label}
                  </li>
                ),
              )}
            </ul>
          </div>
        </div>
      </div>
      <p className="mk-preview-disclosure">
        Sample recording. Changes apply to this preview only.
      </p>
      <p className="sr-only">
        Caption sizes available: {captionSizes.join(", ")} pixels.
      </p>
    </div>
  );
}
