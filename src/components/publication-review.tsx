"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Publication, TikTokCreator } from "@/lib/social";
import { api, useAction } from "./app-provider";
import { Button } from "./ui/button";

const privacyLabels: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Everyone",
  MUTUAL_FOLLOW_FRIENDS: "Friends",
  FOLLOWER_OF_CREATOR: "Followers",
  SELF_ONLY: "Only me",
};
export function PublicationReview({
  item,
  onSaved,
}: {
  item: Publication;
  onSaved: () => Promise<void>;
}) {
  const { act, busy } = useAction();
  const [commercial, setCommercial] = useState(false),
    [ownBrand, setOwnBrand] = useState(false),
    [branded, setBranded] = useState(false),
    [privacy, setPrivacy] = useState("");
  const query = useQuery({
    queryKey: ["tiktok-creator", item.id],
    queryFn: () =>
      api<{ creator: TikTokCreator; seconds: number }>(
        `social/publications/${item.id}/creator`,
      ),
    enabled: item.provider === "tiktok",
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
  const creator = query.data?.creator;
  const video = useQuery({
    queryKey: ["publication-preview", item.id],
    queryFn: () =>
      api<{
        revision: number;
        renderedRevision: number | null;
        outputAssetId: string | null;
      }>(`projects/${item.projectId}`),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
  const current = video.data;
  const blocked =
    !current ||
    current.revision !== current.renderedRevision ||
    !current.outputAssetId ||
    video.isFetching ||
    (item.provider === "tiktok" &&
      (!creator ||
        query.isFetching ||
        !privacy ||
        !creator.privacy_level_options.includes(
          privacy as TikTokCreator["privacy_level_options"][number],
        ) ||
        !query.data ||
        query.data.seconds > creator.max_video_post_duration_sec ||
        (commercial && !ownBrand && !branded) ||
        (branded && privacy === "SELF_ONLY")));
  return (
    <form
      key={current?.revision ?? "loading"}
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        if (blocked) return;
        const form = new FormData(event.currentTarget);
        void act(async () => {
          await api(`social/publications/${item.id}`, "POST", {
            caption: form.get("caption"),
            consent: true,
            revision: current!.revision,
            ...(item.provider === "tiktok"
              ? {
                  tiktok: {
                    privacy_level: privacy,
                    disable_comment: form.get("comments") !== "on",
                    disable_duet: form.get("duet") !== "on",
                    disable_stitch: form.get("stitch") !== "on",
                    brand_content_toggle: commercial && branded,
                    brand_organic_toggle: commercial && ownBrand,
                    consent: true,
                  },
                }
              : {}),
          });
          await onSaved();
        }, "Upload authorized. The platform may take a few minutes to process it.");
      }}
    >
      <video
        aria-label="Rendered video for review"
        controls
        preload="metadata"
        src={
          current?.outputAssetId
            ? `/api/assets/${current.outputAssetId}`
            : undefined
        }
        style={{ width: "100%", maxHeight: 360 }}
      />
      {video.isPending ? (
        <p role="status">Loading the current rendered video…</p>
      ) : video.error ? (
        <p role="alert">{video.error.message}</p>
      ) : current?.revision !== current?.renderedRevision ? (
        <p role="alert">
          Render the current video before approving this upload.
        </p>
      ) : (
        <p className="muted">
          Reviewing rendered revision {current?.revision}.
        </p>
      )}
      <label>
        {item.provider === "instagram" ? "Instagram caption" : "TikTok caption"}
        <textarea
          name="caption"
          defaultValue={item.caption}
          required
          maxLength={2200}
        />
      </label>
      <p className="muted">
        Account: {creator?.creator_nickname ?? item.accountName}. Scheduled:{" "}
        {new Date(item.scheduledAt).toLocaleString()}. This video will carry an
        AI content disclosure.
      </p>
      {item.provider === "tiktok" && (
        <>
          {query.isPending ? (
            <p role="status">Loading the latest TikTok account settings…</p>
          ) : query.error ? (
            <p role="alert">{query.error.message}</p>
          ) : (
            creator && (
              <>
                <p>
                  TikTok creator: <strong>{creator.creator_nickname}</strong> (@
                  {creator.creator_username}). Maximum video length:{" "}
                  {creator.max_video_post_duration_sec} seconds.
                </p>
                {query.data!.seconds > creator.max_video_post_duration_sec && (
                  <p role="alert">
                    This video exceeds your TikTok account’s duration limit.
                    Shorten and render it before posting.
                  </p>
                )}
                <label>
                  Who can watch this video?
                  <select
                    required
                    value={privacy}
                    onChange={(event) => setPrivacy(event.target.value)}
                  >
                    <option value="" disabled>
                      Select an audience
                    </option>
                    {creator.privacy_level_options.map((option) => (
                      <option
                        value={option}
                        key={option}
                        disabled={branded && option === "SELF_ONLY"}
                      >
                        {privacyLabels[option]}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset className="form-stack">
                  <legend>Allow viewers to</legend>
                  {[
                    {
                      name: "comments",
                      label: "Comment",
                      disabled: creator.comment_disabled,
                    },
                    {
                      name: "duet",
                      label: "Duet",
                      disabled: creator.duet_disabled,
                    },
                    {
                      name: "stitch",
                      label: "Stitch",
                      disabled: creator.stitch_disabled,
                    },
                  ].map((control) => (
                    <label className="checkbox-row" key={control.name}>
                      <input
                        type="checkbox"
                        name={control.name}
                        disabled={control.disabled}
                      />
                      {control.label}
                      {control.disabled
                        ? " · disabled in your TikTok settings"
                        : ""}
                    </label>
                  ))}
                </fieldset>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={commercial}
                    onChange={(event) => {
                      setCommercial(event.target.checked);
                      setBranded(false);
                      setOwnBrand(false);
                    }}
                  />
                  This content promotes a brand, product or service
                </label>
                {commercial && (
                  <fieldset className="form-stack">
                    <legend>Commercial content disclosure</legend>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={ownBrand}
                        onChange={(event) => setOwnBrand(event.target.checked)}
                      />
                      Your brand · promoting yourself or your business
                    </label>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={branded}
                        disabled={privacy === "SELF_ONLY"}
                        onChange={(event) => setBranded(event.target.checked)}
                      />
                      Branded content · promoting a third party
                    </label>
                    {privacy === "SELF_ONLY" && (
                      <p className="muted">
                        Branded content visibility cannot be private.
                      </p>
                    )}
                    <p className="notice">
                      {branded
                        ? "Your video will be labeled as ‘Paid partnership’. Both disclosures may be selected."
                        : ownBrand
                          ? "Your video will be labeled as ‘Promotional content’."
                          : "Indicate whether you promote yourself, a third party, or both before posting."}
                    </p>
                  </fieldset>
                )}
                <p>
                  By posting, you agree to TikTok’s{" "}
                  {branded && (
                    <>
                      <a
                        href="https://www.tiktok.com/legal/page/global/bc-policy/en"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Branded Content Policy
                      </a>{" "}
                      and{" "}
                    </>
                  )}
                  <a
                    href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Music Usage Confirmation
                  </a>
                  .
                </p>
                <p className="muted">
                  Posting may take a few minutes. Unaudited apps can post only
                  to private accounts with “Only me” visibility. Public posting
                  requires TikTok’s audit.
                </p>
              </>
            )
          )}
        </>
      )}
      <label className="checkbox-row">
        <input type="checkbox" required />I reviewed this video and authorize
        sending it to {item.provider === "instagram" ? "Instagram" : "TikTok"}{" "}
        with these settings.
      </label>
      <Button type="submit" disabled={busy || blocked}>
        Authorize{" "}
        {item.provider === "tiktok" ? "TikTok post" : "Instagram post"}
      </Button>
    </form>
  );
}
