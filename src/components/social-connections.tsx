"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  SocialConnection,
  Publication,
  SocialProvider,
} from "@/lib/social";
import { api, useAction } from "./app-provider";
import { Button } from "./ui/button";
import { PublicationReview } from "./publication-review";
import { Dialog } from "./ui/dialog";

type SocialStatus = {
  connections: SocialConnection[];
  publications: Publication[];
  publisher: boolean;
  configured: Record<SocialProvider, boolean>;
};
export function useSocialStatus() {
  return useQuery({
    queryKey: ["social-status"],
    queryFn: () => api<SocialStatus>("social/status"),
    refetchInterval: 5000,
  });
}
const stateLabels: Record<string, string> = {
  waiting_review: "Needs your review",
  queued: "Scheduled",
  uploading: "Submitting video",
  processing: "Platform processing",
  publishing: "Publishing",
  published: "Published",
  uncertain: "Check platform account",
  failed: "Upload failed",
  cancelled: "Stopped",
};
export function SocialConnections() {
  const query = useSocialStatus(),
    client = useQueryClient(),
    { act, busy } = useAction();
  const [review, setReview] = useState<Publication | null>(null);
  async function refresh() {
    await client.invalidateQueries({ queryKey: ["social-status"] });
  }
  return (
    <>
      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>Publishing accounts</h2>
            <p className="muted">
              Connect through the platform?s sign-in page. Your agent never
              receives your account credentials.
            </p>
          </div>
        </div>
        {query.isPending ? (
          <p role="status">Loading publishing accounts…</p>
        ) : query.error ? (
          <p role="alert">{query.error.message}</p>
        ) : (
          <>
            {(["instagram", "tiktok"] as const).map((provider) => {
              const accounts =
                query.data?.connections.filter(
                  (c) => c.provider === provider && !c.disconnectedAt,
                ) ?? [];
              const label = provider === "instagram" ? "Instagram" : "TikTok";
              return (
                <div className="service-row" key={provider}>
                  <div>
                    <strong>{label}</strong>
                    <small>
                      {accounts.length
                        ? accounts.map((c) => c.name).join(", ")
                        : query.data?.configured[provider]
                          ? "Ready to connect"
                          : "Add app credentials in .env to connect"}
                    </small>
                    <small>
                      {provider === "instagram"
                        ? "Scheduled Reels · professional account required"
                        : "Review each video in Clipvero before direct posting"}
                    </small>
                  </div>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        const result = await api<{ url: string }>(
                          `social/connect/${provider}`,
                          "POST",
                        );
                        window.location.assign(result.url);
                      })
                    }
                  >
                    Connect {label}
                  </Button>
                  {accounts.map((account) => (
                    <Button
                      key={account.id}
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        void act(async () => {
                          await api(
                            `social/connections/${account.id}`,
                            "DELETE",
                          );
                          await refresh();
                        }, "Account disconnected. Saved tokens were removed.")
                      }
                    >
                      Disconnect {account.name}
                    </Button>
                  ))}
                </div>
              );
            })}
            <p className="notice">
              {query.data?.publisher
                ? "Publisher connected. Authorized uploads continue in the background."
                : "Publisher is offline. Start pnpm publisher alongside the website and video worker."}
            </p>
            <p className="muted">
              Account connections and platform video downloads require a public
              HTTPS APP_URL. TikTok also requires verification of the media URL
              domain. Disconnecting prevents new submissions; check the platform
              for any submission already in progress.
            </p>
          </>
        )}
      </section>
      <section className="panel settings-panel">
        <h2>Publishing queue</h2>
        <p className="muted">
          Each Instagram and TikTok submission has its own status. TikTok always
          requires your review before upload.
        </p>
        {query.data?.publications.length ? (
          query.data.publications.map((item) => (
            <div className="service-row" key={item.id}>
              <div>
                <strong>
                  {item.accountName} ·{" "}
                  {item.provider === "instagram" ? "Instagram" : "TikTok"}
                </strong>
                <small>
                  {stateLabels[item.state] ?? item.state} ·{" "}
                  {new Date(item.scheduledAt).toLocaleString()}
                </small>
                {item.error && <small role="status">{item.error}</small>}
                {item.postId && <small>Platform post: {item.postId}</small>}
              </div>
              <Link
                className="button secondary"
                href={`/editor/${item.projectId}`}
              >
                Open video
              </Link>
              {item.postUrl && (
                <a
                  className="button secondary"
                  href={item.postUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  View post
                </a>
              )}
              {item.state === "waiting_review" && (
                <Button onClick={() => setReview(item)}>Review upload</Button>
              )}
              {["waiting_review", "queued", "processing"].includes(
                item.state,
              ) && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      await api(`social/publications/${item.id}`, "DELETE");
                      await refresh();
                    }, "Upload stopped. Check the platform for any transfer already started.")
                  }
                >
                  Stop upload
                </Button>
              )}
            </div>
          ))
        ) : (
          <p className="muted">
            Videos from an authorized agent allowance appear here after
            rendering.
          </p>
        )}
      </section>
      <Dialog
        title="Review upload"
        description={
          review?.provider === "tiktok"
            ? "Review the video, choose its TikTok audience and interactions, and authorize this post."
            : "This schedules the current rendered video for publication on your Instagram account."
        }
        open={!!review}
        onOpenChange={(open) => {
          if (!open) setReview(null);
        }}
      >
        {review && (
          <PublicationReview
            key={review.id}
            item={review}
            onSaved={async () => {
              setReview(null);
              await refresh();
            }}
          />
        )}
      </Dialog>
    </>
  );
}
