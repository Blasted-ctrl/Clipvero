"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import type { AgentGrant } from "@/lib/automation";
import { api, useAction } from "./app-provider";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { PageHeading } from "./common";
import { SocialConnections, useSocialStatus } from "./social-connections";

export function AutomationPage() {
  const client = useQueryClient(),
    { act, busy } = useAction();
  const [open, setOpen] = useState(false),
    [token, setToken] = useState("");
  const [runLimit, setRunLimit] = useState("1");
  const social = useSocialStatus();
  const query = useQuery({
    queryKey: ["agent-grants"],
    queryFn: () => api<{ grants: AgentGrant[] }>("automation/grants"),
    refetchInterval: 5000,
  });
  return (
    <>
      <PageHeading
        eyebrow="YOUR CREATION WORKFLOW"
        title="Automation"
        description="Connect an agent to create videos in your workspace. You control its allowance and budget."
      />
      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>Agent access</h2>
            <p className="muted">
              Start with one guided video. Issue a new allowance for 3, 5 or 8
              when you are ready.
            </p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} />
            Connect an agent
          </Button>
        </div>
        <p className="notice">
          Access tokens can create and inspect their own video jobs. Each
          allowance is a lifetime limit across all its requests. Credits are
          reserved before work starts; provider billing is separate.
        </p>
        {query.isPending ? (
          <p role="status">Loading agent access…</p>
        ) : query.error ? (
          <p role="alert">{query.error.message}</p>
        ) : query.data?.grants.length ? (
          <div>
            {query.data.grants.map((grant) => (
              <div className="service-row" key={grant.id}>
                <KeyRound size={18} />
                <div>
                  <strong>{grant.name}</strong>
                  <small>
                    {grant.runs} / {grant.runLimit} videos · {grant.spent} /{" "}
                    {grant.creditLimit} credits ·{" "}
                    {grant.revokedAt
                      ? "Revoked"
                      : grant.expired
                        ? "Expired"
                        : `Expires ${new Date(grant.expiresAt).toLocaleString()}`}
                  </small>
                </div>
                {!grant.revokedAt && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Revoke ${grant.name}`}
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        await api(`automation/grants/${grant.id}`, "DELETE");
                        await client.invalidateQueries({
                          queryKey: ["agent-grants"],
                        });
                      }, "Agent access revoked. Queued work was stopped.")
                    }
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">
            No agents connected. Create a limited access token for your first
            run.
          </p>
        )}
        <p className="muted">
          Revoking access stops queued jobs. In-progress work can finish; review
          its output in Projects.
        </p>
      </section>
      <SocialConnections />
      <section className="panel settings-panel">
        <h2>Connect with MCP</h2>
        <p>
          For a client that supports authenticated HTTP MCP, use{" "}
          <code>/api/mcp</code> on your Clipvero origin with the token in its
          Authorization header.
        </p>
        <p className="muted">
          For a local MCP client, launch <code>pnpm --silent agent:mcp</code> in
          this repository and set <code>CLIPVERO_URL</code> and{" "}
          <code>CLIPVERO_AGENT_TOKEN</code> in that client?s private environment
          settings. The bridge uses standard input/output and forwards requests
          to your website.
        </p>
        <p className="muted">
          An agent receives durable batch IDs and can reconnect to check
          progress. It does not need to keep a chat open while videos render.
        </p>
      </section>
      <Dialog
        title="Connect an agent"
        description="This token grants access to your Clipvero workspace. Save it in your agent client's private settings."
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) setToken("");
        }}
      >
        {token ? (
          <div className="form-stack">
            <p className="notice">
              Copy this token now. It is shown once and only its hash is stored.
            </p>
            <label>
              Agent token
              <input value={token} readOnly autoComplete="off" />
            </label>
            <Button
              onClick={() =>
                void act(
                  () => navigator.clipboard.writeText(token),
                  "Token copied.",
                )
              }
            >
              <Copy size={15} />
              Copy token
            </Button>
            <p className="muted">
              Use <code>Authorization: Bearer YOUR_TOKEN</code> for HTTP MCP.
              For the local bridge, set it as <code>CLIPVERO_AGENT_TOKEN</code>.
            </p>
          </div>
        ) : (
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const connectionIds = form.getAll("connectionIds");
              void act(async () => {
                const result = await api<{ token: string }>(
                  "automation/grants",
                  "POST",
                  {
                    name: form.get("name"),
                    runLimit: Number(form.get("runLimit")),
                    creditLimit: Number(form.get("creditLimit")),
                    expiresHours: Number(form.get("expiresHours")),
                    ...(connectionIds.length
                      ? {
                          publishing: {
                            connectionIds,
                            automatic:
                              form.get("automatic") === "on" &&
                              runLimit !== "1",
                            startAt: new Date(
                              String(form.get("startAt")),
                            ).getTime(),
                            intervalMinutes: Number(
                              form.get("intervalMinutes"),
                            ),
                            endAt: new Date(
                              String(form.get("endAt")),
                            ).getTime(),
                          },
                        }
                      : {}),
                  },
                );
                setToken(result.token);
                await client.invalidateQueries({ queryKey: ["agent-grants"] });
              });
            }}
          >
            <label>
              Agent name
              <input name="name" required maxLength={80} />
            </label>
            <label>
              Video allowance
              <select
                name="runLimit"
                value={runLimit}
                onChange={(event) => setRunLimit(event.target.value)}
              >
                {[1, 3, 5, 8].map((count) => (
                  <option key={count} value={count}>
                    {count} {count === 1 ? "video · guided run" : "videos"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Maximum Clipvero credits
              <input
                name="creditLimit"
                type="number"
                min={1}
                max={1200}
                defaultValue={20}
                required
              />
            </label>
            <label>
              Access duration
              <select name="expiresHours" defaultValue="24">
                <option value="1">1 hour</option>
                <option value="24">24 hours</option>
                <option value="168">7 days</option>
              </select>
            </label>
            <fieldset className="form-stack">
              <legend>Publishing destinations</legend>
              {social.data?.connections
                .filter((c) => !c.disconnectedAt)
                .map((connection) => (
                  <label className="checkbox-row" key={connection.id}>
                    <input
                      type="checkbox"
                      name="connectionIds"
                      value={connection.id}
                    />
                    {connection.name} ·{" "}
                    {connection.provider === "instagram"
                      ? "Instagram Reel"
                      : "TikTok ? review each video"}
                  </label>
                ))}
              {!social.data?.connections.some((c) => !c.disconnectedAt) && (
                <p className="muted">
                  Connect an account to authorize uploads. You can create videos
                  without a publishing destination.
                </p>
              )}
              <label>
                First upload (your local time)
                <input name="startAt" type="datetime-local" />
              </label>
              <label>
                Minutes between videos
                <input
                  name="intervalMinutes"
                  type="number"
                  min={15}
                  max={1440}
                  defaultValue={60}
                />
              </label>
              <label>
                Stop uploading after (your local time)
                <input name="endAt" type="datetime-local" />
              </label>
              <p className="muted">
                The window must fit the video allowance and end before this
                access expires. Queued uploads wait for their scheduled time and
                stop when the window ends.
              </p>
              {runLimit !== "1" && (
                <label className="checkbox-row">
                  <input name="automatic" type="checkbox" />
                  Automatically approve Instagram videos for these destinations,
                  within this allowance and schedule.
                </label>
              )}
              <p className="notice">
                {runLimit === "1"
                  ? "Your first guided video requires review in the publishing queue."
                  : "Automatic approval lets this agent's videos publish to Instagram without another review. Each TikTok video still requires your review and consent in Clipvero."}
              </p>
            </fieldset>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating access…" : "Create agent token"}
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}
