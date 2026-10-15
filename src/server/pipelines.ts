import { all, one, run, transaction } from "./db";
import { AppError, requireValue } from "./errors";
import { checkProviders, enqueue } from "./jobs";
import {
  createSchema,
  estimateCost,
  pipelineSchema,
  type Pipeline,
} from "../lib/model";

type Row = Omit<Pipeline, "config" | "active"> & {
  config: string;
  active: number;
};
const select =
  "SELECT id,name,config,interval_hours AS intervalHours,max_runs AS maxRuns,budget,active,next_run AS nextRun,runs,spent FROM pipelines";
function parse(row: Row): Pipeline {
  return {
    ...row,
    config: createSchema.parse(JSON.parse(row.config)),
    active: Boolean(row.active),
  };
}
export function listPipelines(workspace: string) {
  return all<Row>(
    `${select} WHERE workspace_id=? ORDER BY created_at DESC`,
    workspace,
  ).map(parse);
}
export function getPipeline(workspace: string, id: string) {
  return parse(
    requireValue(
      one<Row>(`${select} WHERE workspace_id=? AND id=?`, workspace, id),
    ),
  );
}
export function createPipeline(workspace: string, data: unknown) {
  const p = pipelineSchema.parse(data);
  if (
    p.config.mode === "script" ||
    p.config.mode === "gameplay" ||
    p.config.mode === "clips"
  )
    throw new AppError(
      400,
      "Recurring pipelines currently support AI-written prompts, stories, explainers, products, and characters. Create manual scripts and clips from the Create page.",
    );
  const id = crypto.randomUUID();
  run(
    "INSERT INTO pipelines(id,workspace_id,name,config,interval_hours,max_runs,budget,next_run,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    id,
    workspace,
    p.name,
    JSON.stringify(p.config),
    p.intervalHours,
    p.maxRuns,
    p.budget,
    Date.now() + p.intervalHours * 3600000,
    Date.now(),
  );
  return getPipeline(workspace, id);
}
export function runPipeline(
  workspace: string,
  id: string,
  key: string,
  scheduled = false,
) {
  return transaction(() => {
    const p = getPipeline(workspace, id);
    const previous = one<{ id: string }>(
      "SELECT id FROM jobs WHERE workspace_id=? AND idempotency_key=?",
      workspace,
      key,
    );
    if (previous) return previous;
    if (scheduled && (!p.active || p.nextRun > Date.now())) return null;
    checkProviders(p.config);
    const cost = estimateCost(p.config);
    if (p.runs >= p.maxRuns || p.spent + cost > p.budget)
      throw new AppError(
        402,
        "This autopilot reached its run or credit limit. Increase its limits to continue.",
      );
    if (
      one(
        "SELECT id FROM jobs WHERE pipeline_id=? AND state IN ('queued','running')",
        id,
      )
    )
      throw new AppError(409, "This autopilot already has a run in progress.");
    const job = enqueue(workspace, "generate", key, null, p.config, id);
    run(
      "UPDATE pipelines SET runs=runs+1,spent=spent+?,next_run=? WHERE id=?",
      cost,
      Date.now() + p.intervalHours * 3600000,
      id,
    );
    return job;
  });
}
export function tickPipelines() {
  const due = all<{ id: string; workspace_id: string; next_run: number }>(
    "SELECT id,workspace_id,next_run FROM pipelines WHERE active=1 AND next_run<=?",
    Date.now(),
  );
  for (const p of due) {
    try {
      runPipeline(p.workspace_id, p.id, `schedule:${p.id}:${p.next_run}`, true);
    } catch (error) {
      run("UPDATE pipelines SET active=0 WHERE id=?", p.id);
      run(
        "INSERT OR REPLACE INTO system_state VALUES (?,?)",
        `pipeline_error:${p.id}`,
        error instanceof Error
          ? error.message
          : "Autopilot paused after an unexpected error.",
      );
    }
  }
}
