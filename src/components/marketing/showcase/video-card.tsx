"use client";

import Image from "next/image";
import {
  AlertTriangle,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/components/ui/button";
import {
  categoryLabel,
  formatDuration,
  type ShowcaseEntry,
} from "../data/showcase";
import { CreateFromPrompt } from "../ui/create-from-prompt";

const PLAY_EVENT = "mk:video-play";

type Status = "idle" | "loading" | "playing" | "paused" | "ended" | "error";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function VideoCard({
  entry,
  priority = false,
  sizes = "(min-width: 1024px) 280px, (min-width: 640px) 45vw, 80vw",
  showCreate = true,
  className,
}: {
  entry: ShowcaseEntry;
  priority?: boolean;
  sizes?: string;
  showCreate?: boolean;
  className?: string;
}) {
  const instance = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const frame = useRef(0);
  const [mounted, setMounted] = useState(false);
  const [preview, setPreview] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [muted, setMuted] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const titleId = `${instance}-title`;

  const active =
    status === "playing" ||
    status === "paused" ||
    status === "loading" ||
    status === "ended";

  /** Drives the progress bar from the real playback position while playing. */
  const startProgress = useCallback(() => {
    cancelAnimationFrame(frame.current);
    const step = () => {
      const video = videoRef.current;
      if (video && barRef.current && video.duration) {
        barRef.current.style.transform = `scaleX(${video.currentTime / video.duration})`;
      }
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // Only one card plays with controls at a time.
  useEffect(() => {
    const onOtherPlay = (event: Event) => {
      if ((event as CustomEvent<string>).detail === instance) return;
      const video = videoRef.current;
      if (video && !video.paused) video.pause();
      setPreview(false);
    };
    window.addEventListener(PLAY_EVENT, onOtherPlay);
    return () => window.removeEventListener(PLAY_EVENT, onOtherPlay);
  }, [instance]);

  const start = useCallback(
    async (fromStart = false) => {
      const wasPreview = preview;
      setMounted(true);
      setPreview(false);
      setStatus("loading");
      window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: instance }));
      // The <video> element mounts on the next render.
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const video = videoRef.current;
      if (!video) return;
      if (fromStart || wasPreview || video.ended) video.currentTime = 0;
      // A click is a user gesture, so play with sound; fall back to muted if the browser refuses.
      video.muted = false;
      setMuted(false);
      try {
        await video.play();
      } catch {
        video.muted = true;
        setMuted(true);
        try {
          await video.play();
        } catch {
          setStatus("error");
          return;
        }
      }
      if (!video.paused) {
        setStatus("playing");
        startProgress();
      }
    },
    [instance, preview, startProgress],
  );

  function togglePlay() {
    const video = videoRef.current;
    if (!video || status === "idle" || status === "error") return void start();
    if (status === "ended") return void start(true);
    if (video.paused) void video.play();
    else video.pause();
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    if (videoRef.current) videoRef.current.muted = next;
  }

  function onPointerEnter(event: React.PointerEvent) {
    if (event.pointerType !== "mouse" || active || prefersReducedMotion())
      return;
    setMounted(true);
    setPreview(true);
  }

  function onPointerLeave() {
    if (!preview) return;
    setPreview(false);
    const video = videoRef.current;
    if (video && status === "idle") {
      video.pause();
      video.currentTime = 0;
    }
  }

  // Muted hover preview plays silently without controls.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !preview || active) return;
    video.muted = true;
    video.play().catch(() => setPreview(false));
  }, [preview, active, mounted]);

  const label =
    status === "playing" ? "Pause" : status === "ended" ? "Replay" : "Play";

  return (
    <article
      aria-labelledby={titleId}
      className={cn("group flex flex-col gap-3", className)}
    >
      <div
        className={cn(
          "mk-video-frame mk-lift border border-white/[0.07]",
          status === "playing" && "ring-2 ring-(--accent)/60",
        )}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        <Image
          src={entry.poster}
          alt=""
          fill
          sizes={sizes}
          priority={priority}
          className={cn(
            "mk-zoom-img transition-opacity duration-500",
            (active || preview) && status !== "error" && "opacity-0",
          )}
        />
        {mounted && (
          <video
            ref={videoRef}
            poster={entry.poster}
            playsInline
            loop={preview && !active}
            muted={muted}
            preload="none"
            aria-label={`${entry.title} (${categoryLabel[entry.category]} sample)`}
            className={cn(
              "transition-opacity duration-300",
              active || preview ? "opacity-100" : "opacity-0",
            )}
            onPlaying={() => {
              if (preview && !active) return;
              setStatus("playing");
              startProgress();
            }}
            onWaiting={() => active && setStatus("loading")}
            onPause={(event) => {
              cancelAnimationFrame(frame.current);
              if (!event.currentTarget.ended && active) setStatus("paused");
            }}
            onEnded={() => {
              cancelAnimationFrame(frame.current);
              if (barRef.current) barRef.current.style.transform = "scaleX(1)";
              setStatus("ended");
            }}
            onTimeUpdate={(event) =>
              setElapsed(Math.floor(event.currentTarget.currentTime))
            }
            onError={() => setStatus("error")}
          >
            {entry.webm && <source src={entry.webm} type="video/webm" />}
            <source
              src={entry.src}
              type="video/mp4"
              onError={() => setStatus("error")}
            />
          </video>
        )}

        <div
          className="mk-video-scrim pointer-events-none absolute inset-0"
          aria-hidden="true"
        />

        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <span className="mk-badge mk-badge-overlay">
            {categoryLabel[entry.category]}
          </span>
          {entry.provenance === "illustrative" ? (
            <span className="mk-badge mk-badge-overlay text-[0.625rem]">
              Illustrative
            </span>
          ) : (
            <span className="mk-badge mk-badge-overlay text-[0.625rem]">
              Made with Clipvero
            </span>
          )}
        </div>

        {/* Center play affordance (also the main click target). */}
        <button
          type="button"
          onClick={togglePlay}
          aria-label={`${label} “${entry.title}”`}
          aria-describedby={titleId}
          className="absolute inset-0 flex items-center justify-center focus-visible:outline-offset-[-4px]"
        >
          {status === "loading" ? (
            <span className="mk-spinner" aria-hidden="true" />
          ) : status === "error" ? (
            <span className="flex flex-col items-center gap-2 rounded-2xl bg-black/70 px-4 py-3 text-center text-sm text-white">
              <AlertTriangle
                size={20}
                aria-hidden="true"
                className="text-(--warning)"
              />
              Couldn&apos;t load this sample.
              <span className="text-xs text-white/70">Tap to retry</span>
            </span>
          ) : (
            <span
              className={cn(
                "flex size-14 items-center justify-center rounded-full bg-white/90 text-black shadow-xl transition-all duration-300",
                status === "playing"
                  ? "scale-90 opacity-0 group-hover:opacity-100"
                  : "group-hover:scale-110",
              )}
              aria-hidden="true"
            >
              {status === "playing" ? (
                <Pause size={22} fill="currentColor" />
              ) : status === "ended" ? (
                <RotateCcw size={22} />
              ) : (
                <Play
                  size={22}
                  fill="currentColor"
                  className="translate-x-0.5"
                />
              )}
            </span>
          )}
        </button>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
          <h3 id={titleId} className="mk-h4 text-pretty text-white drop-shadow">
            {entry.title}
          </h3>
          <span className="mk-mono shrink-0 text-xs text-white/80">
            {active ? `${formatDuration(elapsed)} / ` : ""}
            {formatDuration(entry.durationSeconds)}
          </span>
        </div>

        {active && (
          <div className="absolute right-3 top-12 flex flex-col gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className="mk-icon-btn size-10"
              aria-label={muted ? "Turn sound on" : "Turn sound off"}
              aria-pressed={!muted}
            >
              {muted ? (
                <VolumeX size={17} aria-hidden="true" />
              ) : (
                <Volume2 size={17} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={() => void start(true)}
              className="mk-icon-btn size-10"
              aria-label="Replay from start"
            >
              <RotateCcw size={16} aria-hidden="true" />
            </button>
          </div>
        )}

        {active && (
          <div className="mk-progress" aria-hidden="true">
            <span ref={barRef} style={{ transform: "scaleX(0)" }} />
          </div>
        )}
      </div>

      {showCreate && (
        <CreateFromPrompt
          mode={entry.mode}
          prompt={entry.prompt}
          label="Create a similar video"
          className="w-full"
        />
      )}
    </article>
  );
}
