"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Clock3,
  Film,
  FolderOpen,
  Layers3,
  ListChecks,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import { duration, modes, plans, type Project } from "@/lib/model";
import { api, useAction, useApp } from "./app-provider";
import { AutomationPage } from "./automation";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { CreateFlow, modeIcons } from "./create-flow";
import {
  CreateButton,
  Empty,
  PageHeading,
  ProjectCards,
  Status,
  date,
  time,
} from "./common";
import { AssetLibrary, CharacterStudio, SettingsPage } from "./workspace-pages";

export function StudioPage({ section }: { section: string }) {
  if (section === "automation") return <AutomationPage />;
  if (section === "create")
    return (
      <Suspense fallback={<p>Opening creation tools…</p>}>
        <CreateFlow />
      </Suspense>
    );
  if (section === "overview") return <Overview />;
  if (section === "projects") return <Projects />;
  if (section === "pipelines") return <Pipelines />;
  if (section === "review") return <Review />;
  if (section === "calendar") return <Calendar />;
  if (section === "analytics") return <Analytics />;
  if (section === "assets") return <AssetLibrary />;
  if (section === "characters") return <CharacterStudio />;
  if (section === "settings") return <SettingsPage />;
  if (section === "billing") return <Billing />;
  return <Help />;
}
function Overview() {
  const { data } = useApp();
  if (!data) return null;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const stats = [
    {
      label: "Videos this month",
      value: data.projects.filter(
        (p) => p.outputAssetId && p.createdAt >= monthStart.getTime(),
      ).length,
      icon: Film,
      detail: "Finished renders",
    },
    {
      label: "Credits available",
      value: data.me.credits,
      icon: Sparkles,
      detail:
        data.me.plan === "trial"
          ? "Your starter balance"
          : "Ready when you are",
    },
    {
      label: "Active autopilots",
      value: data.pipelines.filter((p) => p.active).length,
      icon: Workflow,
      detail: "Creating on your schedule",
    },
    {
      label: "Awaiting review",
      value: data.projects.filter((p) => p.status === "review").length,
      icon: ListChecks,
      detail: "Ready for your eyes",
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="LET’S MAKE SOMETHING GOOD"
        title={`Your studio, ${data.me.name.split(" ")[0]}.`}
        description="A little inspiration. A clear plan. Your next great video."
        action={<CreateButton />}
      />
      <div className="stats-grid">
        {stats.map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="row-between">
              <span>{s.label}</span>
              <s.icon size={17} />
            </div>
            <strong>{s.value}</strong>
            <small>{s.detail}</small>
          </div>
        ))}
      </div>
      <section className="overview-banner">
        <div>
          <span className="eyebrow">YOUR IDEAS DON’T NEED TO WAIT</span>
          <h2>
            From “what if”
            <br />
            to worth watching.
          </h2>
          <p>
            Give your next idea a little screen time.
            <br className="desktop-only" /> We’ll help you put the pieces
            together.
          </p>
          <Button asChild>
            <Link href="/create">
              Create a video <ArrowRight size={16} />
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/pipelines?new=1">
              <Workflow size={16} />
              Set up an autopilot
            </Link>
          </Button>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="film-strip">
            <div>
              <span>01</span>
              <Layers3 />
              <strong>THE IDEA</strong>
            </div>
            <div>
              <span>02</span>
              <Clapperboard />
              <strong>THE STORY</strong>
            </div>
            <div>
              <span>03</span>
              <Play />
              <strong>THE MOMENT</strong>
            </div>
          </div>
          <span className="art-caption">A little spark goes a long way.</span>
        </div>
      </section>
      <section className="quick-start">
        <div className="section-label">
          <h2>Make something yours</h2>
          <Link href="/create">
            Explore all formats <ArrowRight size={14} />
          </Link>
        </div>
        <div className="quick-grid">
          {modes
            .filter((m) =>
              ["prompt", "script", "characters", "clips"].includes(m.id),
            )
            .map((m) => {
              const Icon = modeIcons[m.icon];
              return (
                <Link
                  href={`/create?mode=${m.id}`}
                  key={m.id}
                  className="quick-card"
                >
                  <span className={`mode-icon mode-${m.id}`}>
                    <Icon size={20} />
                  </span>
                  <div>
                    <h3>{m.name}</h3>
                    <p>
                      {m.id === "prompt"
                        ? "Start with a spark"
                        : m.id === "script"
                          ? "Bring your words to life"
                          : m.id === "characters"
                            ? "Create your own cast"
                            : "Find your best moments"}
                    </p>
                  </div>
                  <ArrowUpRight size={16} />
                </Link>
              );
            })}
        </div>
      </section>
      <div className="overview-lower">
        <section className="panel">
          <div className="panel-heading">
            <h2>Recent projects</h2>
            <Link className="text-link" href="/projects">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {data.projects.length ? (
            <div className="recent-project-list">
              {data.projects.slice(0, 4).map((p) => (
                <Link href={`/editor/${p.id}`} key={p.id}>
                  <span
                    className="mini-thumbnail"
                    style={{ backgroundColor: p.timeline.scenes[0].background }}
                  >
                    <Clapperboard size={20} />
                  </span>
                  <div>
                    <strong>{p.title}</strong>
                    <small>
                      {time(duration(p.timeline) / 30)} · {p.timeline.aspect}
                    </small>
                  </div>
                  <Status value={p.status} />
                  <ChevronRight size={15} />
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              title="Your first story is waiting"
              description="Create a video and you’ll find it right here."
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href="/create">
                    <Plus size={15} />
                    Create your first video
                  </Link>
                </Button>
              }
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Studio activity</h2>
            <span className="badge">Live</span>
          </div>
          {data.jobs.length ? (
            <div className="activity-list">
              {data.jobs.slice(0, 5).map((j) => (
                <div key={j.id}>
                  <span className={`activity-dot ${j.state}`} />
                  <div>
                    <strong>{j.stage}</strong>
                    <small>{date(j.createdAt)}</small>
                    {j.progress != null && j.state === "running" && (
                      <progress max={1} value={j.progress} />
                    )}
                  </div>
                  {j.projectId && (
                    <Link
                      href={`/editor/${j.projectId}`}
                      aria-label="Open job project"
                    >
                      <ChevronRight size={15} />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon={<Clock3 size={23} />}
              title="A fresh start"
              description="Generation jobs, renders, and autopilot updates appear here as they happen."
            />
          )}
        </section>
      </div>
      <div className="connection-note">
        <span>
          <span className="subtle-dot" />
          {data.projects.filter((p) => p.status === "scheduled").length} manual
          reminders · Manage agent publishing in Automation
        </span>
        <Link href="/settings">
          Manage workspace <ArrowRight size={14} />
        </Link>
      </div>
    </>
  );
}
function Projects() {
  const { data } = useApp(),
    { act, busy } = useAction(),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all");
  if (!data) return null;
  const projects = data.projects.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" || p.status === filter),
  );
  return (
    <>
      <PageHeading
        eyebrow="YOUR WORK, ALL TOGETHER"
        title="Projects"
        description="The ideas in progress. The stories ready to go."
        action={<CreateButton />}
      />
      <div className="filter-toolbar">
        <div className="filter-tabs" role="group" aria-label="Filter projects">
          {["all", "draft", "review", "approved"].map((f) => (
            <button
              key={f}
              aria-pressed={filter === f}
              className={filter === f ? "selected" : ""}
              onClick={() => setFilter(f)}
            >
              {f === "all"
                ? "All projects"
                : f === "review"
                  ? "Ready for review"
                  : f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="Search projects"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
          />
        </label>
      </div>
      {projects.length ? (
        <ProjectCards projects={projects} />
      ) : (
        <div className="panel">
          <Empty
            icon={<FolderOpen size={28} />}
            title={
              search || filter !== "all"
                ? "No matching projects"
                : "Every story starts somewhere"
            }
            description={
              search
                ? "Try another project name."
                : "Your projects will live here. Start with your own script or try an AI-assisted format."
            }
            action={<CreateButton />}
          />
        </div>
      )}
      <section className="panel jobs-panel">
        <div className="panel-heading">
          <h2>Job history</h2>
          <span className="muted">{data.jobs.length} jobs</span>
        </div>
        {!data.capabilities.worker && (
          <p className="notice">
            The render worker is offline. Start it with{" "}
            <code>npm run worker</code>. Queued jobs are saved.
          </p>
        )}
        {data.jobs.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Progress</th>
                  <th>Credits</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.jobs.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <strong>
                        {j.kind === "render" ? "Video render" : "AI creation"}
                      </strong>
                      <small className="job-id">{j.id.slice(0, 8)}</small>
                    </td>
                    <td>
                      <Status value={j.state} />
                      <small className="job-stage">
                        {j.stage}
                        {j.progress != null && j.state === "running"
                          ? ` · ${Math.round(j.progress * 100)}%`
                          : ""}
                      </small>
                      {j.error && (
                        <details className="job-error">
                          <summary>Failure details</summary>
                          <p>{j.error}</p>
                        </details>
                      )}
                    </td>
                    <td>
                      {j.cost}
                      {j.state === "failed" && (
                        <small className="job-stage">Refunded</small>
                      )}
                    </td>
                    <td>{date(j.createdAt)}</td>
                    <td>
                      {j.state === "failed" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() =>
                            act(
                              () => api(`jobs/${j.id}/retry`, "POST"),
                              "Retry queued.",
                            )
                          }
                        >
                          <RefreshCw size={14} />
                          Retry
                        </Button>
                      ) : j.projectId ? (
                        <Link
                          className="text-link"
                          href={`/editor/${j.projectId}`}
                        >
                          Open <ArrowRight size={14} />
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={<Clock3 />}
            title="No jobs yet"
            description="Create or render a video to start your production history."
          />
        )}
      </section>
    </>
  );
}
function Pipelines() {
  const { data } = useApp(),
    { act, busy } = useAction(),
    [creating, setCreating] = useState(false);
  if (!data) return null;
  if (creating)
    return (
      <Suspense>
        <div className="back-link">
          <button onClick={() => setCreating(false)}>
            <ChevronLeft size={15} />
            All autopilots
          </button>
        </div>
        <CreateFlow autopilot />
      </Suspense>
    );
  return (
    <>
      <PageHeading
        eyebrow="FIND YOUR CREATIVE RHYTHM"
        title="Pipelines"
        description="Set the direction once. Let a steady stream of ideas follow."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} />
            New autopilot
          </Button>
        }
      />
      <div className="notice">
        <Workflow size={17} />
        Every run ends in your review queue. Publishing requires a separate
        authorized integration.
      </div>
      {data.pipelines.length ? (
        <div className="pipeline-grid">
          {data.pipelines.map((p) => (
            <article className="panel pipeline-card" key={p.id}>
              <div className="row-between">
                <span className="mode-icon">
                  <Workflow size={22} />
                </span>
                <span
                  className={`status ${p.active ? "status-approved" : "status-draft"}`}
                >
                  <i />
                  {p.active ? "Active" : "Paused"}
                </span>
              </div>
              <h2>{p.name}</h2>
              <p>
                {modes.find((m) => m.id === p.config.mode)?.name} · Every{" "}
                {p.intervalHours === 24
                  ? "day"
                  : `${p.intervalHours / 24} days`}
              </p>
              <dl>
                <div>
                  <dt>Runs</dt>
                  <dd>
                    {p.runs} / {p.maxRuns}
                  </dd>
                </div>
                <div>
                  <dt>Budget committed</dt>
                  <dd>
                    {p.spent} / {p.budget} credits
                  </dd>
                </div>
                <div>
                  <dt>Next run</dt>
                  <dd>{p.active ? date(p.nextRun) : "Paused"}</dd>
                </div>
              </dl>
              {data.pipelineErrors.find((e) => e.id === p.id) && (
                <p className="inline-error">
                  {data.pipelineErrors.find((e) => e.id === p.id)?.error}
                </p>
              )}
              <div className="pipeline-actions">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    act(
                      () =>
                        api(`pipelines/${p.id}`, "PATCH", {
                          active: !p.active,
                        }),
                      p.active ? "Autopilot paused." : "Autopilot activated.",
                    )
                  }
                >
                  {p.active ? <Pause size={14} /> : <Play size={14} />}
                  {p.active ? "Pause" : "Activate"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    act(
                      () => api(`pipelines/${p.id}/run`, "POST"),
                      "Run queued.",
                    )
                  }
                >
                  Run now
                </Button>
                <PipelineEdit pipeline={p} />
              </div>
              <details>
                <summary>History & options</summary>
                <p className="muted">
                  {data.jobs.filter((j) => j.pipelineId === p.id).length}{" "}
                  recorded jobs
                </p>
                {data.jobs
                  .filter((j) => j.pipelineId === p.id)
                  .map((j) => (
                    <p key={j.id}>
                      <Status value={j.state} /> {date(j.createdAt)} {j.error}
                    </p>
                  ))}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    act(
                      () => api(`pipelines/${p.id}/duplicate`, "POST"),
                      "Paused copy created.",
                    )
                  }
                >
                  Duplicate
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy}
                  onClick={() =>
                    act(
                      () => api(`pipelines/${p.id}`, "DELETE"),
                      "Autopilot deleted.",
                    )
                  }
                >
                  Delete
                </Button>
              </details>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty
            icon={<Workflow size={30} />}
            title="Good content loves a routine"
            description="Save a topic, style, schedule, and spending limit. Every finished video comes back to you for approval."
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus size={15} />
                Create your first autopilot
              </Button>
            }
          />
        </div>
      )}
    </>
  );
}
function PipelineEdit({
  pipeline: p,
}: {
  pipeline: NonNullable<ReturnType<typeof useApp>["data"]>["pipelines"][number];
}) {
  const [open, setOpen] = useState(false),
    { act, busy } = useAction();
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Edit limits
      </Button>
      <Dialog title="Edit autopilot limits" open={open} onOpenChange={setOpen}>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const result = await act(
              () =>
                api(`pipelines/${p.id}`, "PATCH", {
                  name: f.get("name"),
                  maxRuns: Number(f.get("maxRuns")),
                  budget: Number(f.get("budget")),
                }),
              "Autopilot updated.",
            );
            if (result) setOpen(false);
          }}
        >
          <label>
            Name
            <input name="name" defaultValue={p.name} required maxLength={100} />
          </label>
          <label>
            Maximum runs
            <input
              name="maxRuns"
              type="number"
              defaultValue={p.maxRuns}
              min={p.runs || 1}
              max={120}
              required
            />
          </label>
          <label>
            Total credit budget
            <input
              name="budget"
              type="number"
              defaultValue={p.budget}
              min={p.spent || 1}
              max={1200}
              required
            />
          </label>
          <Button disabled={busy}>Save changes</Button>
        </form>
      </Dialog>
    </>
  );
}
function Review() {
  const { data } = useApp(),
    { act, busy } = useAction(),
    [preview, setPreview] = useState<Project | null>(null);
  if (!data) return null;
  const pending = data.projects.filter((p) =>
    ["review", "approved", "scheduled"].includes(p.status),
  );
  return (
    <>
      <PageHeading
        eyebrow="THE FINAL CREATIVE CALL IS YOURS"
        title="Review queue"
        description="Watch it through. Make it yours. Give it the green light."
      />
      <div className="review-list">
        {pending.length ? (
          pending.map((p) => (
            <article className="panel review-card" key={p.id}>
              <div className="review-preview">
                <button
                  aria-label={`Preview ${p.title}`}
                  onClick={() => setPreview(p)}
                >
                  <Play size={24} />
                </button>
                <span>{time(duration(p.timeline) / 30)}</span>
              </div>
              <div className="review-copy">
                <div className="row-between">
                  <h2>{p.title}</h2>
                  <Status value={p.status} />
                </div>
                <p>
                  {p.description ||
                    "Your original video, ready for a final look."}
                </p>
                <small>
                  Rendered revision {p.renderedRevision} · {date(p.updatedAt)}
                </small>
                <div className="review-actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPreview(p)}
                  >
                    <Play size={14} />
                    Preview
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/editor/${p.id}`}>Edit</Link>
                  </Button>
                  {p.status === "review" && (
                    <>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          act(
                            () =>
                              api(`projects/${p.id}/review`, "POST", {
                                action: "approve",
                              }),
                            "Video approved.",
                          )
                        }
                      >
                        <Check size={14} />
                        Approve
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          act(
                            () =>
                              api(`projects/${p.id}/review`, "POST", {
                                action: "reject",
                              }),
                            "Moved back to drafts.",
                          )
                        }
                      >
                        <X size={14} />
                        Return to draft
                      </Button>
                    </>
                  )}
                  {p.status !== "review" && <ScheduleButton project={p} />}
                  <Button asChild size="sm" variant="ghost">
                    <a href={`/api/projects/${p.id}/download`}>
                      <ArrowDownToLine size={14} />
                      MP4
                    </a>
                  </Button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="panel">
            <Empty
              icon={<ListChecks size={30} />}
              title="Nothing waiting in the wings"
              description="Finished renders appear here. You decide what’s ready to share."
              action={<CreateButton />}
            />
          </div>
        )}
      </div>
      <Dialog
        title={preview?.title || "Video preview"}
        open={Boolean(preview)}
        onOpenChange={(o) => {
          if (!o) setPreview(null);
        }}
        description="This is your actual rendered MP4."
      >
        {preview?.outputAssetId && (
          <video
            className="review-video"
            src={`/api/assets/${preview.outputAssetId}`}
            controls
            autoPlay
            playsInline
          />
        )}
      </Dialog>
    </>
  );
}
export function ScheduleButton({ project: p }: { project: Project }) {
  const [open, setOpen] = useState(false),
    { act, busy } = useAction();
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <CalendarDays size={14} />
        Set reminder
      </Button>
      <Dialog
        title="Plan your publishing time"
        description="This saves a manual calendar reminder. Manage authorized Instagram and TikTok publishing in Automation."
        open={open}
        onOpenChange={setOpen}
      >
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const result = await act(
              () =>
                api(`projects/${p.id}/review`, "POST", {
                  action: "schedule",
                  scheduledAt: new Date(String(f.get("time"))).getTime(),
                }),
              "Publishing reminder saved.",
            );
            if (result) setOpen(false);
          }}
        >
          <label>
            Local date and time
            <input type="datetime-local" name="time" required />
          </label>
          <small className="muted">
            Your browser timezone:{" "}
            {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </small>
          <Button disabled={busy}>Save reminder</Button>
        </form>
      </Dialog>
    </>
  );
}
function Calendar() {
  const { data } = useApp(),
    [offset, setOffset] = useState(0);
  if (!data) return null;
  const today = new Date(),
    first = new Date(today.getFullYear(), today.getMonth() + offset, 1),
    last = new Date(first.getFullYear(), first.getMonth() + 1, 0),
    cells = Array.from(
      { length: first.getDay() + last.getDate() },
      (_, i) => i - first.getDay() + 1,
    ),
    scheduled = data.projects.filter((p) => p.scheduledAt);
  return (
    <>
      <PageHeading
        eyebrow="MAKE ROOM FOR YOUR NEXT STORY"
        title="Content calendar"
        description="Your publishing reminders, in your local timezone."
      />
      <div className="calendar-toolbar">
        <h2>
          {first.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <div>
          <Button size="sm" variant="secondary" onClick={() => setOffset(0)}>
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous month"
            onClick={() => setOffset(offset - 1)}
          >
            <ChevronLeft size={18} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next month"
            onClick={() => setOffset(offset + 1)}
          >
            <ChevronRight size={18} />
          </Button>
        </div>
      </div>
      <div className="calendar-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="calendar-day-name">
            {day}
          </div>
        ))}
        {cells.map((day, i) => (
          <div
            key={i}
            className={`calendar-cell ${day === today.getDate() && offset === 0 ? "calendar-today" : ""}`}
          >
            <span>{day > 0 ? day : ""}</span>
            {day > 0 &&
              scheduled
                .filter((p) => {
                  const d = new Date(p.scheduledAt!);
                  return (
                    d.getFullYear() === first.getFullYear() &&
                    d.getMonth() === first.getMonth() &&
                    d.getDate() === day
                  );
                })
                .map((p) => (
                  <Link key={p.id} href={`/editor/${p.id}`}>
                    {new Date(p.scheduledAt!).toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}{" "}
                    · {p.title}
                  </Link>
                ))}
          </div>
        ))}
      </div>
      <p className="notice">
        Calendar entries are manual publishing reminders. Nothing is uploaded or
        published automatically.
      </p>
    </>
  );
}
function Analytics() {
  const { data } = useApp();
  if (!data) return null;
  const total = data.jobs.filter((j) => j.state === "completed").length,
    failed = data.jobs.filter((j) => j.state === "failed").length;
  return (
    <>
      <PageHeading
        eyebrow="UNDERSTAND YOUR CREATIVE OUTPUT"
        title="Studio analytics"
        description="Real production activity from your workspace."
      />
      <div className="stats-grid">
        {[
          { label: "Completed jobs", value: total },
          { label: "Failed jobs", value: failed },
          {
            label: "Approved videos",
            value: data.projects.filter((p) =>
              ["approved", "scheduled"].includes(p.status),
            ).length,
          },
          {
            label: "Credits used",
            value: data.ledger
              .filter(
                (l) => l.operation === "reserve" || l.operation === "refund",
              )
              .reduce((a, l) => a - l.amount, 0),
          },
        ].map((s) => (
          <div className="stat-card" key={s.label}>
            <span>{s.label}</span>
            <strong>{s.value}</strong>
          </div>
        ))}
      </div>
      <div className="overview-lower">
        <section className="panel">
          <div className="panel-heading">
            <h2>Processing usage</h2>
            <span className="muted">Recorded by the worker</span>
          </div>
          {data.usage.length ? (
            <table>
              <thead>
                <tr>
                  <th>Operation</th>
                  <th>Measured units</th>
                </tr>
              </thead>
              <tbody>
                {data.usage.map((u) => (
                  <tr key={u.category}>
                    <td>{u.category.replaceAll("_", " ")}</td>
                    <td>{Number(u.units.toFixed(2))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty
              icon={<Workflow />}
              title="Your activity will tell the story"
              description="Render and generate videos to see your processing usage here."
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Social performance</h2>
          </div>
          <Empty
            icon={<ArrowUpRight />}
            title="No social analytics connected"
            description="Platform views and engagement require official account integrations. This release reports production activity only."
          />
        </section>
      </div>
    </>
  );
}
function Billing() {
  const { data } = useApp(),
    { act, busy } = useAction();
  if (!data) return null;
  async function open(path: string, body?: object) {
    await act(async () => {
      const r = await api<{ url: string }>(path, "POST", body);
      window.location.assign(r.url);
    });
  }
  return (
    <>
      <PageHeading
        eyebrow="KEEP YOUR IDEAS MOVING"
        title="Billing & credits"
        description="A clear view of your plan, balance, and creative budget."
        action={
          <Button
            disabled={
              busy || !data.capabilities.billing || data.me.plan === "trial"
            }
            variant="secondary"
            onClick={() => open("billing/portal")}
          >
            Manage subscription <ArrowUpRight size={15} />
          </Button>
        }
      />
      <div className="billing-balance panel">
        <div>
          <span className="eyebrow">AVAILABLE TO CREATE</span>
          <strong>
            {data.me.credits}
            <small>credits</small>
          </strong>
          <p>
            {data.me.plan === "trial"
              ? "One-time trial balance"
              : "Your paid credit balance"}{" "}
            · {data.me.subscriptionStatus.replaceAll("_", " ")}
          </p>
        </div>
        <Sparkles size={38} />
      </div>
      {!data.capabilities.billing && (
        <p className="notice">
          Paid billing is not configured on this server. Trial credits are real
          local allowances; no subscription is active.
        </p>
      )}
      <div className="pricing-grid">
        {Object.entries(plans).map(([key, p]) => (
          <article
            className={`panel price-card ${key === "creator" ? "featured" : ""}`}
            key={key}
          >
            {key === "creator" && (
              <span className="eyebrow">ROOM TO BUILD A RHYTHM</span>
            )}
            <h2>{p.name}</h2>
            <div className="price">
              ${p.price}
              <small>/ month</small>
            </div>
            <p>{p.credits} monthly credits</p>
            <ul>
              <li>
                <Check size={14} />
                {p.videos} standard video allowance
              </li>
              <li>
                <Check size={14} />
                Scene editor & MP4 exports
              </li>
              <li>
                <Check size={14} />
                Reusable characters & presets
              </li>
              <li>
                <Check size={14} />
                Review-first autopilots
              </li>
            </ul>
            <Button
              variant={key === "creator" ? "default" : "secondary"}
              disabled={!data.capabilities.billing || busy}
              onClick={() => open("billing/checkout", { plan: key })}
            >
              Choose {p.name}
              <ArrowRight size={14} />
            </Button>
          </article>
        ))}
      </div>
      <p className="muted">
        One standard video: up to 60 seconds, AI script, narration, and up to
        six generated images, for 10 credits. Text-only and manual videos use
        fewer credits. Longer videos cost more. Credits are reserved when queued
        and returned if the job fails. Paid monthly credits accumulate; plan
        changes do not grant a second allowance mid-cycle.
      </p>
      <section className="panel jobs-panel">
        <div className="panel-heading">
          <h2>Credit history</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Operation</th>
                <th>Details</th>
                <th>Credits</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {data.ledger.map((l, i) => (
                <tr key={i}>
                  <td>{l.operation}</td>
                  <td>{l.detail}</td>
                  <td className={l.amount > 0 ? "success-text" : ""}>
                    {l.amount > 0 ? "+" : ""}
                    {l.amount}
                  </td>
                  <td>{date(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
function Help() {
  return (
    <>
      <PageHeading
        eyebrow="A LITTLE GUIDANCE GOES A LONG WAY"
        title="Help & resources"
        description="Get from your first idea to your first finished video."
      />
      <div className="help-grid">
        <article className="panel">
          <span className="mode-icon">
            <Clapperboard />
          </span>
          <h2>Your first video</h2>
          <ol>
            <li>Choose Script to video and paste your words.</li>
            <li>Use a blank line to create a new scene.</li>
            <li>Open the editor. Add your media and adjust captions.</li>
            <li>Render the current version and watch the finished MP4.</li>
            <li>Approve it, then download or set a publishing reminder.</li>
          </ol>
          <Button asChild variant="secondary">
            <Link href="/create?mode=script">
              Start with a script <ArrowRight size={15} />
            </Link>
          </Button>
        </article>
        <article className="panel">
          <span className="mode-icon">
            <Sparkles />
          </span>
          <h2>Enable AI creation</h2>
          <p>
            AI generation uses a server-side OpenAI account. The server owner
            adds <code>OPENAI_API_KEY</code> to <code>.env</code>, then restarts
            the app and worker.
          </p>
          <p>
            Choose a synthetic voice and optional original illustrations.
            Generated facts, product claims, and character consistency always
            need your review.
          </p>
          <p>
            Clip extraction uses timestamped transcription and duration-based
            selection. Speaker tracking and highlight analysis are planned.
          </p>
        </article>
        <article className="panel">
          <span className="mode-icon">
            <Workflow />
          </span>
          <h2>Keep the worker running</h2>
          <p>
            The website saves your requests; a separate worker processes them.
          </p>
          <code className="code-block">npm run dev:all</code>
          <p>
            Or run <code>npm run dev</code> and <code>npm run worker</code> in
            separate terminals. Interrupted jobs fail safely and return their
            reserved credits.
          </p>
          <p>Retry failed jobs in Projects after resolving their error.</p>
        </article>
        <article className="panel">
          <span className="mode-icon">
            <ListChecks />
          </span>
          <h2>Your content & privacy</h2>
          <p>
            Use media and characters you own or have permission to use. License
            information stays with each uploaded asset.
          </p>
          <p>
            Your workspace media is private. AI requests send the selected
            content to the configured provider. Social publishing, team
            invitations, account recovery, and account deletion tooling still
            require implementation before public launch.
          </p>
          <p>
            Calendar entries are reminders. Download and publish the video
            yourself.
          </p>
        </article>
      </div>
    </>
  );
}
