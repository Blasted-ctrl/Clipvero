import { all, one, run, transaction } from "./db";
import { AppError, requireValue } from "./errors";
import { estimateCost, type CreateInput, type Job } from "../lib/model";
import { getProject, renderCost } from "./projects";

export type JobRow = Job & {
  workspaceId: string;
  input: string;
  leaseUntil: number | null;
};
const select =
  "SELECT id,workspace_id AS workspaceId,project_id AS projectId,pipeline_id AS pipelineId,kind,state,stage,progress,error,input,revision,cost,lease_until AS leaseUntil,created_at AS createdAt FROM jobs";
export function listJobs(workspace: string) {
  return all<JobRow>(
    `${select} WHERE workspace_id=? ORDER BY created_at DESC LIMIT 100`,
    workspace,
  ).map(
    ({
      input: _input,
      workspaceId: _workspaceId,
      leaseUntil: _leaseUntil,
      ...job
    }) => {
      void _input;
      void _workspaceId;
      void _leaseUntil;
      return job;
    },
  );
}
export function checkProviders(input: CreateInput) {
  if (!process.env.OPENAI_API_KEY)
    throw new AppError(
      503,
      "AI creation needs an OpenAI API key. Add OPENAI_API_KEY to .env and restart the web app and worker. Script videos work without a key.",
    );
  if (input.mode === "clips" && !input.sourceAssetId)
    throw new AppError(400, "Upload and select your source video first.");
}
export function enqueue(
  workspace: string,
  kind: "render" | "generate",
  key: string,
  projectId: string | null,
  input?: CreateInput,
  pipelineId: string | null = null,
) {
  if (kind === "generate") checkProviders(input!);
  return transaction(() => {
    const previous = one<JobRow>(
      `${select} WHERE workspace_id=? AND idempotency_key=?`,
      workspace,
      key,
    );
    if (previous) return previous;
    const project = projectId ? getProject(workspace, projectId) : null;
    if (
      project &&
      one(
        "SELECT id FROM jobs WHERE project_id=? AND state IN ('queued','running')",
        project.id,
      )
    )
      throw new AppError(409, "A job is already running for this project.");
    const cost =
      kind === "render" ? renderCost(project!.timeline) : estimateCost(input!);
    const wallet = requireValue(
      one<{ credits: number; subscription_status: string }>(
        "SELECT credits,subscription_status FROM workspaces WHERE id=?",
        workspace,
      ),
    );
    if (
      ["past_due", "unpaid", "incomplete_expired"].includes(
        wallet.subscription_status,
      )
    )
      throw new AppError(
        402,
        "Resolve your subscription payment before starting another job.",
      );
    if (wallet.credits < cost)
      throw new AppError(
        402,
        `This job needs ${cost} credits. You have ${wallet.credits}.`,
      );
    const id = crypto.randomUUID(),
      now = Date.now();
    run(
      "INSERT INTO jobs(id,workspace_id,project_id,pipeline_id,kind,input,revision,cost,idempotency_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      id,
      workspace,
      projectId,
      pipelineId,
      kind,
      JSON.stringify(
        kind === "render"
          ? { timeline: project!.timeline, title: project!.title }
          : input,
      ),
      project?.revision ?? 1,
      cost,
      key,
      now,
      now,
    );
    run("UPDATE workspaces SET credits=credits-? WHERE id=?", cost, workspace);
    run(
      "INSERT INTO credit_ledger VALUES (?,?,?,'reserve',?,?,?,?)",
      crypto.randomUUID(),
      workspace,
      id,
      -cost,
      `${kind} job`,
      `reserve:${id}`,
      now,
    );
    if (project)
      run(
        "UPDATE projects SET status='queued',updated_at=? WHERE id=?",
        now,
        project.id,
      );
    return requireValue(one<JobRow>(`${select} WHERE id=?`, id));
  });
}
export function claimJob() {
  return transaction(() => {
    const job = one<JobRow>(
      `${select} WHERE state='queued' ORDER BY created_at LIMIT 1`,
    );
    if (!job) return null;
    run(
      "UPDATE jobs SET state='running',stage='Preparing',lease_until=?,updated_at=? WHERE id=?",
      Date.now() + 120000,
      Date.now(),
      job.id,
    );
    if (job.projectId)
      run(
        "UPDATE projects SET status='rendering' WHERE id=? AND revision=?",
        job.projectId,
        job.revision,
      );
    return job;
  });
}
export function heartbeat(id: string) {
  run(
    "UPDATE jobs SET lease_until=?,updated_at=? WHERE id=? AND state='running'",
    Date.now() + 120000,
    Date.now(),
    id,
  );
}
export function stage(
  id: string,
  text: string,
  progress: number | null = null,
) {
  run(
    "UPDATE jobs SET stage=?,progress=?,updated_at=? WHERE id=? AND state='running'",
    text,
    progress,
    Date.now(),
    id,
  );
}
export function finishJob(job: JobRow, error?: string) {
  transaction(() => {
    const current = one<{ state: string; lease_until: number | null }>(
      "SELECT state,lease_until FROM jobs WHERE id=?",
      job.id,
    );
    if (current?.state !== "running" && current?.state !== "queued") return;
    if (
      !error &&
      (current.state !== "running" ||
        !current.lease_until ||
        current.lease_until < Date.now())
    )
      error =
        "The worker lease expired before completion. Credits were refunded; retry this job.";
    run(
      "UPDATE jobs SET state=?,stage=?,error=?,progress=?,lease_until=NULL,updated_at=? WHERE id=?",
      error ? "failed" : "completed",
      error ? "Failed" : "Ready for review",
      error ?? null,
      error ? null : 1,
      Date.now(),
      job.id,
    );
    if (error) {
      run(
        "UPDATE workspaces SET credits=credits+? WHERE id=?",
        job.cost,
        job.workspaceId,
      );
      run(
        "INSERT OR IGNORE INTO credit_ledger VALUES (?,?,?,'refund',?,?,?,?)",
        crypto.randomUUID(),
        job.workspaceId,
        job.id,
        job.cost,
        error,
        `refund:${job.id}`,
        Date.now(),
      );
      if (job.projectId)
        run(
          "UPDATE projects SET status='failed' WHERE id=? AND revision=?",
          job.projectId,
          job.revision,
        );
      run(
        "UPDATE projects SET status='failed' WHERE id IN (SELECT project_id FROM render_results WHERE job_id=? AND revision=projects.revision)",
        job.id,
      );
    } else {
      for (const output of all<{
        project_id: string;
        asset_id: string;
        revision: number;
      }>(
        "SELECT project_id,asset_id,revision FROM render_results WHERE job_id=?",
        job.id,
      ))
        run(
          "UPDATE projects SET output_asset_id=?,rendered_revision=?,status='review',updated_at=? WHERE id=? AND revision=?",
          output.asset_id,
          output.revision,
          Date.now(),
          output.project_id,
          output.revision,
        );
      run(
        "INSERT OR IGNORE INTO credit_ledger VALUES (?,?,?,'capture',0,?,?,?)",
        crypto.randomUUID(),
        job.workspaceId,
        job.id,
        "Reserved credits consumed",
        `capture:${job.id}`,
        Date.now(),
      );
    }
  });
}
export function recordRenderResult(
  jobId: string,
  projectId: string,
  assetId: string,
  revision: number,
) {
  const lease = one<{ state: string; lease_until: number }>(
    "SELECT state,lease_until FROM jobs WHERE id=?",
    jobId,
  );
  if (!lease || lease.state !== "running" || lease.lease_until < Date.now())
    throw new AppError(
      409,
      "This job no longer owns a live worker lease. Its output was discarded.",
    );
  run(
    "INSERT INTO render_results VALUES (?,?,?,?)",
    jobId,
    projectId,
    assetId,
    revision,
  );
}
export function recoverExpiredJobs() {
  all<JobRow>(
    `${select} WHERE state='running' AND lease_until<?`,
    Date.now(),
  ).forEach((j) =>
    finishJob(
      j,
      "The worker stopped before this job completed. Credits were refunded. Retry when the worker is running.",
    ),
  );
}
export function retryJob(workspace: string, id: string, key: string) {
  const job = requireValue(
    one<JobRow>(`${select} WHERE workspace_id=? AND id=?`, workspace, id),
  );
  if (job.state !== "failed")
    throw new AppError(409, "Only failed jobs can be retried.");
  return enqueue(
    workspace,
    job.kind as "render" | "generate",
    key,
    job.kind === "generate" ? null : job.projectId,
    job.kind === "generate" ? JSON.parse(job.input) : undefined,
  );
}
export function usage(
  job: JobRow,
  category: string,
  units: number,
  metadata: object = {},
) {
  run(
    "INSERT INTO usage_events VALUES (?,?,?,?,?,?,?)",
    crypto.randomUUID(),
    job.workspaceId,
    job.id,
    category,
    units,
    JSON.stringify(metadata),
    Date.now(),
  );
}
