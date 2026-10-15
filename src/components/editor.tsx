"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Player, type PlayerRef } from "@remotion/player";
import { useStore } from "zustand";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  Film,
  ImageIcon,
  LoaderCircle,
  Music2,
  Plus,
  Redo2,
  Save,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  dimensions,
  duration,
  scriptTimeline,
  type Project,
  type Scene,
  type Timeline,
} from "@/lib/model";
import { createEditorStore } from "@/lib/editor-store";
import {
  VideoComposition,
  type MediaMap,
} from "@clipvero/video-engine/composition";
import { api, useAction, useApp, useNotify } from "./app-provider";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Empty, Status, time } from "./common";
import { ScheduleButton } from "./studio-pages";

export function Editor({
  id,
  foundation = false,
}: {
  id: string;
  foundation?: boolean;
}) {
  const workspace = useApp();
  const query = useQuery({
    queryKey: ["project", id],
    queryFn: () => api<Project>(`projects/${id}`),
    refetchOnWindowFocus: false,
    retry: false,
  });
  if (query.isLoading)
    return (
      <div className="page-loading" role="status">
        Opening your edit…
      </div>
    );
  if (query.error)
    return (
      <Empty
        title="We couldn’t open that project"
        description={query.error.message}
        action={
          <Button asChild>
            <Link href="/projects">Back to projects</Link>
          </Button>
        }
      />
    );
  if (foundation && !workspace.data)
    return (
      <p role="status">
        {workspace.error
          ? "Workspace permissions could not load. Refresh to try again."
          : "Loading workspace permissions…"}
      </p>
    );
  if (foundation && workspace.data?.me.role === "viewer" && query.data)
    return <ReadOnlyProject project={query.data} />;
  return query.data ? (
    <LoadedEditor key={id} initial={query.data} foundation={foundation} />
  ) : null;
}
function ReadOnlyProject({ project }: { project: Project }) {
  return (
    <div className="foundation-content">
      <Button asChild variant="ghost">
        <Link href="/projects">Back to projects</Link>
      </Button>
      <h1>{project.title}</h1>
      <p className="muted">
        View only · Revision {project.revision}. An editor can save changes.
      </p>
      <Player
        component={VideoComposition}
        inputProps={{ timeline: project.timeline, media: {} }}
        durationInFrames={duration(project.timeline)}
        fps={30}
        compositionWidth={dimensions(project.timeline.aspect).width}
        compositionHeight={dimensions(project.timeline.aspect).height}
        controls
        style={{ width: "100%", maxHeight: "65vh" }}
      />
    </div>
  );
}
function LoadedEditor({
  initial,
  foundation,
}: {
  initial: Project;
  foundation: boolean;
}) {
  const router = useRouter();
  const [store] = useState(() => createEditorStore(initial.timeline)),
    state = useStore(store),
    { timeline, change, undo, redo } = state;
  const { data } = useApp(),
    { act, busy } = useAction(),
    notify = useNotify(),
    client = useQueryClient(),
    player = useRef<PlayerRef>(null);
  const [title, setTitle] = useState(initial.title),
    [selected, setSelected] = useState(initial.timeline.scenes[0].id),
    [tab, setTab] = useState("scenes"),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(
      JSON.stringify({ title: initial.title, timeline: initial.timeline }),
    ),
    [saveError, setSaveError] = useState(""),
    [preview, setPreview] = useState(false),
    [command, setCommand] = useState(""),
    [proposal, setProposal] = useState<{
      timeline: Timeline;
      operations: unknown[];
      revision: number;
    } | null>(null);
  const [savedRevision, setSavedRevision] = useState(initial.revision);
  const revision = useRef(initial.revision),
    pending = useRef<Promise<boolean> | null>(null),
    titleRef = useRef(title);
  const serialized = JSON.stringify({ title, timeline }),
    savedRef = useRef(saved);
  const current = data?.projects.find((p) => p.id === initial.id) || initial;
  const activeJob = data?.jobs.find(
    (j) =>
      j.projectId === initial.id && ["queued", "running"].includes(j.state),
  );
  const scene =
      timeline.scenes.find((s) => s.id === selected) || timeline.scenes[0],
    sceneIndex = timeline.scenes.indexOf(scene);
  const dirty = serialized !== saved,
    currentRender = Boolean(
      current.outputAssetId &&
      current.renderedRevision === savedRevision &&
      !dirty,
    );
  const media: MediaMap = Object.fromEntries(
    (data?.assets || []).map((a) => [
      a.id,
      { src: `/api/assets/${a.id}`, kind: a.kind },
    ]),
  );
  const save = useCallback(async (): Promise<boolean> => {
    if (pending.current) {
      const result = await pending.current;
      if (!result) return false;
    }
    const snapshot = {
        title: titleRef.current,
        timeline: store.getState().timeline,
      },
      value = JSON.stringify(snapshot);
    if (value === savedRef.current) return true;
    setSaving(true);
    setSaveError("");
    const request = api<Project>(`projects/${initial.id}`, "PATCH", {
      ...snapshot,
      revision: revision.current,
    })
      .then((p) => {
        revision.current = p.revision;
        setSavedRevision(p.revision);
        savedRef.current = value;
        setSaved(value);
        client.setQueryData(["project", initial.id], p);
        return true;
      })
      .catch((e) => {
        setSaveError(e.message);
        return false;
      })
      .finally(() => {
        pending.current = null;
        setSaving(false);
      });
    pending.current = request;
    return request;
  }, [store, initial.id, client]);
  useEffect(() => {
    if (!dirty || saveError) return;
    const timer = setTimeout(() => {
      void save();
    }, 1200);
    return () => clearTimeout(timer);
  }, [serialized, dirty, save, saveError]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (
        JSON.stringify({
          title: titleRef.current,
          timeline: store.getState().timeline,
        }) !== savedRef.current
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [store]);
  useEffect(() => {
    const navigate = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = (event.target as Element).closest<HTMLAnchorElement>(
        "a[href]",
      );
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      )
        return;
      const target = new URL(anchor.href, window.location.href);
      if (
        target.origin !== window.location.origin ||
        target.pathname.startsWith("/api/") ||
        target.href === window.location.href
      )
        return;
      const unsaved =
        JSON.stringify({
          title: titleRef.current,
          timeline: store.getState().timeline,
        }) !== savedRef.current;
      if (!unsaved && !pending.current) return;
      event.preventDefault();
      event.stopPropagation();
      void save().then((ok) => {
        if (ok) router.push(target.pathname + target.search + target.hash);
        else
          notify(
            "Your edit could not be saved. Resolve the save error before leaving, or download your unsaved edit.",
            true,
          );
      });
    };
    document.addEventListener("click", navigate, true);
    return () => document.removeEventListener("click", navigate, true);
  }, [save, router, store, notify]);
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.matches("input,textarea,select") || el.isContentEditable) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.code === "Space") {
        e.preventDefault();
        player.current?.toggle();
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [undo, redo]);
  function updateScene(patch: Partial<Scene>) {
    change((t) => {
      Object.assign(
        t.scenes.find((s) => s.id === scene.id)!,
        patch,
      );
    });
  }
  async function render() {
    await act(async () => {
      if (!(await save()))
        throw new Error(
          "Save your edits before rendering. Resolve the save error first.",
        );
      await api(`projects/${initial.id}/render`, "POST");
    }, "Render queued. You can keep working; this render uses your saved revision.");
  }
  function select(id: string) {
    setSelected(id);
    const index = timeline.scenes.findIndex((s) => s.id === id);
    player.current?.seekTo(
      timeline.scenes.slice(0, index).reduce((a, s) => a + s.durationFrames, 0),
    );
  }
  return (
    <>
      <div className="editor-top">
        <div>
          <Link
            href="/projects"
            className="icon-button"
            aria-label="Back to projects"
          >
            <ArrowLeft size={18} />
          </Link>
          <input
            className="editor-title"
            aria-label="Project name"
            value={title}
            maxLength={120}
            onChange={(e) => {
              titleRef.current = e.target.value;
              setTitle(e.target.value);
            }}
          />
          <span
            className={`save-state ${saveError ? "error-text" : ""}`}
            role="status"
          >
            {saveError ? (
              "Save failed"
            ) : saving ? (
              <>
                <LoaderCircle size={12} />
                Saving…
              </>
            ) : dirty ? (
              "Unsaved changes"
            ) : (
              <>
                <Check size={12} />
                Saved
              </>
            )}
          </span>
        </div>
        <div className="editor-top-actions">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Undo"
            disabled={!state.past.length}
            onClick={undo}
          >
            <Undo2 size={17} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Redo"
            disabled={!state.future.length}
            onClick={redo}
          >
            <Redo2 size={17} />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={saving}
            onClick={() => save()}
          >
            <Save size={14} />
            Save
          </Button>
          {currentRender && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPreview(true)}
            >
              View MP4
            </Button>
          )}
          {!foundation && (
            <Button
              size="sm"
              disabled={busy || Boolean(activeJob) || saving}
              onClick={render}
            >
              <Film size={15} />
              {activeJob ? "Rendering…" : "Render video"}
            </Button>
          )}
        </div>
      </div>
      {saveError && (
        <div className="notice inline-error" role="alert">
          {saveError}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSaveError("");
              void save();
            }}
          >
            Retry save
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a
              href={`data:application/json;charset=utf-8,${encodeURIComponent(serialized)}`}
              download="clipvero-unsaved-project.json"
            >
              Download your unsaved edit
            </a>
          </Button>
        </div>
      )}
      {activeJob && (
        <div className="render-progress">
          <span>{activeJob.stage}</span>
          {activeJob.progress != null && (
            <>
              <progress max={1} value={activeJob.progress} />
              <strong>{Math.round(activeJob.progress * 100)}%</strong>
            </>
          )}
          <small>This job uses revision {activeJob.revision}.</small>
        </div>
      )}
      {foundation && (
        <p className="notice">
          Changes save to your workspace. Private media and MP4 exports are not
          available here yet.
        </p>
      )}
      <div className="editor-workspace">
        <aside className="editor-left">
          <div className="editor-tabs">
            {["scenes", "assets", "style"].map((t) => (
              <button
                key={t}
                className={tab === t ? "selected" : ""}
                onClick={() => setTab(t)}
              >
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          {tab === "scenes" ? (
            <>
              <div className="editor-section-heading">
                <h2>Story scenes</h2>
                <span>{timeline.scenes.length}</span>
              </div>
              <div className="scene-list">
                {timeline.scenes.map((s, i) => (
                  <button
                    key={s.id}
                    className={`scene-item ${scene.id === s.id ? "selected" : ""}`}
                    onClick={() => select(s.id)}
                  >
                    <span
                      className="scene-number"
                      style={{ backgroundColor: s.background }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <strong>
                        {s.caption.slice(0, 35) || `Scene ${i + 1}`}
                      </strong>
                      <small>{time(s.durationFrames / 30)}</small>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  change((t) => {
                    if (t.scenes.length >= 60) return;
                    t.scenes.push({
                      ...scriptTimeline("A new scene.", t.aspect, 3).scenes[0],
                      background: scene.background,
                    });
                  })
                }
              >
                <Plus size={14} />
                Add scene
              </Button>
            </>
          ) : tab === "assets" ? (
            <div className="editor-assets">
              <p className="muted">
                Choose an image or video for the selected scene.
              </p>
              {data?.assets
                .filter((a) => ["image", "video"].includes(a.kind))
                .map((a) => (
                  <button
                    key={a.id}
                    className={scene.assetId === a.id ? "selected" : ""}
                    onClick={() =>
                      updateScene({ assetId: a.id, mediaStart: 0 })
                    }
                  >
                    {a.kind === "image" ? (
                      <ImageIcon size={18} />
                    ) : (
                      <Film size={18} />
                    )}
                    <span>{a.name}</span>
                  </button>
                ))}
              {!foundation && (
                <Button asChild variant="secondary" size="sm">
                  <Link href="/assets">
                    Upload in Asset Library <ArrowUp size={14} />
                  </Link>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateScene({ assetId: null })}
              >
                Remove background media
              </Button>
            </div>
          ) : (
            <div className="editor-properties">
              <label>
                Aspect ratio
                <select
                  value={timeline.aspect}
                  onChange={(e) =>
                    change((t) => {
                      t.aspect = e.target.value as Timeline["aspect"];
                    })
                  }
                >
                  <option>9:16</option>
                  <option>1:1</option>
                  <option>16:9</option>
                </select>
              </label>
              <label>
                Caption size
                <input
                  type="range"
                  min={24}
                  max={100}
                  value={timeline.fontSize}
                  onChange={(e) =>
                    change((t) => {
                      t.fontSize = Number(e.target.value);
                    })
                  }
                />
                <small>{timeline.fontSize}px</small>
              </label>
              <label>
                Caption color
                <input
                  type="color"
                  value={timeline.captionColor}
                  onChange={(e) =>
                    change((t) => {
                      t.captionColor = e.target.value;
                    })
                  }
                />
              </label>
              <label>
                Accent color
                <input
                  type="color"
                  value={timeline.accentColor}
                  onChange={(e) =>
                    change((t) => {
                      t.accentColor = e.target.value;
                    })
                  }
                />
              </label>
              <label>
                Caption position
                <select
                  value={timeline.captionPosition}
                  onChange={(e) =>
                    change((t) => {
                      t.captionPosition = e.target
                        .value as Timeline["captionPosition"];
                    })
                  }
                >
                  <option value="center">Center</option>
                  <option value="bottom">Bottom</option>
                </select>
              </label>
              <label>
                Background music
                <select
                  value={timeline.musicAssetId || ""}
                  onChange={(e) =>
                    change((t) => {
                      t.musicAssetId = e.target.value || null;
                    })
                  }
                >
                  <option value="">No music</option>
                  {data?.assets
                    .filter((a) => a.kind === "audio")
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Music volume
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={timeline.musicVolume}
                  onChange={(e) =>
                    change((t) => {
                      t.musicVolume = Number(e.target.value);
                    })
                  }
                />
                <small>{Math.round(timeline.musicVolume * 100)}%</small>
              </label>
            </div>
          )}
        </aside>
        <section className="editor-canvas">
          <div className="preview-label">
            <span>LIVE PREVIEW</span>
            <span>
              {dimensions(timeline.aspect).width} ×{" "}
              {dimensions(timeline.aspect).height} · 30 FPS
            </span>
          </div>
          <div className="player-wrap">
            <Player
              ref={player}
              component={VideoComposition}
              inputProps={{ timeline, media }}
              durationInFrames={duration(timeline)}
              fps={30}
              compositionWidth={dimensions(timeline.aspect).width}
              compositionHeight={dimensions(timeline.aspect).height}
              controls
              style={{ height: "100%", width: "100%", maxHeight: 520 }}
            />
          </div>
          <div className="editor-preview-footer">
            <span>
              <span className="subtle-dot" />
              Preview uses your timeline
            </span>
            <span>{time(duration(timeline) / 30)}</span>
          </div>
        </section>
        <aside className="editor-right">
          <div className="editor-section-heading">
            <h2>Scene {sceneIndex + 1}</h2>
            <span className="badge">Properties</span>
          </div>
          <div className="editor-properties">
            <label>
              Caption text
              <textarea
                value={scene.caption}
                rows={4}
                maxLength={1600}
                onChange={(e) =>
                  updateScene({ caption: e.target.value, captions: [] })
                }
              />
            </label>
            {scene.captions.length > 0 && (
              <small className="muted">
                {scene.captions.length} timed caption segments. Editing caption
                text replaces these with a scene-wide caption.
              </small>
            )}
            <label>
              Script text
              <textarea
                value={scene.script}
                rows={3}
                maxLength={1600}
                onChange={(e) =>
                  updateScene({
                    script: e.target.value,
                    narrationId: null,
                    captions: [],
                  })
                }
              />
              <small>
                Changing the script removes old narration. Add replacement audio
                below.
              </small>
            </label>
            <div className="form-grid">
              <label>
                Duration (sec)
                <input
                  type="number"
                  min={0.5}
                  max={180}
                  step={0.1}
                  value={Number((scene.durationFrames / 30).toFixed(2))}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (n >= 0.5)
                      updateScene({ durationFrames: Math.round(n * 30) });
                  }}
                />
              </label>
              <label>
                Source in (sec)
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={scene.mediaStart}
                  onChange={(e) =>
                    updateScene({
                      mediaStart: Math.max(0, Number(e.target.value)),
                    })
                  }
                />
              </label>
            </div>
            <label>
              Background color
              <input
                type="color"
                value={scene.background}
                onChange={(e) => updateScene({ background: e.target.value })}
              />
            </label>
            <div className="form-grid">
              <label>
                Transition
                <select
                  value={scene.transition}
                  onChange={(e) =>
                    updateScene({
                      transition: e.target.value as Scene["transition"],
                    })
                  }
                >
                  <option value="fade">Fade in</option>
                  <option value="cut">Cut</option>
                </select>
              </label>
              <label>
                Media fit
                <select
                  value={scene.fit}
                  onChange={(e) =>
                    updateScene({ fit: e.target.value as Scene["fit"] })
                  }
                >
                  <option value="cover">Fill frame</option>
                  <option value="contain">Fit inside</option>
                </select>
              </label>
            </div>
            <label>
              Source video volume
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={scene.sourceVolume}
                onChange={(e) =>
                  updateScene({ sourceVolume: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Narration audio
              <select
                value={scene.narrationId || ""}
                onChange={(e) =>
                  updateScene({ narrationId: e.target.value || null })
                }
              >
                <option value="">No narration</option>
                {data?.assets
                  .filter((a) => a.kind === "audio")
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="scene-tools">
              <Button
                size="icon"
                variant="secondary"
                disabled={sceneIndex === 0}
                aria-label="Move scene earlier"
                onClick={() =>
                  change((t) => {
                    [t.scenes[sceneIndex - 1], t.scenes[sceneIndex]] = [
                      t.scenes[sceneIndex],
                      t.scenes[sceneIndex - 1],
                    ];
                  })
                }
              >
                <ArrowUp size={15} />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                disabled={sceneIndex === timeline.scenes.length - 1}
                aria-label="Move scene later"
                onClick={() =>
                  change((t) => {
                    [t.scenes[sceneIndex + 1], t.scenes[sceneIndex]] = [
                      t.scenes[sceneIndex],
                      t.scenes[sceneIndex + 1],
                    ];
                  })
                }
              >
                <ArrowDown size={15} />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                aria-label="Duplicate scene"
                onClick={() =>
                  change((t) => {
                    t.scenes.splice(sceneIndex + 1, 0, {
                      ...structuredClone(scene),
                      id: crypto.randomUUID(),
                      captions: scene.captions.map((c) => ({
                        ...c,
                        id: crypto.randomUUID(),
                      })),
                    });
                  })
                }
              >
                <Copy size={15} />
              </Button>
              <Button
                size="icon"
                variant="danger"
                disabled={timeline.scenes.length === 1}
                aria-label="Delete scene"
                onClick={() =>
                  change((t) => {
                    t.scenes.splice(sceneIndex, 1);
                  })
                }
              >
                <Trash2 size={15} />
              </Button>
            </div>
          </div>
        </aside>
      </div>
      <section className="editor-timeline">
        <div className="timeline-heading">
          <span>
            <Film size={14} />
            Scene timeline
          </span>
          <small>
            {time(duration(timeline) / 30)} · {timeline.scenes.length} scenes ·
            30 FPS
          </small>
        </div>
        <div className="timeline-track">
          {timeline.scenes.map((s, i) => (
            <button
              key={s.id}
              className={scene.id === s.id ? "selected" : ""}
              style={{
                flexGrow: s.durationFrames,
                backgroundColor: s.background,
              }}
              onClick={() => select(s.id)}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              <strong>{s.caption.slice(0, 35) || "Scene"}</strong>
              <small>{time(s.durationFrames / 30)}</small>
            </button>
          ))}
        </div>
        <div className="audio-track">
          <Music2 size={14} />
          {timeline.musicAssetId
            ? data?.assets.find((a) => a.id === timeline.musicAssetId)?.name
            : "No background music · choose one in Style"}
        </div>
      </section>
      {!foundation && (
        <form
          className="quick-edit"
          onSubmit={async (e) => {
            e.preventDefault();
            await act(async () => {
              if (!(await save()))
                throw new Error("Save your project before requesting an edit.");
              const result = await api<{
                timeline: Timeline;
                operations: unknown[];
                revision: number;
              }>(`projects/${initial.id}/edit-plan`, "POST", { command });
              setProposal(result);
            });
          }}
        >
          <Sparkles size={17} />
          <input
            aria-label="Edit instruction"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            maxLength={1000}
            placeholder={
              data?.capabilities.ai
                ? "Describe a caption, duration, or music edit…"
                : "Quick edit: ‘captions at bottom’ or ‘music at 10%’"
            }
          />
          <Button
            size="sm"
            variant="secondary"
            type="submit"
            disabled={busy || !command.trim()}
          >
            Propose edit <ChevronRight size={15} />
          </Button>
        </form>
      )}
      <Dialog
        title="Review the proposed edit"
        description="Apply these validated timeline changes? You can undo them."
        open={Boolean(proposal)}
        onOpenChange={(o) => {
          if (!o) setProposal(null);
        }}
      >
        <pre className="proposal-code">
          {JSON.stringify(proposal?.operations, null, 2)}
        </pre>
        <Button
          onClick={() => {
            if (!proposal) return;
            if (
              revision.current !== proposal.revision ||
              JSON.stringify({
                title: titleRef.current,
                timeline: store.getState().timeline,
              }) !== savedRef.current
            ) {
              notify(
                "Your project changed while this proposal was open. Request a fresh edit.",
                true,
              );
              setProposal(null);
              return;
            }
            change((t) => Object.assign(t, proposal.timeline));
            setProposal(null);
            setCommand("");
          }}
        >
          Apply edit
        </Button>
      </Dialog>
      <Dialog
        title="Your rendered video"
        description={
          currentRender
            ? "This MP4 matches your current saved revision."
            : "This render belongs to an earlier revision. Render your edits to create a current export."
        }
        open={preview}
        onOpenChange={setPreview}
      >
        {current.outputAssetId && (
          <video
            className="review-video"
            src={`/api/assets/${current.outputAssetId}`}
            controls
          />
        )}
        <div className="review-actions">
          <Status value={current.status} />
          {currentRender && (
            <>
              <Button asChild size="sm">
                <a href={`/api/projects/${initial.id}/download`}>
                  <ArrowDownToLine size={15} />
                  Download MP4
                </a>
              </Button>
              {current.status === "review" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    act(
                      () =>
                        api(`projects/${initial.id}/review`, "POST", {
                          action: "approve",
                        }),
                      "Video approved.",
                    )
                  }
                >
                  Approve
                </Button>
              ) : (
                <ScheduleButton project={current} />
              )}
            </>
          )}
        </div>
      </Dialog>
    </>
  );
}
