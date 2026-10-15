import { createHash, randomBytes } from "node:crypto";
import { grantSchema, batchSchema, type AgentGrant } from "@/lib/automation";
import {
  estimateCost,
  scriptTimeline,
  type CreateInput,
  type Project,
} from "@/lib/model";
import { all, one, run, transaction } from "./db";
import { AppError, requireValue } from "./errors";
import { checkProviders, enqueue, finishJob, getJob } from "./jobs";
import { getAsset, getProject, insertProject, renderCost } from "./projects";
import { appUrl, requirePilotWorkspace } from "./auth";
import { batchPublications, validatePublishingPolicy } from "./social";

export type Grant = AgentGrant & { workspaceId: string };
type GrantRow = Omit<Grant, "publishing"> & { policy: string };
const parseGrant = (row: GrantRow): Grant => {
  const { policy, ...grant } = row;
  return { ...grant, publishing: JSON.parse(policy) };
};
const grantSelect =
  "SELECT id,workspace_id AS workspaceId,name,run_limit AS runLimit,credit_limit AS creditLimit,runs,spent,policy,expires_at AS expiresAt,revoked_at AS revokedAt,created_at AS createdAt FROM agent_grants";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export function listGrants(workspace: string) {
  return all<GrantRow>(
    `${grantSelect} WHERE workspace_id=? ORDER BY created_at DESC LIMIT 100`,
    workspace,
  ).map((row) => ({
    ...parseGrant(row),
    expired: row.expiresAt <= Date.now(),
  }));
}

export function createGrant(workspace: string, data: unknown) {
  const input = grantSchema.parse(data);
  const expiresAt = Date.now() + input.expiresHours * 3600000;
  validatePublishingPolicy(
    workspace,
    input.publishing,
    input.runLimit,
    expiresAt,
  );
  const id = crypto.randomUUID(),
    token = `cv_${randomBytes(32).toString("hex")}`;
  run(
    "INSERT INTO agent_grants(id,workspace_id,name,token_hash,run_limit,credit_limit,policy,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    id,
    workspace,
    input.name,
    hash(token),
    input.runLimit,
    input.creditLimit,
    JSON.stringify(input.publishing ?? null),
    expiresAt,
    Date.now(),
  );
  return {
    grant: parseGrant(
      requireValue(one<GrantRow>(`${grantSelect} WHERE id=?`, id)),
    ),
    token,
  };
}

function liveGrant(id: string): Grant {
  const grant = parseGrant(
    requireValue(one<GrantRow>(`${grantSelect} WHERE id=?`, id)),
  );
  if (grant.revokedAt || grant.expiresAt <= Date.now())
    throw new AppError(401, "This agent access has expired or was revoked.");
  requirePilotWorkspace(grant.workspaceId);
  return grant;
}

export function authenticateAgent(request: Request): Grant {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (cv_[a-f0-9]{64})$/)?.[1];
  const row = token
    ? one<{ id: string }>(
        "SELECT id FROM agent_grants WHERE token_hash=?",
        hash(token),
      )
    : null;
  if (!row)
    throw new AppError(401, "Provide a valid Clipvero agent access token.");
  return liveGrant(row.id);
}

export function revokeGrant(workspace: string, id: string) {
  return transaction(() => {
    const grant = requireValue(
      one<Grant>(`${grantSelect} WHERE workspace_id=? AND id=?`, workspace, id),
    );
    run("UPDATE agent_grants SET revoked_at=? WHERE id=?", Date.now(), id);
    run(
      "UPDATE publications SET state=CASE WHEN state='processing' AND connection_id IN (SELECT id FROM social_connections WHERE provider='tiktok') THEN 'uncertain' ELSE 'cancelled' END,error='Agent access revoked. An accepted platform submission may still finish; check the account.',updated_at=? WHERE grant_id=? AND state IN ('queued','waiting_review','processing') AND (lease_until IS NULL OR lease_until<?)",
      Date.now(),
      id,
      Date.now(),
    );
    const jobs = all<{ id: string }>(
      "SELECT i.job_id AS id FROM agent_batch_items i JOIN agent_batches b ON b.id=i.batch_id JOIN jobs j ON j.id=i.job_id WHERE b.grant_id=? AND j.state='queued'",
      grant.id,
    );
    for (const job of jobs) {
      finishJob(
        getJob(workspace, job.id),
        "Agent access was revoked before this job started.",
      );
    }
    return { ok: true };
  });
}

function manual(input: CreateInput) {
  return (
    input.mode === "script" && input.voice === "none" && !input.generateImages
  );
}

