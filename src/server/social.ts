import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import {
  publishingPolicySchema,
  type PublishingPolicy,
  type Publication,
  type SocialConnection,
  type SocialProvider,
  type TikTokPost,
} from "@/lib/social";
import { all, one, run, transaction } from "./db";
import { appUrl, type Identity } from "./auth";
import { AppError, requireValue } from "./errors";
import { getProject, reviewProject } from "./projects";
import {
  authorizeUrl,
  exchangeSocialCode,
  type SocialCredentials,
  tikTokCreator,
  validateTikTokPost,
  refreshSocialToken,
} from "./social-providers";
import { duration } from "@/lib/model";

type Connection = SocialConnection & {
  workspaceId: string;
  accountId: string;
  credentials: string;
};
const connectionSelect =
  "SELECT id,workspace_id AS workspaceId,provider,account_id AS accountId,name,credentials,expires_at AS expiresAt,disconnected_at AS disconnectedAt FROM social_connections";
const publicSelect =
  "SELECT p.id,p.project_id AS projectId,p.revision,c.provider,c.name AS accountName,p.caption,p.state,p.scheduled_at AS scheduledAt,p.post_url AS postUrl,p.post_id AS postId,p.error FROM publications p JOIN social_connections c ON c.id=p.connection_id";
function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new AppError(
      503,
      "Set a strong SESSION_SECRET before connecting social accounts.",
    );
  return Buffer.from(
    hkdfSync("sha256", secret, "clipvero", "social-credentials-v1", 32),
  );
}
export function sealCredentials(id: string, credentials: SocialCredentials) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(id));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(credentials), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}
export function openCredentials(id: string, value: string): SocialCredentials {
  const bytes = Buffer.from(value, "base64url"),
    decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
  decipher.setAAD(Buffer.from(id));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return z
    .object({
      accessToken: z.string().min(1),
      refreshToken: z.string().optional(),
    })
    .parse(
      JSON.parse(
        Buffer.concat([
          decipher.update(bytes.subarray(28)),
          decipher.final(),
        ]).toString("utf8"),
      ),
    );
}
export function listConnections(workspace: string): SocialConnection[] {
  return all(
    "SELECT id,provider,name,expires_at AS expiresAt,disconnected_at AS disconnectedAt FROM social_connections WHERE workspace_id=? ORDER BY created_at DESC LIMIT 50",
    workspace,
  );
}
export function getConnection(workspace: string, id: string) {
  const connection = requireValue(
    one<Connection>(
      `${connectionSelect} WHERE workspace_id=? AND id=? AND disconnected_at IS NULL`,
      workspace,
      id,
    ),
    "This social account is disconnected.",
  );
  return connection;
}
export function beginSocialConnection(me: Identity, provider: SocialProvider) {
  key();
  const state = randomBytes(32).toString("hex"),
    url = authorizeUrl(provider, state);
  run("DELETE FROM social_oauth_states WHERE expires_at<?", Date.now());
  run(
    "INSERT INTO social_oauth_states VALUES (?,?,?,?,?)",
    createHash("sha256").update(state).digest("hex"),
    me.workspaceId,
    me.userId,
    provider,
    Date.now() + 600000,
  );
  return { url };
}
export async function completeSocialConnection(
  me: Identity,
  provider: SocialProvider,
  state: string,
  code: string,
) {
  transaction(() => {
    const found = run(
      "DELETE FROM social_oauth_states WHERE state_hash=? AND workspace_id=? AND user_id=? AND provider=? AND expires_at>?",
      createHash("sha256").update(state).digest("hex"),
      me.workspaceId,
      me.userId,
      provider,
      Date.now(),
    );
    if (!found.changes)
      throw new AppError(
        403,
        "This connection request expired or was already used. Start again from Automation.",
      );
  });
  const result = await exchangeSocialCode(provider, code),
    id = crypto.randomUUID();
  transaction(() => {
    for (const previous of all<{ id: string }>(
      "SELECT id FROM social_connections WHERE workspace_id=? AND provider=? AND account_id=? AND disconnected_at IS NULL",
      me.workspaceId,
      provider,
      result.accountId,
    ))
      disconnectSocial(me.workspaceId, previous.id);
    run(
      "INSERT INTO social_connections(id,workspace_id,provider,account_id,name,credentials,expires_at,disconnected_at,created_at) VALUES (?,?,?,?,?,?,?,NULL,?)",
      id,
      me.workspaceId,
      provider,
      result.accountId,
      result.name,
      sealCredentials(id, result.credentials),
      result.expiresAt,
      Date.now(),
    );
  });
}
export function disconnectSocial(workspace: string, id: string) {
  return transaction(() => {
    requireValue(
      one(
        "SELECT id FROM social_connections WHERE workspace_id=? AND id=?",
        workspace,
        id,
      ),
    );
    run(
      "UPDATE social_connections SET credentials='',disconnected_at=? WHERE id=?",
      Date.now(),
      id,
    );
    run(
      "UPDATE publications SET state=CASE WHEN state='processing' AND connection_id IN (SELECT id FROM social_connections WHERE provider='tiktok') THEN 'uncertain' ELSE 'cancelled' END,error='Account disconnected. An accepted platform submission may still finish; check the account.',updated_at=? WHERE connection_id=? AND state IN ('waiting_review','queued','processing') AND (lease_until IS NULL OR lease_until<?)",
      Date.now(),
      id,
      Date.now(),
    );
    return { ok: true };
  });
}
export async function freshSocialConnection(workspace: string, id: string) {
  let connection = getConnection(workspace, id),
    credentials = openCredentials(id, connection.credentials);
  if (connection.expiresAt > Date.now() + 3600000)
    return { connection, credentials };
  const owner = crypto.randomUUID();
  const claimed = run(
    "UPDATE social_connections SET refresh_until=?,refresh_owner=? WHERE id=? AND credentials=? AND disconnected_at IS NULL AND (refresh_until IS NULL OR refresh_until<?)",
    Date.now() + 60000,
    owner,
    id,
    connection.credentials,
    Date.now(),
  );
  if (!claimed.changes)
    throw new AppError(
      503,
      "Account credentials are being refreshed. Try again in a moment.",
    );
  try {
    const refreshed = await refreshSocialToken(
      connection.provider,
      credentials,
    );
    connection = getConnection(workspace, id);
    credentials = refreshed.credentials;
    const saved = run(
      "UPDATE social_connections SET credentials=?,expires_at=?,refresh_until=NULL,refresh_owner=NULL WHERE id=? AND refresh_owner=? AND refresh_until>? AND disconnected_at IS NULL",
      sealCredentials(id, credentials),
      refreshed.expiresAt,
      id,
      owner,
      Date.now(),
    );
    if (!saved.changes)
      throw new AppError(
        409,
        "Account authorization changed during refresh. Try again.",
      );
    return { connection: getConnection(workspace, id), credentials };
  } finally {
    run(
      "UPDATE social_connections SET refresh_until=NULL,refresh_owner=NULL WHERE id=? AND refresh_owner=?",
      id,
      owner,
    );
  }
}
export function validatePublishingPolicy(
  workspace: string,
  policy: PublishingPolicy | undefined,
  runLimit: number,
  expiresAt: number,
) {
  if (!policy) return;
  if (policy.automatic && runLimit === 1)
    throw new AppError(
      422,
      "The first guided run requires review before uploading.",
    );
  if (new Set(policy.connectionIds).size !== policy.connectionIds.length)
    throw new AppError(422, "Select each social account once.");
  const providers = new Set<string>();
  for (const id of policy.connectionIds) {
    const connection = getConnection(workspace, id);
    if (providers.has(connection.provider))
      throw new AppError(422, "Select one account per platform.");
    providers.add(connection.provider);
  }
  if (
    policy.startAt < Date.now() - 60000 ||
    policy.endAt > expiresAt ||
    policy.endAt <
      policy.startAt + (runLimit - 1) * policy.intervalMinutes * 60000
  )
    throw new AppError(
      422,
      "Choose a future window that fits every video and ends before agent access expires.",
    );
}
export function listPublications(workspace: string): Publication[] {
  return all(
    `${publicSelect} WHERE p.workspace_id=? ORDER BY p.created_at DESC LIMIT 100`,
    workspace,
  );
}
export function batchPublications(
  grantId: string,
  jobId: string,
): Publication[] {
  return all(
    `${publicSelect} WHERE p.grant_id=? AND p.job_id=? ORDER BY c.provider`,
    grantId,
    jobId,
  );
}
export function planPublications() {
  return transaction(() => {
    const completed = all<{
      id: string;
      workspaceId: string;
      grantId: string;
      policy: string;
      runs: number;
      revokedAt: number | null;
      expiresAt: number;
      projectId: string;
    }>(
      "SELECT j.id,j.workspace_id AS workspaceId,g.id AS grantId,g.policy,g.runs,g.revoked_at AS revokedAt,g.expires_at AS expiresAt,j.project_id AS projectId FROM agent_batch_items i JOIN agent_batches b ON b.id=i.batch_id JOIN agent_grants g ON g.id=b.grant_id JOIN jobs j ON j.id=i.job_id WHERE j.state='completed' AND NOT EXISTS (SELECT 1 FROM agent_batch_dispatch d WHERE d.job_id=j.id) ORDER BY b.created_at,i.position LIMIT 100",
    );
    for (const item of completed) {
      run("INSERT INTO agent_batch_dispatch VALUES (?)", item.id);
      if (item.revokedAt || item.expiresAt <= Date.now()) continue;
      const policy = publishingPolicySchema
        .nullable()
        .parse(JSON.parse(item.policy));
      if (!policy?.connectionIds.length) continue;
      const project = getProject(item.workspaceId, item.projectId);
      const output = one<{ assetId: string; revision: number }>(
        "SELECT asset_id AS assetId,revision FROM render_results WHERE job_id=? AND project_id=?",
        item.id,
        project.id,
      );
      if (
        !output ||
        project.revision !== output.revision ||
        project.renderedRevision !== output.revision ||
        project.outputAssetId !== output.assetId ||
        !["review", "approved", "scheduled"].includes(project.status)
      )
        continue;
      const ordinal = one<{ n: number }>(
        "SELECT COUNT(*) AS n FROM agent_batch_items i JOIN agent_batches b ON b.id=i.batch_id JOIN agent_batch_items target ON target.job_id=? JOIN agent_batches tb ON tb.id=target.batch_id WHERE b.grant_id=? AND (b.rowid<tb.rowid OR (b.id=tb.id AND i.position<target.position))",
        item.id,
        item.grantId,
      )!.n;
      for (const connectionId of policy.connectionIds) {
        const active = one<{ provider: string }>(
          "SELECT provider FROM social_connections WHERE id=? AND workspace_id=? AND disconnected_at IS NULL",
          connectionId,
          item.workspaceId,
        );
        if (!active) continue;
        if (policy.automatic && active.provider === "instagram")
          reviewProject(item.workspaceId, project.id, "approve");
        const scheduledAt =
            policy.startAt + ordinal * policy.intervalMinutes * 60000,
          now = Date.now();
        run(
          "INSERT INTO publications(id,workspace_id,grant_id,job_id,connection_id,project_id,revision,asset_id,caption,state,scheduled_at,deadline,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          crypto.randomUUID(),
          item.workspaceId,
          item.grantId,
          item.id,
          connectionId,
          project.id,
          output.revision,
          output.assetId,
          (project.description || project.title).slice(0, 2200),
          policy.automatic && active.provider === "instagram"
            ? "queued"
            : "waiting_review",
          scheduledAt,
          policy.endAt,
          now,
          now,
        );
      }
    }
  });
}
export function approvePublication(
  workspace: string,
  id: string,
  caption: string,
  postInfo?: TikTokPost,
  expectedRevision?: number,
) {
  return transaction(() => {
    const row = requireValue(
      one<{
        projectId: string;
        revision: number;
        state: string;
        grantId: string;
        connectionId: string;
      }>(
        "SELECT project_id AS projectId,revision,state,grant_id AS grantId,connection_id AS connectionId FROM publications WHERE workspace_id=? AND id=?",
        workspace,
        id,
      ),
    );
    if (row.state !== "waiting_review")
      throw new AppError(409, "This upload is no longer waiting for review.");
    if (
      !one(
        "SELECT p.id FROM publications p JOIN agent_grants g ON g.id=p.grant_id WHERE p.id=? AND p.deadline>? AND g.expires_at>? AND g.revoked_at IS NULL",
        id,
        Date.now(),
        Date.now(),
      )
    )
      throw new AppError(
        403,
        "This publishing authorization expired or was revoked.",
      );
    const connection = getConnection(workspace, row.connectionId);
    if (connection.provider === "tiktok" && !postInfo)
      throw new AppError(
        422,
        "Review TikTok privacy settings and confirm music usage before posting.",
      );
    const p = getProject(workspace, row.projectId);
    if (p.revision !== (expectedRevision ?? row.revision))
      throw new AppError(
        409,
        "This video changed. Render and authorize the current revision.",
      );
    reviewProject(workspace, row.projectId, "approve");
    run(
      "UPDATE publications SET caption=?,post_info=?,revision=?,asset_id=?,state='queued',updated_at=? WHERE id=?",
      caption,
      postInfo ? JSON.stringify(postInfo) : null,
      p.revision,
      p.outputAssetId,
      Date.now(),
      id,
    );
    return { ok: true };
  });
}
export async function publicationCreator(workspace: string, id: string) {
  const row = requireValue(
    one<{ connectionId: string; projectId: string; state: string }>(
      "SELECT connection_id AS connectionId,project_id AS projectId,state FROM publications WHERE workspace_id=? AND id=?",
      workspace,
      id,
    ),
  );
  if (row.state !== "waiting_review")
    throw new AppError(409, "This upload is no longer waiting for review.");
  const { connection, credentials } = await freshSocialConnection(
    workspace,
    row.connectionId,
  );
  if (connection.provider !== "tiktok")
    throw new AppError(422, "Creator settings apply to TikTok uploads.");
  const creator = await tikTokCreator(credentials.accessToken);
  return {
    creator,
    seconds: duration(getProject(workspace, row.projectId).timeline) / 30,
  };
}
export async function approveTikTokPublication(
  workspace: string,
  id: string,
  caption: string,
  postInfo: TikTokPost,
  expectedRevision?: number,
) {
  const { creator, seconds } = await publicationCreator(workspace, id);
  validateTikTokPost(creator, postInfo, seconds);
  return approvePublication(workspace, id, caption, postInfo, expectedRevision);
}
export function cancelPublication(workspace: string, id: string) {
  return transaction(() => {
    const row = requireValue(
      one<{ state: string; provider: string }>(
        "SELECT p.state,c.provider FROM publications p JOIN social_connections c ON c.id=p.connection_id WHERE p.workspace_id=? AND p.id=?",
        workspace,
        id,
      ),
    );
    if (row.state === "processing" && row.provider === "tiktok")
      throw new AppError(
        409,
        "TikTok has accepted this Direct Post. It cannot be cancelled here; check its status or remove it in TikTok.",
      );
    if (!["queued", "waiting_review", "processing"].includes(row.state))
      throw new AppError(
        409,
        "This submission has already started. Check its platform status before taking further action.",
      );
    const result = run(
      "UPDATE publications SET state='cancelled',updated_at=? WHERE workspace_id=? AND id=? AND (lease_until IS NULL OR lease_until<?)",
      Date.now(),
      workspace,
      id,
      Date.now(),
    );
    if (!result.changes)
      throw new AppError(
        409,
        "The publisher is handling this upload. Try again once its status updates.",
      );
    return { ok: true };
  });
}
export function publicationMediaUrl(id: string) {
  const expires = Date.now() + 6 * 3600000;
  const signature = createHmac("sha256", key())
    .update(`${id}:${expires}`)
    .digest("hex");
  return `${new URL(appUrl()).origin}/api/social/media/${id}?expires=${expires}&signature=${signature}`;
}
export function authorizePublicationMedia(
  id: string,
  expires: string | null,
  signature: string | null,
) {
  if (
    !expires ||
    !/^\d{13}$/.test(expires) ||
    Number(expires) < Date.now() ||
    Number(expires) > Date.now() + 6 * 3600000 ||
    !signature ||
    !/^\w{64}$/.test(signature)
  )
    throw new AppError(403, "This media link expired.");
  const expected = createHmac("sha256", key())
    .update(`${id}:${expires}`)
    .digest("hex");
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
    throw new AppError(403, "Invalid media link.");
  const row = requireValue(
    one<{
      workspaceId: string;
      assetId: string;
      state: string;
      grantId: string;
      connectionId: string;
      projectId: string;
      revision: number;
    }>(
      "SELECT workspace_id AS workspaceId,asset_id AS assetId,state,grant_id AS grantId,connection_id AS connectionId,project_id AS projectId,revision FROM publications WHERE id=?",
      id,
    ),
  );
  if (
    ![
      "uploading",
      "processing",
      "publishing",
      "published",
      "tiktok_inbox",
      "uncertain",
    ].includes(row.state)
  )
    throw new AppError(
      403,
      "This media is no longer available to the platform.",
    );
  const grant = one(
    "SELECT id FROM agent_grants WHERE id=? AND revoked_at IS NULL AND expires_at>?",
    row.grantId,
    Date.now(),
  );
  if (!grant) throw new AppError(403, "Publishing authorization expired.");
  const project = getProject(row.workspaceId, row.projectId);
  if (
    project.revision !== row.revision ||
    project.renderedRevision !== row.revision ||
    project.outputAssetId !== row.assetId ||
    !["approved", "scheduled"].includes(project.status)
  )
    throw new AppError(403, "The approved video changed.");
  getConnection(row.workspaceId, row.connectionId);
  return row;
}
