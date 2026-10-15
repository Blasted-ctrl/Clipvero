import { setTimeout } from "node:timers/promises";
import { one, run, transaction } from "../server/db";
import {
  getConnection,
  freshSocialConnection,
  planPublications,
  publicationMediaUrl,
} from "../server/social";
import { getProject } from "../server/projects";
import {
  ProviderError,
  startSocialUpload,
  socialUploadStatus,
  publishInstagram,
  instagramPermalink,
  tikTokCreator,
  validateTikTokPost,
} from "../server/social-providers";
import { tiktokPostSchema } from "../lib/social";
import { duration } from "../lib/model";
import { AppError } from "../server/errors";

type Pending = {
  id: string;
  workspaceId: string;
  grantId: string;
  connectionId: string;
  projectId: string;
  revision: number;
  assetId: string;
  caption: string;
  postInfo: string | null;
  state: string;
  providerId: string | null;
  postId: string | null;
  deadline: number;
  createdAt: number;
  submittedAt: number | null;
  leaseToken: string;
};
class ClaimLost extends Error {}
function owns(item: Pending) {
  return !!one(
    "SELECT id FROM publications WHERE id=? AND lease_token=? AND lease_until>?",
    item.id,
    item.leaseToken,
    Date.now(),
  );
}
function change(
  item: Pending,
  assignment: string,
  ...values: (string | number | null)[]
) {
  const result = run(
    `UPDATE publications SET ${assignment} WHERE id=? AND lease_token=? AND lease_until>?`,
    ...values,
    item.id,
    item.leaseToken,
    Date.now(),
  );
  if (!result.changes) throw new ClaimLost();
}
function setState(
  item: Pending,
  state: string,
  error: string | null = null,
  nextPoll = Date.now() + 60000,
) {
  change(
    item,
    "state=?,error=?,lease_until=NULL,next_poll=?,updated_at=?",
    state,
    error,
    nextPoll,
    Date.now(),
  );
}
function allowed(item: Pending) {
  if (!owns(item)) throw new ClaimLost();
  const grant = one(
    "SELECT id FROM agent_grants WHERE id=? AND workspace_id=? AND revoked_at IS NULL AND expires_at>?",
    item.grantId,
    item.workspaceId,
    Date.now(),
  );
  if (!grant || item.deadline < Date.now())
    throw new AppError(
      403,
      "Publishing authorization expired or was revoked. Check the account before issuing new access.",
    );
  const p = getProject(item.workspaceId, item.projectId);
  if (
    p.revision !== item.revision ||
    p.renderedRevision !== item.revision ||
    p.outputAssetId !== item.assetId ||
    !["approved", "scheduled"].includes(p.status)
  )
    throw new AppError(
      409,
      "The approved rendered revision changed. This upload was stopped.",
    );
  return getConnection(item.workspaceId, item.connectionId);
}
function reserveSubmission(item: Pending) {
  return transaction(() => {
    allowed(item);
    const current = one<{ state: string }>(
      "SELECT state FROM publications WHERE id=?",
      item.id,
    )!;
    if (current.state !== "queued") throw new ClaimLost();
    const policy = JSON.parse(
      one<{ policy: string }>(
        "SELECT policy FROM agent_grants WHERE id=?",
        item.grantId,
      )!.policy,
    );
    const last = one<{ submittedAt: number }>(
      "SELECT submitted_at AS submittedAt FROM publications WHERE grant_id=? AND connection_id=? AND submitted_at IS NOT NULL ORDER BY submitted_at DESC LIMIT 1",
      item.grantId,
      item.connectionId,
    );
    const next = last ? last.submittedAt + policy.intervalMinutes * 60000 : 0;
    if (next > Date.now()) {
      change(item, "lease_until=NULL,next_poll=?", next);
      return false;
    }
    change(
      item,
      "state='uploading',submitted_at=?,updated_at=?",
      Date.now(),
      Date.now(),
    );
    return true;
  });
}
export async function publishTick() {
  planPublications();
  // An expired external write must be reconciled, never resubmitted.
  run(
    "UPDATE publications SET state='uncertain',error='Publisher stopped during a platform request. Check the platform account before retrying.',lease_until=NULL,lease_token=NULL,updated_at=? WHERE state IN ('uploading','publishing') AND lease_until<?",
    Date.now(),
    Date.now(),
  );
  const item = transaction(() => {
    const row = one<Omit<Pending, "leaseToken">>(
      "SELECT p.id,p.workspace_id AS workspaceId,p.grant_id AS grantId,p.connection_id AS connectionId,p.project_id AS projectId,p.revision,p.asset_id AS assetId,p.caption,p.post_info AS postInfo,p.state,p.provider_id AS providerId,p.post_id AS postId,p.deadline,p.created_at AS createdAt,p.submitted_at AS submittedAt FROM publications p JOIN social_connections c ON c.id=p.connection_id WHERE p.state IN ('queued','processing','uncertain','published') AND (p.state!='uncertain' OR p.provider_id IS NOT NULL) AND (p.state!='published' OR (c.provider='instagram' AND p.post_id IS NOT NULL AND p.post_url IS NULL) OR (c.provider='tiktok' AND p.post_id IS NULL AND COALESCE(p.submitted_at,p.created_at)>?)) AND p.next_poll<=? AND p.scheduled_at<=? AND (p.lease_until IS NULL OR p.lease_until<?) ORDER BY p.next_poll,p.scheduled_at LIMIT 1",
      Date.now() - 86400000,
      Date.now(),
      Date.now(),
      Date.now(),
    );
    if (!row) return null;
    const leaseToken = crypto.randomUUID();
    run(
      "UPDATE publications SET lease_until=?,lease_token=? WHERE id=?",
      Date.now() + 120000,
      leaseToken,
      row.id,
    );
    return { ...row, leaseToken };
  });
  if (!item) return false;
  let state = item.state;
  try {
    // Published outcomes remain published even if their original grant expires.
    const readOnlyOutcome = state === "published" || state === "uncertain";
    if (!readOnlyOutcome) allowed(item);
    const { connection, credentials } = await freshSocialConnection(
      item.workspaceId,
      item.connectionId,
    );
    if (!owns(item)) throw new ClaimLost();
    if (!readOnlyOutcome) allowed(item);
    if (state === "queued") {
      const postInfo = item.postInfo
        ? tiktokPostSchema.parse(JSON.parse(item.postInfo))
        : undefined;
      if (connection.provider === "tiktok") {
        if (!postInfo)
          throw new AppError(
            422,
            "TikTok posting requires a fresh review and explicit consent.",
          );
        const creator = await tikTokCreator(credentials.accessToken);
        validateTikTokPost(
          creator,
          postInfo,
          duration(getProject(item.workspaceId, item.projectId).timeline) / 30,
        );
      }
      if (!reserveSubmission(item)) return true;
      state = "uploading";
      allowed(item);
      const providerId = await startSocialUpload(
        connection.provider,
        connection.accountId,
        credentials.accessToken,
        publicationMediaUrl(item.id),
        item.caption,
        postInfo,
      );
      change(
        item,
        "provider_id=?,state='processing',next_poll=?,lease_until=NULL,updated_at=?",
        providerId,
        Date.now() + 60000,
        Date.now(),
      );
      return true;
    }
    if (
      state === "published" &&
      connection.provider === "instagram" &&
      item.postId
    ) {
      const url = await instagramPermalink(
        item.postId,
        credentials.accessToken,
      );
      change(
        item,
        "post_url=?,error=NULL,lease_until=NULL,updated_at=?",
        url,
        Date.now(),
      );
      return true;
    }
    const result = await socialUploadStatus(
      connection.provider,
      item.providerId!,
      credentials.accessToken,
    );
    if (!owns(item)) throw new ClaimLost();
    const status = result.state;
    if (status === "PUBLISHED" || status === "PUBLISH_COMPLETE") {
      if (result.postId) change(item, "post_id=?", result.postId);
      setState(item, "published");
      return true;
    }
    if (["ERROR", "EXPIRED", "FAILED"].includes(status)) {
      setState(
        item,
        state === "published" ? "published" : "failed",
        `Platform processing ended with ${status}.`,
        Number.MAX_SAFE_INTEGER,
      );
      return true;
    }
    if (
      status === "FINISHED" &&
      connection.provider === "instagram" &&
      state !== "uncertain"
    ) {
      transaction(() => {
        allowed(item);
        const current = one<{ state: string }>(
          "SELECT state FROM publications WHERE id=?",
          item.id,
        )!;
        if (current.state !== "processing") throw new ClaimLost();
        change(item, "state='publishing',updated_at=?", Date.now());
      });
      state = "publishing";
      allowed(item);
      const postId = await publishInstagram(
        connection.accountId,
        item.providerId!,
        credentials.accessToken,
      );
      change(
        item,
        "state='published',post_id=?,next_poll=?,lease_until=NULL,updated_at=?",
        postId,
        Date.now(),
        Date.now(),
      );
      return true;
    }
    setState(
      item,
      state,
      null,
      (
        readOnlyOutcome
          ? (item.submittedAt ?? item.createdAt) + 86400000 < Date.now()
          : item.deadline < Date.now() + 60000
      )
        ? Number.MAX_SAFE_INTEGER
        : Date.now() + 60000,
    );
  } catch (error) {
    if (error instanceof ClaimLost || !owns(item)) return true;
    const unsafe = ["uploading", "publishing"].includes(state);
    const uncertain =
      unsafe && (!(error instanceof ProviderError) || error.uncertain);
    const message =
      error instanceof AppError || error instanceof ProviderError
        ? error.message
        : "The platform returned an unexpected response. Check the account before retrying.";
    if (!unsafe && error instanceof AppError && error.status === 503)
      setState(item, state, message, Date.now() + 30000);
    else if (uncertain) setState(item, "uncertain", message);
    else if (state === "published")
      setState(
        item,
        "published",
        message,
        error instanceof AppError
          ? Number.MAX_SAFE_INTEGER
          : Date.now() + 300000,
      );
    else if (state === "uncertain")
      setState(
        item,
        "uncertain",
        message,
        error instanceof AppError
          ? Number.MAX_SAFE_INTEGER
          : Date.now() + 60000,
      );
    else if (error instanceof AppError)
      setState(
        item,
        item.providerId ? "uncertain" : "cancelled",
        message,
        item.providerId ? Date.now() + 60000 : Number.MAX_SAFE_INTEGER,
      );
    else if (state === "processing") setState(item, state, message);
    else setState(item, "failed", message);
  }
  return true;
}
export function publisherStatus() {
  const value = one<{ value: string }>(
    "SELECT value FROM system_state WHERE key='publisher_heartbeat'",
  )?.value;
  return !!value && Date.now() - Number(value) < 120000;
}
export async function runPublisher() {
  let stopping = false;
  process.on("SIGINT", () => {
    stopping = true;
  });
  process.on("SIGTERM", () => {
    stopping = true;
  });
  console.log("Clipvero publisher ready. Watching authorized uploads.");
  while (!stopping) {
    try {
      run(
        "INSERT OR REPLACE INTO system_state VALUES ('publisher_heartbeat',?)",
        String(Date.now()),
      );
      await publishTick();
    } catch {
      console.error(
        JSON.stringify({
          event: "publisher.loop_failed",
          message:
            "The publisher could not process its queue. Check database access and configuration.",
        }),
      );
    }
    await setTimeout(1500);
  }
}