function validateInput(workspace: string, input: CreateInput) {
  if (["clips", "gameplay"].includes(input.mode))
    throw new AppError(
      422,
      "Agent batches currently accept scripts, prompts, stories, explainers, marketing and character videos.",
    );
  if (input.sourceAssetId) getAsset(workspace, input.sourceAssetId);
  for (const id of input.characterIds)
    requireValue(
      one(
        "SELECT id FROM characters WHERE workspace_id=? AND id=?",
        workspace,
        id,
      ),
      "Character not found.",
    );
  if (input.presetId)
    requireValue(
      one(
        "SELECT id FROM presets WHERE workspace_id=? AND id=?",
        workspace,
        input.presetId,
      ),
      "Creator preset not found.",
    );
  if (!manual(input)) checkProviders(input);
}

export function createBatch(grantId: string, data: unknown) {
  const input = batchSchema.parse(data);
  const requestHash = hash(JSON.stringify(input));
  return transaction(() => {
    const grant = liveGrant(grantId);
    const previous = one<{ id: string; request_hash: string }>(
      "SELECT id,request_hash FROM agent_batches WHERE grant_id=? AND request_id=?",
      grant.id,
      input.requestId,
    );
    if (previous) {
      if (previous.request_hash !== requestHash)
        throw new AppError(
          409,
          "This request ID was already used for different videos.",
        );
      return getBatch(grant.id, previous.id);
    }
    if (grant.runs + input.videos.length > grant.runLimit)
      throw new AppError(
        403,
        "This run exceeds the video allowance you authorized. Create a new grant in Automation to increase it.",
      );
    input.videos.forEach((video) => validateInput(grant.workspaceId, video));
    const cost = input.videos.reduce(
      (total, video) =>
        total +
        (manual(video)
          ? renderCost(
              scriptTimeline(video.content, video.aspect, video.duration),
            )
          : estimateCost(video)),
      0,
    );
    if (grant.spent + cost > grant.creditLimit)
      throw new AppError(
        402,
        "This run exceeds the agent's authorized credit budget.",
      );
    const id = crypto.randomUUID();
    run(
      "INSERT INTO agent_batches VALUES (?,?,?,?,?,?)",
      id,
      grant.workspaceId,
      grant.id,
      input.requestId,
      requestHash,
      Date.now(),
    );
    input.videos.forEach((video, index) => {
      const project = manual(video)
        ? insertProject(grant.workspaceId, video)
        : null;
      const job = enqueue(
        grant.workspaceId,
        project ? "render" : "generate",
        `agent:${id}:${index}`,
        project?.id ?? null,
        project ? undefined : video,
      );
      run("INSERT INTO agent_batch_items VALUES (?,?,?)", id, index, job.id);
    });
    run(
      "UPDATE agent_grants SET runs=runs+?,spent=spent+? WHERE id=?",
      input.videos.length,
      cost,
      grant.id,
    );
    return getBatch(grant.id, id);
  });
}

export function getBatch(grantId: string, id: string) {
  const grant = liveGrant(grantId);
  const batch = requireValue(
    one<{ id: string; createdAt: number }>(
      "SELECT id,created_at AS createdAt FROM agent_batches WHERE grant_id=? AND id=?",
      grant.id,
      id,
    ),
  );
  const videos = all<{
    id: string;
    state: string;
    stage: string;
    error: string | null;
    projectId: string | null;
    cost: number;
    revision: number;
  }>(
    "SELECT j.id,j.state,j.stage,j.error,j.project_id AS projectId,j.cost,j.revision FROM agent_batch_items i JOIN jobs j ON j.id=i.job_id WHERE i.batch_id=? ORDER BY i.position",
    id,
  ).map((job) => {
    const project = job.projectId
      ? getProject(grant.workspaceId, job.projectId)
      : null;
    return {
      ...job,
      project,
      publications: batchPublications(grant.id, job.id),
      reviewUrl: project ? `${appUrl()}/editor/${project.id}` : null,
    };
  });
  return {
    ...batch,
    videos,
    complete: videos.every((video) =>
      ["completed", "failed"].includes(video.state),
    ),
  };
}

export function listBatches(grantId: string) {
  const grant = liveGrant(grantId);
  return all<{ id: string; createdAt: number }>(
    "SELECT id,created_at AS createdAt FROM agent_batches WHERE grant_id=? ORDER BY created_at DESC LIMIT 50",
    grant.id,
  );
}

export function getAgentProject(grantId: string, id: string): Project {
  const grant = liveGrant(grantId);
  requireValue(
    one(
      "SELECT i.job_id FROM agent_batch_items i JOIN agent_batches b ON b.id=i.batch_id JOIN jobs j ON j.id=i.job_id WHERE b.grant_id=? AND j.project_id=?",
      grant.id,
      id,
    ),
  );
  return getProject(grant.workspaceId, id);
}
