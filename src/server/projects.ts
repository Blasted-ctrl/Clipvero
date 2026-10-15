import { all, one, run, transaction } from "./db";
import { AppError, requireValue } from "./errors";
import {
  createSchema,
  duration,
  scriptTimeline,
  timelineSchema,
  type Asset,
  type CreateInput,
  type Project,
  type Timeline,
} from "../lib/model";

type ProjectRow = Omit<Project, "timeline"> & { timeline: string };
const projectSelect =
  "SELECT id,title,mode,status,timeline,revision,rendered_revision AS renderedRevision,output_asset_id AS outputAssetId,description,scheduled_at AS scheduledAt,created_at AS createdAt,updated_at AS updatedAt FROM projects";
function parseProject(row: ProjectRow): Project {
  return { ...row, timeline: timelineSchema.parse(JSON.parse(row.timeline)) };
}
export function listProjects(workspace: string) {
  return all<ProjectRow>(
    `${projectSelect} WHERE workspace_id=? ORDER BY updated_at DESC LIMIT 200`,
    workspace,
  ).map(parseProject);
}
export function getProject(workspace: string, id: string) {
  return parseProject(
    requireValue(
      one<ProjectRow>(
        `${projectSelect} WHERE workspace_id=? AND id=?`,
        workspace,
        id,
      ),
    ),
  );
}
export function getAsset(workspace: string, id: string) {
  return requireValue(
    one<Asset & { filename: string }>(
      "SELECT id,name,kind,mime,filename,bytes,duration,provenance,created_at AS createdAt FROM assets WHERE workspace_id=? AND id=? AND NOT EXISTS (SELECT 1 FROM render_results rr JOIN jobs j ON j.id=rr.job_id WHERE rr.asset_id=assets.id AND j.state!='completed')",
      workspace,
      id,
    ),
  );
}
export function listAssets(workspace: string) {
  return all<Asset>(
    "SELECT id,name,kind,mime,bytes,duration,provenance,created_at AS createdAt FROM assets WHERE workspace_id=? AND NOT EXISTS (SELECT 1 FROM render_results rr JOIN jobs j ON j.id=rr.job_id WHERE rr.asset_id=assets.id AND j.state!='completed') ORDER BY created_at DESC LIMIT 200",
    workspace,
  );
}
export function validateAssets(workspace: string, timeline: Timeline) {
  const check = (id: string, kinds: string[]) => {
    const asset = getAsset(workspace, id);
    if (!kinds.includes(asset.kind))
      throw new AppError(400, "That media type cannot be used in this track.");
    return asset;
  };
  if (timeline.musicAssetId) check(timeline.musicAssetId, ["audio"]);
  timeline.scenes.forEach((s) => {
    if (s.assetId) {
      const asset = check(s.assetId, ["video", "image"]);
      if (
        asset.kind === "video" &&
        asset.duration != null &&
        s.mediaStart + s.durationFrames / 30 > asset.duration + 0.05
      )
        throw new AppError(
          400,
          "A scene extends past the end of its source footage. Trim it or choose longer footage.",
        );
    }
    if (s.narrationId) {
      const asset = check(s.narrationId, ["audio"]);
      if (
        asset.duration != null &&
        s.durationFrames / 30 + 0.05 < asset.duration
      )
        throw new AppError(
          400,
          "The scene is shorter than its narration. Extend the scene before saving.",
        );
    }
  });
}
export function insertProject(
  workspace: string,
  input: CreateInput,
  timeline?: Timeline,
) {
  const data = createSchema.parse(input);
  const model =
    timeline ?? scriptTimeline(data.content, data.aspect, data.duration);
  if (data.sourceAssetId && !timeline)
    model.scenes.forEach((s) => {
      s.assetId = data.sourceAssetId!;
    });
  if (data.presetId) {
    const preset = requireValue(
      one<{ data: string }>(
        "SELECT data FROM presets WHERE workspace_id=? AND id=?",
        workspace,
        data.presetId,
      ),
    );
    const p = JSON.parse(preset.data);
    Object.assign(model, {
      accentColor: p.accentColor,
      captionColor: p.captionColor,
      fontSize: p.fontSize,
      captionPosition: p.captionPosition,
    });
  }
  validateAssets(workspace, model);
  const id = crypto.randomUUID(),
    now = Date.now();
  run(
    "INSERT INTO projects(id,workspace_id,title,mode,timeline,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
    id,
    workspace,
    data.title,
    data.mode,
    JSON.stringify(model),
    now,
    now,
  );
  return getProject(workspace, id);
}
export function saveProject(
  workspace: string,
  id: string,
  title: string,
  timeline: Timeline,
  expectedRevision: number,
) {
  const model = timelineSchema.parse(timeline);
  validateAssets(workspace, model);
  const changed = run(
    "UPDATE projects SET title=?,timeline=?,revision=revision+1,status='draft',scheduled_at=NULL,updated_at=? WHERE workspace_id=? AND id=? AND revision=?",
    title,
    JSON.stringify(model),
    Date.now(),
    workspace,
    id,
    expectedRevision,
  );
  if (!changed.changes) {
    getProject(workspace, id);
    throw new AppError(
      409,
      "This project changed in another tab. Reload it before saving.",
    );
  }
  return getProject(workspace, id);
}
export function reviewProject(
  workspace: string,
  id: string,
  action: "approve" | "reject" | "schedule",
  scheduledAt?: number,
) {
  return transaction(() => {
    const p = getProject(workspace, id);
    if (action === "reject") {
      run(
        "UPDATE projects SET status='draft',scheduled_at=NULL,updated_at=? WHERE id=?",
        Date.now(),
        id,
      );
      return getProject(workspace, id);
    }
    if (
      !p.outputAssetId ||
      p.renderedRevision !== p.revision ||
      !["review", "approved", "scheduled"].includes(p.status)
    )
      throw new AppError(
        409,
        "Render the current version before approving or scheduling it.",
      );
    if (
      action === "schedule" &&
      (p.status === "review" || !scheduledAt || scheduledAt <= Date.now())
    )
      throw new AppError(
        400,
        "Approve this video and select a future reminder time first.",
      );
    run(
      "UPDATE projects SET status=?,scheduled_at=?,updated_at=? WHERE id=?",
      action === "approve" ? "approved" : "scheduled",
      action === "schedule" ? scheduledAt! : null,
      Date.now(),
      id,
    );
    return getProject(workspace, id);
  });
}
export function renderCost(t: Timeline) {
  return Math.max(1, Math.ceil(duration(t) / (30 * 60)));
}
