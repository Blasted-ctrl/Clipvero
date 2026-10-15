"use client";
import Image from "next/image";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  FileAudio,
  Film,
  ImageIcon,
  Palette,
  Plus,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { voices } from "@/lib/model";
import { api, useAction, useApp } from "./app-provider";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Empty, PageHeading, date } from "./common";
export function AssetLibrary() {
  const { data } = useApp(),
    { act, busy } = useAction(),
    [open, setOpen] = useState(false),
    [filter, setFilter] = useState("all");
  if (!data) return null;
  const assets = data.assets.filter(
    (a) => filter === "all" || a.kind === filter,
  );
  return (
    <>
      <PageHeading
        eyebrow="THE BUILDING BLOCKS OF YOUR STORIES"
        title="Asset library"
        description="Your footage, images, voices, and their creative origins."
        action={
          <Button onClick={() => setOpen(true)}>
            <Upload size={16} />
            Upload media
          </Button>
        }
      />
      <div className="filter-tabs asset-tabs" aria-label="Filter assets">
        {["all", "video", "image", "audio"].map((f) => (
          <button
            key={f}
            className={filter === f ? "selected" : ""}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All assets" : f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      {assets.length ? (
        <div className="asset-grid">
          {assets.map((a) => (
            <article key={a.id} className="panel asset-card">
              <div className="asset-preview">
                {a.kind === "image" ? (
                  <a
                    href={`/api/assets/${a.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Image
                      unoptimized
                      width={720}
                      height={1280}
                      src={`/api/assets/${a.id}`}
                      alt={a.name}
                    />
                  </a>
                ) : a.kind === "video" ? (
                  <video
                    src={`/api/assets/${a.id}`}
                    controls
                    preload="metadata"
                  />
                ) : (
                  <>
                    <FileAudio size={34} />
                    <audio
                      src={`/api/assets/${a.id}`}
                      controls
                      preload="metadata"
                    />
                  </>
                )}
              </div>
              <h3>{a.name}</h3>
              <small>
                {a.kind} · {(a.bytes / 1024 / 1024).toFixed(1)} MB ·{" "}
                {date(a.createdAt)}
              </small>
              <details>
                <summary>Origin & license</summary>
                <p>{a.provenance}</p>
              </details>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty
            icon={<ImageIcon size={28} />}
            title="Every story has its building blocks"
            description="Upload original images, licensed footage, background music, or your own narration. We’ll keep their source information with them."
            action={
              <Button onClick={() => setOpen(true)}>
                <Upload size={15} />
                Upload your first asset
              </Button>
            }
          />
        </div>
      )}
      <Dialog
        title="Add to your library"
        description="PNG, JPEG, WebP, MP4, WebM, MOV, MP3, M4A, or WAV. Up to 100 MB per file."
        open={open}
        onOpenChange={setOpen}
      >
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            form.set("rightsConfirmed", "true");
            const result = await act(
              () => api("assets", "POST", form),
              "Media uploaded and validated.",
            );
            if (result) setOpen(false);
          }}
        >
          <label>
            Media file
            <input
              type="file"
              name="file"
              required
              accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/mp4"
            />
          </label>
          <label>
            Source & license
            <textarea
              name="provenance"
              rows={3}
              required
              maxLength={2000}
              placeholder="For example: recorded by me, or provider name and license details."
            />
          </label>
          <label className="check-row">
            <input type="checkbox" required />
            <span>I own this content or have a license to use it.</span>
          </label>
          <Button disabled={busy}>
            <Upload size={15} />
            {busy ? "Validating upload…" : "Upload media"}
          </Button>
        </form>
      </Dialog>
    </>
  );
}
export function CharacterStudio() {
  const { data } = useApp(),
    { act, busy } = useAction(),
    [open, setOpen] = useState(false);
  if (!data) return null;
  return (
    <>
      <PageHeading
        eyebrow="ORIGINAL CHARACTERS. UNLIMITED STORIES."
        title="Character Studio"
        description="Build a cast that’s unmistakably yours."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} />
            New character
          </Button>
        }
      />
      <p className="notice">
        Approved references help guide image generation. Visual consistency
        needs human review. This release stores per-character voice preferences;
        multi-voice dialogue and animation are not implemented yet.
      </p>
      {data.characters.length ? (
        <div className="character-grid">
          {data.characters.map((c) => (
            <article className="panel character-card" key={c.id}>
              <div className="character-portrait">
                {c.referenceAssetId ? (
                  <Image
                    unoptimized
                    width={720}
                    height={1280}
                    src={`/api/assets/${c.referenceAssetId}`}
                    alt={`Approved visual reference for ${c.name}`}
                  />
                ) : (
                  <Users size={42} />
                )}
              </div>
              <div className="character-copy">
                <h2>{c.name}</h2>
                <p>{c.description}</p>
                <dl>
                  <div>
                    <dt>Personality</dt>
                    <dd>{c.personality || "Open to interpretation"}</dd>
                  </div>
                  <div>
                    <dt>Voice preference</dt>
                    <dd>{c.voice}</dd>
                  </div>
                </dl>
                <details>
                  <summary>Appearance & continuity</summary>
                  <p>{c.appearance}</p>
                  <p>{c.speechStyle}</p>
                  <p>{c.continuity}</p>
                </details>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    act(
                      () => api(`characters/${c.id}`, "DELETE"),
                      "Character removed. Existing videos are retained.",
                    )
                  }
                >
                  <Trash2 size={14} />
                  Remove
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty
            icon={<Users size={30} />}
            title="Meet your next main character"
            description="Save an original character’s personality, appearance, voice, and approved visual reference. Bring them back for the next story."
            action={
              <Button onClick={() => setOpen(true)}>
                <Plus size={15} />
                Create a character
              </Button>
            }
          />
        </div>
      )}
      <Dialog
        title="Create an original character"
        description="Define a fictional character you own. Do not impersonate real people or use protected characters."
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
                api("characters", "POST", {
                  ...Object.fromEntries(f),
                  referenceAssetId: f.get("referenceAssetId") || null,
                  rightsConfirmed: true,
                }),
              "Character saved.",
            );
            if (result) setOpen(false);
          }}
        >
          <label>
            Name
            <input
              name="name"
              required
              maxLength={80}
              placeholder="Their name"
            />
          </label>
          <label>
            Description
            <textarea name="description" maxLength={2000} rows={2} />
          </label>
          <div className="form-grid">
            <label>
              Personality
              <input
                name="personality"
                maxLength={1000}
                placeholder="Curious, dry humor, quietly brave"
              />
            </label>
            <label>
              Voice preference
              <select name="voice">
                {voices.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Visual appearance
            <textarea
              name="appearance"
              rows={2}
              maxLength={2000}
              placeholder="Distinctive features, outfit, colors, and proportions"
            />
          </label>
          <label>
            Speech style
            <input name="speechStyle" maxLength={1000} />
          </label>
          <label>
            Approved reference
            <select name="referenceAssetId">
              <option value="">No reference yet</option>
              {data.assets
                .filter((a) => a.kind === "image")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Continuity notes
            <textarea
              name="continuity"
              rows={2}
              maxLength={3000}
              placeholder="Backstory, relationships, and details to preserve"
            />
          </label>
          <label className="check-row">
            <input type="checkbox" required />
            <span>
              This is an original character I own or have permission to use.
            </span>
          </label>
          <Button disabled={busy}>
            Save character <Check size={15} />
          </Button>
        </form>
      </Dialog>
    </>
  );
}
export function SettingsPage() {
  const { data } = useApp(),
    { act, busy } = useAction(),
    [presetOpen, setPresetOpen] = useState(false);
  if (!data) return null;
  return (
    <>
      <PageHeading
        eyebrow="A WORKSPACE THAT FEELS LIKE YOU"
        title="Settings"
        description="Your account, creator presets, and connections."
      />
      <div className="settings-layout">
        <section className="panel settings-panel">
          <h2>Your workspace</h2>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              act(
                () =>
                  api(
                    "settings",
                    "PATCH",
                    Object.fromEntries(new FormData(e.currentTarget)),
                  ),
                "Workspace updated.",
              );
            }}
          >
            <label>
              Your name
              <input
                name="name"
                defaultValue={data.me.name}
                maxLength={80}
                required
              />
            </label>
            <label>
              Workspace name
              <input
                name="workspaceName"
                defaultValue={data.me.workspaceName}
                maxLength={100}
                required
              />
            </label>
            <label>
              Email address
              <input value={data.me.email} readOnly />
            </label>
            <Button disabled={busy}>Save changes</Button>
          </form>
        </section>
        <section className="panel settings-panel">
          <h2>Service connections</h2>
          <div className="service-row">
            <span className="mode-icon">
              <Film size={18} />
            </span>
            <div>
              <strong>Render worker</strong>
              <small>
                {data.capabilities.worker
                  ? "Online and ready to process jobs"
                  : "Offline · start npm run worker"}
              </small>
            </div>
            <span
              className={`badge ${data.capabilities.worker ? "success-text" : ""}`}
            >
              {data.capabilities.worker ? "Online" : "Offline"}
            </span>
          </div>
          <div className="service-row">
            <span className="mode-icon">
              <ImageIcon size={18} />
            </span>
            <div>
              <strong>AI provider</strong>
              <small>
                {data.capabilities.ai
                  ? "OpenAI key configured · live calls unverified"
                  : "Needs server configuration"}
              </small>
            </div>
            <span className="badge">
              {data.capabilities.ai ? "Configured" : "Not configured"}
            </span>
          </div>
          {["YouTube", "TikTok", "Instagram"].map((s) => (
            <div className="service-row" key={s}>
              <span className="social-initial">{s[0]}</span>
              <div>
                <strong>{s}</strong>
                <small>Official OAuth integration pending</small>
              </div>
              <span className="badge">Unavailable</span>
            </div>
          ))}
          <p className="muted">
            Use MP4 download to publish manually. API keys stay on the server.
          </p>
        </section>
      </div>
      <section className="panel presets-panel">
        <div className="panel-heading">
          <h2>Creator presets</h2>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPresetOpen(true)}
          >
            <Plus size={14} />
            New preset
          </Button>
        </div>
        {data.presets.length ? (
          <div className="preset-list">
            {data.presets.map((p) => (
              <div key={p.id}>
                <span
                  className="preset-swatch"
                  style={{ backgroundColor: p.accentColor }}
                />
                <div>
                  <strong>{p.name}</strong>
                  <small>
                    {p.tone} · {p.voice} · {p.fontSize}px captions
                  </small>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove preset ${p.name}`}
                  disabled={busy}
                  onClick={() =>
                    act(
                      () => api(`presets/${p.id}`, "DELETE"),
                      "Preset removed.",
                    )
                  }
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            icon={<Palette />}
            title="Your signature style, saved"
            description="Save caption colors and typography, a preferred voice, tone, and audience for your next video."
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPresetOpen(true)}
              >
                Create a preset <ArrowRight size={14} />
              </Button>
            }
          />
        )}
      </section>
      <Dialog
        title="Save your creator style"
        open={presetOpen}
        onOpenChange={setPresetOpen}
      >
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const result = await act(
              () =>
                api("presets", "POST", {
                  ...Object.fromEntries(f),
                  fontSize: Number(f.get("fontSize")),
                }),
              "Creator preset saved.",
            );
            if (result) setPresetOpen(false);
          }}
        >
          <label>
            Preset name
            <input name="name" required maxLength={80} />
          </label>
          <div className="form-grid">
            <label>
              Accent color
              <input name="accentColor" type="color" defaultValue="#8B5CF6" />
            </label>
            <label>
              Caption color
              <input name="captionColor" type="color" defaultValue="#F5F5F7" />
            </label>
          </div>
          <div className="form-grid">
            <label>
              Caption size
              <input
                type="number"
                name="fontSize"
                defaultValue={52}
                min={24}
                max={100}
                required
              />
            </label>
            <label>
              Caption placement
              <select name="captionPosition">
                <option value="center">Center</option>
                <option value="bottom">Bottom</option>
              </select>
            </label>
          </div>
          <label>
            Voice preference
            <select name="voice">
              {voices.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Tone
            <input name="tone" defaultValue="Conversational" maxLength={100} />
          </label>
          <label>
            Audience
            <input name="audience" maxLength={500} />
          </label>
          <Button disabled={busy}>Save preset</Button>
        </form>
      </Dialog>
    </>
  );
}
