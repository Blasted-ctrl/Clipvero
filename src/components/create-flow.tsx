"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Clapperboard,
  FileText,
  Gamepad2,
  Lightbulb,
  Megaphone,
  Scissors,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import {
  createSchema,
  estimateCost,
  modes,
  voices,
  isLocalVoice,
  type Mode,
  type Project,
} from "@/lib/model";
import { api, useAction, useApp, useNotify } from "./app-provider";
import { Button } from "./ui/button";
import { dsaReels, dsaReelInput } from "@/lib/dsa-reels";
export const modeIcons = {
  sparkles: Sparkles,
  text: FileText,
  users: Users,
  book: BookOpen,
  gamepad: Gamepad2,
  lightbulb: Lightbulb,
  megaphone: Megaphone,
  scissors: Scissors,
};
export function CreateFlow({ autopilot = false }: { autopilot?: boolean }) {
  const { data } = useApp(),
    router = useRouter(),
    params = useSearchParams(),
    notify = useNotify(),
    { act, busy } = useAction();
  const initial = modes.find((m) => m.id === params.get("mode"))?.id;
  const [mode, setMode] = useState<Mode | null>(
      autopilot ? "prompt" : initial || null,
    ),
    [voice, setVoice] = useState("none"),
    [images, setImages] = useState(false),
    [look, setLook] = useState<"classic" | "explainer" | "conversation">(
      "classic",
    ),
    [source, setSource] = useState(""),
    [characterIds, setCharacterIds] = useState<string[]>([]);
  const [lesson, setLesson] = useState("");
  const [seconds, setSeconds] = useState(30);
  const [aspect, setAspect] = useState("9:16");
  const prepared = lesson ? dsaReelInput(lesson) : null;
  const selected = modes.find((m) => m.id === mode),
    ai = Boolean((selected?.ai && !prepared) || voice !== "none" || images),
    // Free local voices run without an API key.
    needsKey = Boolean(
      (selected?.ai && !prepared && !data?.capabilities.writer) ||
      mode === "clips" ||
      images ||
      (voice !== "none" && !isLocalVoice(voice)),
    );
  const videos = data?.assets.filter((a) => a.kind === "video") || [];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    try {
      const content = String(
        f.get("content") || "Find complete, coherent speech segments.",
      ).trim();
      const paragraphs = content
        .split(/\n\s*\n/)
        .map((text) => text.trim())
        .filter(Boolean);
      if (prepared && paragraphs.length !== prepared.beats!.length)
        throw new Error(
          `This storyboard has ${prepared.beats!.length} beats. Keep one paragraph per beat so each diagram stays with its narration.`,
        );
      const input = createSchema.parse({
        title: f.get("title"),
        mode: prepared ? "script" : mode,
        content: prepared ? paragraphs.join("\n\n") : content,
        beats: prepared?.beats?.map((beat, i) => ({
          ...beat,
          text: paragraphs[i],
        })),
        duration: Number(f.get("duration")),
        aspect: f.get("aspect"),
        voice,
        tone: f.get("tone"),
        language: f.get("language"),
        generateImages: images,
        style: look,
        visual: f.get("visual") || "grid",
        mascotAssetId: f.get("mascotAssetId") || undefined,
        sourceAssetId: source || undefined,
        characterIds,
        presetId: f.get("presetId") || undefined,
        clipCount: Number(f.get("clipCount") || 3),
        rightsConfirmed: f.get("rights") === "on",
      });
      await act(async () => {
        if (autopilot) {
          await api("pipelines", "POST", {
            name: input.title,
            config: input,
            intervalHours: Number(f.get("interval")),
            maxRuns: Number(f.get("maxRuns")),
            budget: Number(f.get("budget")),
          });
          router.push("/pipelines");
          notify(
            "Autopilot saved. Review the limits, then activate it when you’re ready.",
          );
        } else if (ai) {
          await api("generate", "POST", input);
          router.push("/projects");
          notify("Video queued. Follow its progress in your project activity.");
        } else {
          const project = await api<Project>("projects", "POST", input);
          router.push(`/editor/${project.id}`);
        }
      });
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Check your video settings.",
        true,
      );
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {autopilot ? "SET IT IN MOTION" : "THE START OF SOMETHING GOOD"}
          </span>
          <h1>{autopilot ? "Create an autopilot" : "What will you create?"}</h1>
          <p>
            {autopilot
              ? "Give your ideas a schedule. Every finished video comes back to you for review."
              : "Start with an idea, a script, or a moment worth sharing."}
          </p>
        </div>
        {mode && !autopilot && (
          <Button
            variant="ghost"
            onClick={() => {
              setMode(null);
              setLesson("");
              setLook("classic");
            }}
          >
            <ArrowLeft size={16} />
            All formats
          </Button>
        )}
      </div>
      {!mode ? (
        <>
          <div className="section-label">
            <h2>Choose your starting point</h2>
            <span>8 ways to tell your story</span>
          </div>
          <div className="mode-grid">
            {modes.map((m) => {
              const Icon = modeIcons[m.icon];
              return (
                <button
                  className="mode-card"
                  key={m.id}
                  onClick={() => setMode(m.id)}
                >
                  <span className={`mode-icon mode-${m.id}`}>
                    <Icon size={23} />
                  </span>
                  <div>
                    <h3>{m.name}</h3>
                    <p>{m.description}</p>
                  </div>
                  <span className="mode-card-bottom">
                    {m.ai ? "AI-assisted" : "Start with your content"}
                    <ArrowRight size={16} />
                  </span>
                </button>
              );
            })}
          </div>
          <div className="tip-row">
            <span className="tip-icon">
              <Clapperboard size={20} />
            </span>
            <div>
              <strong>Already have a script?</strong>
              <p>
                Open the editor without any AI setup. Your words stay exactly as
                you wrote them.
              </p>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link
                href="/create?mode=script"
                onClick={(e) => {
                  e.preventDefault();
                  setMode("script");
                }}
              >
                Use my script <ArrowRight size={14} />
              </Link>
            </Button>
          </div>
        </>
      ) : (
        <form key={lesson} className="creation-layout" onSubmit={submit}>
          <div className="panel creation-form">
            <div className="selected-format">
              <span className="mode-icon">
                <Clapperboard size={22} />
              </span>
              <div>
                <h2>{autopilot ? "Autopilot settings" : selected?.name}</h2>
                <p className="muted">{selected?.description}</p>
              </div>
              <span className="badge">
                {ai ? "AI-assisted" : "You’re in control"}
              </span>
            </div>
            {mode === "explainer" && !autopilot && (
              <label>
                Lesson storyboard
                <select
                  value={lesson}
                  onChange={(e) => {
                    setLesson(e.target.value);
                    if (e.target.value) {
                      setVoice("free-cute");
                      setLook("explainer");
                      setImages(false);
                      setSource("");
                      setAspect("9:16");
                      setSeconds(90);
                    }
                  }}
                >
                  <option value="">Write from my topic</option>
                  {dsaReels.map((reel) => (
                    <option key={reel.id} value={reel.id}>
                      {reel.title}
                    </option>
                  ))}
                </select>
                <small>
                  {lesson
                    ? dsaReels.find((r) => r.id === lesson)?.summary
                    : "Start with a supplied lesson or write from your own source material."}
                </small>
                {lesson && (
                  <small>
                    Includes persistent diagrams, Python examples and local
                    narration. You can edit the words; keep one paragraph per
                    beat. Diagrams stay unchanged, so review them against your
                    edits.
                  </small>
                )}
              </label>
            )}
            {prepared && (
              <div className="muted">
                Review the lesson against its sources:{" "}
                {dsaReels
                  .find((reel) => reel.id === lesson)
                  ?.sources.map((url, i) => (
                    <span key={url}>
                      {i > 0 ? ", " : ""}
                      <a href={url} target="_blank" rel="noreferrer">
                        Python documentation {i + 1}
                      </a>
                    </span>
                  ))}
              </div>
            )}
            {autopilot && (
              <label>
                Creation format
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as Mode)}
                >
                  {modes
                    .filter(
                      (m) => !["script", "gameplay", "clips"].includes(m.id),
                    )
                    .map((m) => (
                      <option value={m.id} key={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label>
              {autopilot ? "Autopilot name" : "Project name"}
              <input
                name="title"
                defaultValue={prepared?.title}
                required
                maxLength={120}
                placeholder={
                  autopilot ? "Daily curious facts" : "Give your video a name"
                }
              />
            </label>
            <label>
              {prepared || mode === "script" || mode === "gameplay"
                ? "Your script"
                : mode === "marketing"
                  ? "Approved product information & campaign goal"
                  : mode === "explainer"
                    ? "Topic & source material"
                    : mode === "clips"
                      ? "Notes for your review (optional)"
                      : "What’s the story?"}
              <textarea
                name="content"
                defaultValue={prepared?.content}
                rows={7}
                required={mode !== "clips"}
                maxLength={12000}
                placeholder={
                  mode === "script"
                    ? "Paste your script here. Use a blank line between scenes."
                    : mode === "explainer"
                      ? "Paste the source text and source links. Check the facts before exporting."
                      : "Describe your idea, audience, and the story you want to tell…"
                }
              />
              <small>
                {["script", "gameplay"].includes(mode)
                  ? "Blank lines create separate scenes. Your original words are preserved."
                  : "Use original or authorized content. Source URLs are kept as context; this version does not fetch websites."}
              </small>
            </label>
            {["script", "gameplay", "explainer", "marketing"].includes(
              mode,
            ) && (
              <label className="file-text-import">
                Or import a text document
                <input
                  type="file"
                  accept=".txt,.md,text/plain"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 12000) {
                      notify("Use a text document under 12 KB.", true);
                      return;
                    }
                    const text = await file.text();
                    const form = e.target.closest("form");
                    const field = form?.querySelector<HTMLTextAreaElement>(
                      'textarea[name="content"]',
                    );
                    if (field) field.value = text;
                  }}
                />
              </label>
            )}
            <div className="form-grid three">
              <label>
                Duration
                <select
                  name="duration"
                  value={seconds}
                  onChange={(e) => setSeconds(Number(e.target.value))}
                >
                  {[5, 15, 30, 60, 90, 120, 150].map((n) => (
                    <option key={n} value={n}>
                      {n} seconds
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Aspect ratio
                <select
                  name="aspect"
                  value={aspect}
                  onChange={(e) => setAspect(e.target.value)}
                >
                  <option value="9:16">9:16 · Vertical</option>
                  <option value="1:1" disabled={look === "explainer"}>
                    1:1 · Square
                  </option>
                  <option value="16:9" disabled={look === "explainer"}>
                    16:9 · Landscape
                  </option>
                </select>
              </label>
              <label>
                Language
                <select name="language">
                  {["English", "Spanish", "French", "German", "Portuguese"].map(
                    (l) => (
                      <option key={l}>{l}</option>
                    ),
                  )}
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label>
                Voice
                <select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                >
                  {voices.map((v) => (
                    <option value={v} key={v}>
                      {v === "none"
                        ? "No AI narration"
                        : v.startsWith("free-")
                          ? `Free voice · ${v.slice(5)}`
                          : v[0].toUpperCase() + v.slice(1)}
                    </option>
                  ))}
                </select>
                <small>
                  AI voices are synthetic. Free voices run on this computer and
                  need no API key.
                </small>
              </label>
              <label>
                Look
                <select
                  value={look}
                  onChange={(e) => {
                    setLook(
                      e.target.value as
                        "classic" | "explainer" | "conversation",
                    );
                    if (e.target.value === "conversation") {
                      setImages(false);
                      setAspect("9:16");
                    }
                    if (e.target.value === "explainer") {
                      setImages(false);
                      setSource("");
                      setAspect("9:16");
                    }
                  }}
                >
                  <option value="classic" disabled={!!prepared}>
                    Classic captions
                  </option>
                  <option
                    value="explainer"
                    disabled={mode === "clips" || mode === "gameplay"}
                  >
                    Animated explainer with mascot
                  </option>
                  <option
                    value="conversation"
                    disabled={
                      !!prepared ||
                      ["script", "gameplay", "clips"].includes(mode)
                    }
                  >
                    Two hosts talking it through
                  </option>
                </select>
              </label>
              {look === "explainer" && (
                <>
                  <label>
                    Background
                    <select name="visual">
                      <option value="grid">Subtle grid</option>
                      <option value="complexity">Big O growth chart</option>
                    </select>
                  </label>
                  <label>
                    Mascot
                    <select name="mascotAssetId">
                      <option value="">Clipvero guide (default)</option>
                      {data?.assets
                        .filter((a) => a.kind === "image")
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </select>
                    <small>
                      Use a transparent PNG you own or have licensed.
                    </small>
                  </label>
                </>
              )}
              <label>
                Tone
                <select name="tone">
                  {[
                    "Conversational",
                    "Dramatic",
                    "Educational",
                    "Playful",
                    "Professional",
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Brand preset
              <select name="presetId" defaultValue="">
                <option value="">Studio default</option>
                {data?.presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {mode === "clips"
                ? "Source footage"
                : look === "conversation"
                  ? "Background gameplay (your recording)"
                  : "Background footage (optional)"}
              <select
                required={mode === "clips" || mode === "gameplay"}
                disabled={look === "explainer"}
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">
                  {videos.length
                    ? "Choose from your asset library"
                    : "Upload footage in Asset Library first"}
                </option>
                {videos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            {mode === "clips" ? (
              <>
                <label>
                  Maximum clips
                  <select name="clipCount">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <p className="notice">
                  Creates transcript-based excerpts ranked by duration fit.
                  Automatic speaker tracking and editorial highlight scoring are
                  not available in this version. Source audio is preserved.
                </p>
              </>
            ) : (
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={images}
                  onChange={(e) => setImages(e.target.checked)}
                  disabled={look === "explainer"}
                />
                <span>
                  Generate original scene illustrations
                  <small>
                    Uses additional credits. Without illustrations, use styled
                    captions or your own footage.
                  </small>
                </span>
              </label>
            )}
            {mode === "characters" && (
              <fieldset>
                <legend>Cast your story</legend>
                {!data?.characters.length && (
                  <p className="muted">
                    Create an original character in Character Studio first.
                  </p>
                )}
                {data?.characters.map((c) => (
                  <label className="check-row" key={c.id}>
                    <input
                      type="checkbox"
                      checked={characterIds.includes(c.id)}
                      onChange={(e) =>
                        setCharacterIds(
                          e.target.checked
                            ? [...characterIds, c.id].slice(0, 4)
                            : characterIds.filter((id) => id !== c.id),
                        )
                      }
                    />
                    {c.name}
                  </label>
                ))}
                <small className="muted">
                  Approved references guide visuals. This release uses one
                  narrator per video; multi-voice dialogue is pending.
                </small>
              </fieldset>
            )}
            {autopilot && (
              <div className="form-grid three">
                <label>
                  Create every
                  <select name="interval">
                    <option value="24">Day</option>
                    <option value="48">2 days</option>
                    <option value="168">Week</option>
                  </select>
                </label>
                <label>
                  Maximum runs
                  <input
                    name="maxRuns"
                    type="number"
                    min={1}
                    max={120}
                    defaultValue={12}
                    required
                  />
                </label>
                <label>
                  Total credit budget
                  <input
                    name="budget"
                    type="number"
                    min={1}
                    max={1200}
                    defaultValue={60}
                    required
                  />
                </label>
              </div>
            )}
            <label className="check-row rights-check">
              <input name="rights" type="checkbox" required />
              <span>
                I own or have permission to use this content and any characters,
                footage, and voices.
              </span>
            </label>
            {needsKey && !data?.capabilities.ai && (
              <p className="notice">
                AI creation needs a server API key.{" "}
                <Link href="/help">See setup instructions</Link>. You can save
                an autopilot while setup is pending.
              </p>
            )}
            <div className="form-actions">
              <Button
                variant="ghost"
                type="button"
                onClick={() => router.push("/overview")}
              >
                Cancel
              </Button>
              <Button
                disabled={
                  busy || (needsKey && !data?.capabilities.ai && !autopilot)
                }
                type="submit"
              >
                {autopilot ? <Workflow size={16} /> : <Sparkles size={16} />}
                {busy
                  ? "Saving…"
                  : autopilot
                    ? "Save autopilot"
                    : ai
                      ? "Generate video"
                      : "Open in editor"}
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>
          <aside className="creation-summary panel">
            <span className="eyebrow">YOUR CREATIVE BRIEF</span>
            <div className="format-preview">
              <span>9:16</span>
              <Clapperboard size={36} />
              <p>
                Something good
                <br />
                is taking shape.
              </p>
            </div>
            <h3>{selected?.name}</h3>
            <p>
              {ai
                ? "Your video will appear in Projects when the worker finishes. Review every scene before sharing."
                : "Start with an editable timeline. Add your visuals, make it yours, then render an MP4."}
            </p>
            <div className="summary-point">
              <Check size={15} />
              Editable scene timeline
            </div>
            <div className="summary-point">
              <Check size={15} />
              Preview before you export
            </div>
            <div className="summary-point">
              <Check size={15} />
              Your content stays private
            </div>
            <div className="summary-credits">
              <Sparkles size={15} />
              {ai
                ? `Estimated ${estimateCost(createSchema.parse({ title: "Estimate", mode: prepared ? "script" : mode, content: "Estimate", duration: seconds, voice, generateImages: images, rightsConfirmed: true }))} credits`
                : "Editing is free · render from 1 credit"}
            </div>
            <LinkHelp />
          </aside>
        </form>
      )}
    </>
  );
}
function LinkHelp() {
  return (
    <Link className="text-link" href="/help">
      How creation works <ChevronRight size={14} />
    </Link>
  );
}
