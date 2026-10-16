"use client";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Rocket } from "lucide-react";
import { createSchema, estimateCost } from "@/lib/model";
import { api, useAction, useApp } from "./app-provider";
import { Button } from "./ui/button";
import { useSocialStatus } from "./social-connections";

type Result = {
  requested: number;
  queued: number;
  perVideoCredits: number;
  intervalMinutes: number;
  firstUpload: number | null;
  lastUpload: number | null;
  automatic: boolean;
  topics: string[];
  stoppedBecause: string | null;
};

/** "Make N videos over H hours": topics, scripts, voices, renders and uploads are planned for you. */
export function AutopilotPanel() {
  const { data } = useApp(),
    social = useSocialStatus(),
    client = useQueryClient(),
    { act, busy } = useAction();
  const [count, setCount] = useState(10),
    [hours, setHours] = useState(24),
    [style, setStyle] = useState<"explainer" | "conversation">("explainer"),
    [picked, setPicked] = useState<string[]>([]),
    [automatic, setAutomatic] = useState(false),
    [result, setResult] = useState<Result | null>(null);
  const accounts = (social.data?.connections ?? []).filter(
    (c) => !c.disconnectedAt && c.provider === "instagram",
  );
  const gameplay = (data?.assets ?? []).filter((a) => a.kind === "video");
  // Same tariff the server reserves: one video of this run, times the count.
  const perVideo = estimateCost(
    createSchema.parse({
      title: "Estimate",
      mode: "explainer",
      content: "Estimate",
      duration: 60,
      voice: "free-cute",
      style,
      rightsConfirmed: true,
    }),
  );
  const total = perVideo * count;
  const balance = data?.me.credits ?? 0;
  const spacing = Math.max(15, Math.floor((hours * 60) / count));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setResult(null);
    await act(async () => {
      const response = await api<Result>("automation/runs", "POST", {
        count,
        hours,
        style,
        voice: form.get("voice"),
        niche: String(form.get("niche") || "").trim() || undefined,
        backgroundAssetId:
          style === "conversation" ? form.get("background") : undefined,
        connectionIds: picked,
        automatic: picked.length > 0 && automatic,
      });
      setResult(response);
      await client.invalidateQueries({ queryKey: ["agent-grants"] });
      await client.invalidateQueries({ queryKey: ["state"] });
    });
  }
  return (
    <section className="panel settings-panel" aria-labelledby="autopilot-title">
      <div className="panel-heading">
        <div>
          <h2 id="autopilot-title">Make a batch of videos</h2>
          <p className="muted">
            Pick how many and how long to spread them. Clipvero chooses topics
            (your ideas folder first), writes the scripts, voices and renders
            them, and spaces the uploads.
          </p>
        </div>
        <Rocket size={20} aria-hidden />
      </div>
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <div className="form-grid">
          <label>
            Videos
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            >
              {[3, 5, 10, 25, 50, 100].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label>
            Spread over
            <select
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
            >
              {[6, 12, 24, 36, 48].map((h) => (
                <option key={h} value={h}>
                  {h} hours
                </option>
              ))}
            </select>
          </label>
          <label>
            Style
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value as typeof style)}
            >
              <option value="explainer">Animated explainer</option>
              <option value="conversation">Two hosts talking</option>
            </select>
          </label>
          <label>
            Voice
            <select name="voice" defaultValue="free-cute">
              <option value="free-cute">Free voice · cute</option>
              <option value="free-warm">Free voice · warm</option>
              <option value="free-deep">Free voice · deep</option>
              <option value="free-bold">Free voice · bold</option>
            </select>
          </label>
        </div>
        {style === "conversation" && (
          <label>
            Background gameplay (your recording)
            <select name="background" required>
              <option value="">
                {gameplay.length
                  ? "Choose from your asset library"
                  : "Upload footage in Asset Library first"}
              </option>
              {gameplay.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Channel focus
          <input
            name="niche"
            maxLength={200}
            placeholder="data structures and algorithms for beginners"
          />
        </label>
        <fieldset className="form-stack">
          <legend>Post to Instagram</legend>
          {accounts.length ? (
            accounts.map((c) => (
              <label className="checkbox-row" key={c.id}>
                <input
                  type="checkbox"
                  checked={picked.includes(c.id)}
                  onChange={(e) =>
                    setPicked(
                      e.target.checked
                        ? [...picked, c.id]
                        : picked.filter((id) => id !== c.id),
                    )
                  }
                />
                {c.name} · one upload about every {spacing} minutes
              </label>
            ))
          ) : (
            <p className="muted">
              No Instagram account connected. Videos will wait for your review
              in Clipvero.
            </p>
          )}
          {picked.length > 0 && count > 1 && (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={automatic}
                onChange={(e) => setAutomatic(e.target.checked)}
              />
              Publish automatically without reviewing each video
            </label>
          )}
          <p className="notice">
            {picked.length && automatic
              ? `Each finished video is posted to Instagram on schedule without another review. You can stop the run any time by revoking it in Agent access.`
              : "Without this, each finished video waits for your approval in the publishing queue before anything is posted."}
          </p>
        </fieldset>
        <p
          className={total > balance ? "notice" : "muted"}
          role="status"
          aria-live="polite"
        >
          {count} videos reserve {total} credits ({perVideo} each). Your balance
          is {balance}
          {total > balance
            ? `, so you can make ${Math.floor(balance / perVideo)} now.`
            : "."}
        </p>
        <Button type="submit" disabled={busy || total > balance}>
          {busy ? "Planning topics…" : `Make ${count} videos`}
        </Button>
      </form>
      {result && (
        <div className="notice" role="status">
          <strong>
            Queued {result.queued} of {result.requested} videos.
          </strong>{" "}
          They render one after another; follow progress in Projects.
          {result.firstUpload && (
            <>
              {" "}
              Uploads start around{" "}
              {new Date(result.firstUpload).toLocaleString()}, one every{" "}
              {result.intervalMinutes} minutes
              {result.automatic
                ? ", posted automatically"
                : ", each needing your approval"}
              .
            </>
          )}
          {result.stoppedBecause && (
            <p role="alert">Stopped early: {result.stoppedBecause}</p>
          )}
          <details>
            <summary>Topics chosen</summary>
            <ol>
              {result.topics.map((topic) => (
                <li key={topic}>{topic}</li>
              ))}
            </ol>
          </details>
        </div>
      )}
    </section>
  );
}
