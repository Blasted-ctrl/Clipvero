"use client";

import { AnimatePresence } from "motion/react";
import {
  BellRing,
  CalendarDays,
  Check,
  CircleDashed,
  Clock3,
  Clapperboard,
  Palette,
  Pause,
  Play,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/components/ui/button";
import { m } from "../motion/motion";
import { PreviewLabel } from "../ui/primitives";

type JobState = "queued" | "rendering" | "review" | "approved";
type Job = {
  id: string;
  day: Day;
  title: string;
  state: JobState;
  reminder: Day | null;
};
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type Day = (typeof days)[number];

/** Example pipeline for the marketing demo. Not customer data. */
const initialJobs: Job[] = [
  {
    id: "sky",
    day: "Mon",
    title: "Why is the sky blue?",
    state: "review",
    reminder: null,
  },
  {
    id: "bees",
    day: "Wed",
    title: "How do bees make honey?",
    state: "rendering",
    reminder: null,
  },
  {
    id: "purr",
    day: "Fri",
    title: "Why do cats purr?",
    state: "queued",
    reminder: null,
  },
];

const stateMeta: Record<
  JobState,
  { label: string; dot: string; icon: typeof Check }
> = {
  queued: { label: "Queued", dot: "bg-(--muted)", icon: CircleDashed },
  rendering: { label: "Rendering", dot: "bg-[#60a5fa]", icon: Clapperboard },
  review: { label: "Ready for review", dot: "bg-(--warning)", icon: Clock3 },
  approved: { label: "Approved", dot: "bg-(--success)", icon: Check },
};

function StatePill({ state }: { state: JobState }) {
  const meta = stateMeta[state];
  return (
    <span className="mk-badge shrink-0">
      <span
        className={cn("size-1.5 rounded-full", meta.dot)}
        aria-hidden="true"
      />
      {meta.label}
    </span>
  );
}

export function AutopilotDemo() {
  const uid = useId();
  const [jobs, setJobs] = useState(initialJobs);
  const [active, setActive] = useState(true);
  const [reminderDay, setReminderDay] = useState<Record<string, Day>>({
    sky: "Tue",
  });

  const update = (id: string, patch: Partial<Job>) =>
    setJobs((all) =>
      all.map((job) => (job.id === id ? { ...job, ...patch } : job)),
    );
  const queue = jobs.filter(
    (job) => job.state === "review" || job.state === "approved",
  );

  return (
    <div
      className="mk-card mk-card-raised overflow-hidden"
      aria-label="Sample production schedule"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--border) px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-lg",
              active
                ? "bg-(--accent)/20 text-(--accent-hover)"
                : "bg-(--surface-2) text-(--muted)",
            )}
          >
            <Clapperboard size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">Weekly science explainers</p>
            <p
              className="text-[0.8125rem] text-(--secondary)"
              aria-live="polite"
            >
              {active
                ? "Active · runs Mon, Wed, Fri at 9:00"
                : "Paused · future runs will not start"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PreviewLabel />
          <button
            type="button"
            onClick={() => setActive((v) => !v)}
            className="mk-btn mk-btn-secondary mk-btn-sm"
            aria-pressed={!active}
          >
            {active ? (
              <Pause size={14} aria-hidden="true" />
            ) : (
              <Play size={14} aria-hidden="true" />
            )}
            {active ? "Pause" : "Resume"}
          </button>
        </div>
      </div>

      <div className="grid gap-px bg-(--border) lg:grid-cols-[0.85fr_1.15fr]">
        {/* Saved style + weekly jobs */}
        <div className="flex min-w-0 flex-col gap-6 bg-(--surface) p-4 sm:p-6">
          <section aria-labelledby={`${uid}-style`}>
            <h3
              id={`${uid}-style`}
              className="mk-overline flex items-center gap-2"
            >
              <Palette size={14} aria-hidden="true" /> Saved content style
            </h3>
            <dl
              className="grid grid-cols-1 gap-2 text-[0.875rem] min-[420px]:grid-cols-2"
              style={{ margin: "12px 0 0" }}
            >
              {[
                ["Format", "Educational explainer"],
                ["Voice", "Sage · Educational"],
                ["Captions", "Bottom · Violet"],
                ["Length", "45 s · 9:16"],
              ].map(([term, value]) => (
                <div
                  key={term}
                  className="min-w-0 rounded-lg border border-(--border) bg-(--bg)/50 px-3 py-2"
                >
                  <dt className="text-[0.75rem] text-(--muted)">{term}</dt>
                  <dd className="m-0 font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby={`${uid}-jobs`}>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h3 id={`${uid}-jobs`} className="mk-overline">
                This week&apos;s runs
              </h3>
              <span className="mk-mono text-[0.75rem] text-(--muted)">
                3 of 12 runs · 21 of 120 credits
              </span>
            </div>
            <ol className="mt-3 flex flex-col gap-2">
              {jobs.map((job) => {
                const Icon = stateMeta[job.state].icon;
                return (
                  <li
                    key={job.id}
                    className={cn(
                      "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-(--border) bg-(--bg)/50 p-3 transition-opacity",
                      !active && job.state === "queued" && "opacity-50",
                    )}
                  >
                    <span className="mk-mono w-9 shrink-0 text-[0.75rem] font-semibold text-(--secondary)">
                      {job.day}
                    </span>
                    <Icon
                      size={16}
                      aria-hidden="true"
                      className="shrink-0 text-(--secondary)"
                    />
                    <span className="min-w-0 flex-1 basis-32 truncate text-[0.9375rem]">
                      {job.title}
                    </span>
                    <StatePill state={job.state} />
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        {/* Review queue + schedule */}
        <div className="flex min-w-0 flex-col gap-6 bg-(--surface) p-4 sm:p-6">
          <section aria-labelledby={`${uid}-queue`}>
            <h3 id={`${uid}-queue`} className="mk-overline">
              Review queue
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {queue.length === 0 && (
                  <m.li
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-xl border border-dashed border-(--border) p-4 text-[0.875rem] text-(--secondary)"
                  >
                    Nothing waiting. Finished renders land here for your
                    approval.
                  </m.li>
                )}
                {queue.map((job) => (
                  <m.li
                    key={job.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex flex-col gap-3 rounded-xl border border-(--border) bg-(--bg)/50 p-3 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span
                        className="flex h-12 w-[27px] shrink-0 items-end justify-center rounded-md bg-linear-to-b from-[#0c2a4a] to-[#1e3a8a] pb-1 text-[0.5rem] font-bold text-white"
                        aria-hidden="true"
                      >
                        45s
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{job.title}</p>
                        <StatePill state={job.state} />
                      </div>
                    </div>
                    {job.state === "review" ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="mk-btn mk-btn-primary mk-btn-sm"
                          onClick={() => update(job.id, { state: "approved" })}
                        >
                          <Check size={14} aria-hidden="true" /> Approve
                        </button>
                        <button
                          type="button"
                          className="mk-btn mk-btn-ghost mk-btn-sm"
                          onClick={() => update(job.id, { state: "queued" })}
                        >
                          <RotateCcw size={14} aria-hidden="true" /> Return to
                          draft
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <label
                          htmlFor={`${uid}-${job.id}-day`}
                          className="sr-only"
                        >
                          Reminder day for {job.title}
                        </label>
                        <select
                          id={`${uid}-${job.id}-day`}
                          className="mk-select"
                          style={{ width: "auto" }}
                          value={reminderDay[job.id] ?? "Tue"}
                          onChange={(e) =>
                            setReminderDay((r) => ({
                              ...r,
                              [job.id]: e.target.value as Day,
                            }))
                          }
                        >
                          {days.map((d) => (
                            <option key={d} value={d}>
                              {d} 18:00
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="mk-btn mk-btn-secondary mk-btn-sm"
                          onClick={() =>
                            update(job.id, {
                              reminder: reminderDay[job.id] ?? "Tue",
                            })
                          }
                        >
                          <BellRing size={14} aria-hidden="true" />{" "}
                          {job.reminder ? "Update reminder" : "Set reminder"}
                        </button>
                        <button
                          type="button"
                          className="mk-icon-btn"
                          aria-label={`Return ${job.title} to draft`}
                          onClick={() =>
                            update(job.id, { state: "queued", reminder: null })
                          }
                        >
                          <Undo2 size={15} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </m.li>
                ))}
              </AnimatePresence>
            </ul>
          </section>

          <section aria-labelledby={`${uid}-schedule`}>
            <h3
              id={`${uid}-schedule`}
              className="mk-overline flex items-center gap-2"
            >
              <CalendarDays size={14} aria-hidden="true" /> Publishing schedule
            </h3>
            <div className="mt-3 grid grid-cols-7 gap-1">
              {days.map((day) => {
                const runs = jobs.filter((job) => job.day === day);
                const reminders = jobs.filter(
                  (job) => job.reminder === day && job.state === "approved",
                );
                return (
                  <div
                    key={day}
                    className="flex min-h-28 min-w-0 flex-col gap-1 rounded-lg border border-(--border) bg-(--bg)/50 p-1 sm:p-1.5"
                  >
                    <span className="text-center text-[0.6875rem] font-semibold text-(--muted)">
                      {day}
                    </span>
                    {runs.map((job) => (
                      <span
                        key={job.id}
                        title={`Generation run: ${job.title}`}
                        className={cn(
                          "rounded bg-(--accent)/20 px-1 py-0.5 text-center text-[0.625rem] font-medium text-[#ddd6fe]",
                          !active && "opacity-40",
                        )}
                      >
                        Run
                      </span>
                    ))}
                    <AnimatePresence>
                      {reminders.map((job) => (
                        <m.span
                          key={job.id}
                          layout
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          title={`Reminder to post: ${job.title}`}
                          className="flex items-center justify-center gap-0.5 rounded bg-(--success)/20 px-1 py-0.5 text-[0.625rem] font-medium text-[#86efac]"
                        >
                          <BellRing size={9} aria-hidden="true" /> Post
                        </m.span>
                      ))}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
            <p
              className="mt-3 text-[0.8125rem] text-(--muted)"
              aria-live="polite"
            >
              {jobs.some((job) => job.reminder && job.state === "approved")
                ? "Reminder set. You post the approved MP4 yourself; direct publishing is upcoming."
                : "Approve a video, then set a reminder to post it. Reminders never upload anything."}
            </p>
          </section>
        </div>
      </div>
      <p className="mk-preview-disclosure">
        Sample schedule. Changes apply to this preview only.
      </p>
    </div>
  );
}
