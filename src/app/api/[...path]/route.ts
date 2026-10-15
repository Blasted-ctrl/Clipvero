import { NextResponse } from "next/server";
import { z } from "zod";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { resolve } from "node:path";
import { all, dataDir, one, run } from "@/server/db";
import {
  appUrl,
  checkOrigin,
  createSession,
  identity,
  login,
  loginLimitKey,
  logout,
  rateLimit,
  register,
  requireIdentity,
} from "@/server/auth";
import { AppError, requireValue } from "@/server/errors";
import {
  characterSchema,
  createSchema,
  modeSchema,
  presetSchema,
  timelineSchema,
} from "@/lib/model";
import {
  getAsset,
  getProject,
  insertProject,
  listAssets,
  listProjects,
  reviewProject,
  saveProject,
} from "@/server/projects";
import { enqueue, listJobs, retryJob } from "@/server/jobs";
import {
  createPipeline,
  getPipeline,
  listPipelines,
  runPipeline,
} from "@/server/pipelines";
import { storeMedia } from "@/server/media";
import {
  billingHistory,
  checkout,
  handleWebhook,
  portal,
} from "@/server/billing";
import { applyEdits, parseQuickEdit } from "@/lib/edit-operations";
import { planTextEdit } from "@/server/providers";
import { validateAssets } from "@/server/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const authSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((s) => s.toLowerCase().trim()),
  password: z.string().min(12).max(128),
  name: z.string().trim().min(1).max(80).optional(),
});
async function json(request: Request) {
  const raw = await request.text();
  if (raw.length > 250000) throw new AppError(413, "The request is too large.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new AppError(400, "Send valid JSON.");
  }
}
function key(request: Request) {
  return z.string().uuid().parse(request.headers.get("Idempotency-Key"));
}
function parseRows(table: "characters" | "presets", workspace: string) {
  return all<{ id: string; data: string }>(
    `SELECT id,data FROM ${table} WHERE workspace_id=? ORDER BY created_at DESC`,
    workspace,
  ).map((r) => ({ ...JSON.parse(r.data), id: r.id }));
}
async function mediaResponse(
  request: Request,
  workspace: string,
  id: string,
  download = false,
) {
  const asset = getAsset(workspace, id),
    path = resolve(dataDir, "assets", asset.filename),
    info = await stat(path);
  const range = request.headers.get("range");
  const match = range?.match(/^bytes=(\d+)-(\d*)$/);
  if (range && !match)
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${info.size}` },
    });
  const start = match ? Number(match[1]) : 0,
    end =
      match && match[2]
        ? Math.min(Number(match[2]), info.size - 1)
        : info.size - 1;
  if (start > end || start >= info.size)
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${info.size}` },
    });
  return new Response(
    request.method === "HEAD"
      ? null
      : (Readable.toWeb(
          createReadStream(path, { start, end }),
        ) as ReadableStream),
    {
      status: match ? 206 : 200,
      headers: {
        "Content-Type": asset.mime,
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store",
        ...(match
          ? { "Content-Range": `bytes ${start}-${end}/${info.size}` }
          : {}),
        ...(download
          ? {
              "Content-Disposition":
                'attachment; filename="clipvero-video.mp4"',
            }
          : {}),
      },
    },
  );
}
async function handle(request: Request, context: Context) {
  try {
    const { path } = await context.params;
    const route = path.join("/"),
      method = request.method;
    if (route === "webhooks/stripe" && method === "POST") {
      await handleWebhook(
        await request.text(),
        request.headers.get("stripe-signature") || "",
      );
      return NextResponse.json({ received: true });
    }
    if (!["GET", "HEAD"].includes(method)) checkOrigin(request);
    if (route === "auth/session" && method === "GET")
      return NextResponse.json({ user: await identity() });
    if (route === "auth/logout" && method === "POST") {
      await logout();
      return NextResponse.json({ ok: true });
    }
    if (
      (route === "auth/register" || route === "auth/login") &&
      method === "POST"
    ) {
      const data = authSchema.parse(await json(request));
      rateLimit(`auth:${loginLimitKey(data.email)}`, 10, 15 * 60000);
      if (route === "auth/register")
        rateLimit("registration:global", 20, 60 * 60000);
      const userId =
        route === "auth/register"
          ? register(
              data.email,
              data.name || data.email.split("@")[0],
              data.password,
            )
          : login(data.email, data.password);
      await createSession(userId);
      return NextResponse.json({ ok: true });
    }
    const me = await requireIdentity(),
      ws = me.workspaceId;
    if (route === "state" && method === "GET") {
      const beat = one<{ value: string }>(
        "SELECT value FROM system_state WHERE key='worker_heartbeat'",
      );
      return NextResponse.json({
        me,
        projects: listProjects(ws),
        jobs: listJobs(ws),
        assets: listAssets(ws),
        characters: parseRows("characters", ws),
        presets: parseRows("presets", ws),
        pipelines: listPipelines(ws),
        ledger: billingHistory(ws),
        usage: all(
          "SELECT category,SUM(units) AS units FROM usage_events WHERE workspace_id=? GROUP BY category",
          ws,
        ),
        pipelineErrors: listPipelines(ws)
          .map((p) => ({
            id: p.id,
            error: one<{ value: string }>(
              "SELECT value FROM system_state WHERE key=?",
              `pipeline_error:${p.id}`,
            )?.value,
          }))
          .filter((p) => p.error),
        capabilities: {
          ai: Boolean(process.env.OPENAI_API_KEY),
          billing: Boolean(
            process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET,
          ),
          worker: Boolean(beat && Date.now() - Number(beat.value) < 60000),
          publishing: false,
        },
        appName: process.env.APP_NAME || "Clipvero",
      });
    }
    if (route === "projects" && method === "POST") {
      const input = createSchema.parse(await json(request));
      if (input.mode !== "script" && input.mode !== "gameplay")
        throw new AppError(400, "Use the generation endpoint for AI creation.");
      if (input.voice !== "none")
        throw new AppError(
          400,
          "Add your own narration in the editor. AI narration for supplied scripts is not available yet.",
        );
      if (input.mode === "gameplay" && !input.sourceAssetId)
        throw new AppError(400, "Select your licensed gameplay footage first.");
      return NextResponse.json(insertProject(ws, input), { status: 201 });
    }
    if (route === "generate" && method === "POST") {
      rateLimit(`generate:${ws}`, 20, 60000);
      const input = createSchema.parse(await json(request));
      if (
        ["script", "gameplay"].includes(input.mode) &&
        input.voice === "none" &&
        !input.generateImages
      )
        throw new AppError(400, "Save a script project first.");
      return NextResponse.json(
        { id: enqueue(ws, "generate", key(request), null, input).id },
        { status: 202 },
      );
    }
    if (path[0] === "projects" && path[1]) {
      const id = z.string().uuid().parse(path[1]);
      if (path.length === 2 && method === "GET")
        return NextResponse.json(getProject(ws, id));
      if (path.length === 2 && method === "PATCH") {
        const data = z
          .object({
            title: z.string().trim().min(1).max(120),
            timeline: timelineSchema,
            revision: z.number().int().positive(),
          })
          .parse(await json(request));
        return NextResponse.json(
          saveProject(ws, id, data.title, data.timeline, data.revision),
        );
      }
      if (path[2] === "render" && method === "POST")
        return NextResponse.json(
          { id: enqueue(ws, "render", key(request), id).id },
          { status: 202 },
        );
      if (path[2] === "edit-plan" && method === "POST") {
        rateLimit(`edit:${ws}`, 10, 60000);
        const { command } = z
          .object({ command: z.string().trim().min(1).max(1000) })
          .parse(await json(request));
        const project = getProject(ws, id);
        let operations;
        try {
          operations = process.env.OPENAI_API_KEY
            ? await planTextEdit(command, project.timeline.scenes.length)
            : parseQuickEdit(command);
        } catch (e) {
          if (e instanceof AppError) throw e;
          throw new AppError(
            400,
            e instanceof Error ? e.message : "This edit is not supported.",
          );
        }
        const timeline = applyEdits(project.timeline, operations);
        validateAssets(ws, timeline);
        return NextResponse.json({
          timeline,
          operations,
          revision: project.revision,
        });
      }
      if (path[2] === "review" && method === "POST") {
        const data = z
          .object({
            action: z.enum(["approve", "reject", "schedule"]),
            scheduledAt: z.number().optional(),
          })
          .parse(await json(request));
        return NextResponse.json(
          reviewProject(ws, id, data.action, data.scheduledAt),
        );
      }
      if (path[2] === "download" && ["GET", "HEAD"].includes(method)) {
        const p = getProject(ws, id);
        if (!p.outputAssetId || p.renderedRevision !== p.revision)
          throw new AppError(
            409,
            "Render the current version before downloading.",
          );
        return await mediaResponse(request, ws, p.outputAssetId, true);
      }
      if (path[2] === "duplicate" && method === "POST") {
        const p = getProject(ws, id);
        return NextResponse.json(
          insertProject(
            ws,
            createSchema.parse({
              title: `${p.title} (copy)`.slice(0, 120),
              mode: p.mode,
              content: "Copy",
              rightsConfirmed: true,
            }),
            p.timeline,
          ),
        );
      }
    }
    if (path[0] === "jobs" && path[2] === "retry" && method === "POST")
      return NextResponse.json({
        id: retryJob(ws, z.string().uuid().parse(path[1]), key(request)).id,
      });
    if (route === "assets" && method === "POST") {
      rateLimit(`upload:${ws}`, 30, 60000);
      const length = Number(request.headers.get("content-length"));
      if (!length || length > 101 * 1024 * 1024)
        throw new AppError(
          413,
          "Upload a file under 100 MB with a Content-Length header.",
        );
      const form = await request.formData(),
        file = form.get("file"),
        rights = form.get("rightsConfirmed"),
        provenance = String(form.get("provenance") || "").trim();
      if (!(file instanceof File) || rights !== "true" || !provenance)
        throw new AppError(
          400,
          "Choose a file and confirm its ownership or license.",
        );
      return NextResponse.json(
        await storeMedia(
          ws,
          Buffer.from(await file.arrayBuffer()),
          file.type,
          file.name,
          provenance,
        ),
        { status: 201 },
      );
    }
    if (path[0] === "assets" && path[1] && ["GET", "HEAD"].includes(method))
      return await mediaResponse(request, ws, z.string().uuid().parse(path[1]));
    if (["characters", "presets"].includes(path[0])) {
      const table = path[0] as "characters" | "presets";
      if (path.length === 1 && method === "POST") {
        const data = (
          table === "characters" ? characterSchema : presetSchema
        ).parse(await json(request));
        if (
          "referenceAssetId" in data &&
          data.referenceAssetId &&
          getAsset(ws, data.referenceAssetId).kind !== "image"
        )
          throw new AppError(
            400,
            "Choose an image for the approved visual reference.",
          );
        const id = crypto.randomUUID();
        run(
          `INSERT INTO ${table} VALUES (?,?,?,?)`,
          id,
          ws,
          JSON.stringify(data),
          Date.now(),
        );
        return NextResponse.json({ ...data, id });
      }
      if (path[1] && method === "DELETE") {
        requireValue(
          one(
            `SELECT id FROM ${table} WHERE workspace_id=? AND id=?`,
            ws,
            path[1],
          ),
        );
        run(`DELETE FROM ${table} WHERE workspace_id=? AND id=?`, ws, path[1]);
        return NextResponse.json({ ok: true });
      }
    }
    if (route === "pipelines" && method === "POST")
      return NextResponse.json(createPipeline(ws, await json(request)), {
        status: 201,
      });
    if (path[0] === "pipelines" && path[1]) {
      const p = getPipeline(ws, z.string().uuid().parse(path[1]));
      if (path[2] === "run" && method === "POST")
        return NextResponse.json(runPipeline(ws, p.id, key(request)));
      if (path[2] === "duplicate" && method === "POST")
        return NextResponse.json(
          createPipeline(ws, { ...p, name: `${p.name} (copy)`.slice(0, 100) }),
        );
      if (method === "PATCH") {
        const data = z
          .object({
            active: z.boolean().optional(),
            name: z.string().trim().min(1).max(100).optional(),
            maxRuns: z.number().int().min(1).max(120).optional(),
            budget: z.number().int().min(1).max(1200).optional(),
          })
          .parse(await json(request));
        if (data.active && !process.env.OPENAI_API_KEY)
          throw new AppError(
            503,
            "Configure OPENAI_API_KEY before activating an autopilot.",
          );
        run(
          "UPDATE pipelines SET active=?,name=?,max_runs=?,budget=? WHERE id=?",
          data.active == null ? Number(p.active) : Number(data.active),
          data.name ?? p.name,
          data.maxRuns ?? p.maxRuns,
          data.budget ?? p.budget,
          p.id,
        );
        if (data.active)
          run("DELETE FROM system_state WHERE key=?", `pipeline_error:${p.id}`);
        return NextResponse.json(getPipeline(ws, p.id));
      }
      if (method === "DELETE") {
        if (one("SELECT id FROM jobs WHERE pipeline_id=?", p.id)) {
          run("UPDATE pipelines SET active=0 WHERE id=?", p.id);
          throw new AppError(
            409,
            "Autopilots with job history are retained for accounting. This autopilot is now paused.",
          );
        }
        run("DELETE FROM pipelines WHERE id=?", p.id);
        return NextResponse.json({ ok: true });
      }
    }
    if (route === "settings" && method === "PATCH") {
      const data = z
        .object({
          name: z.string().trim().min(1).max(80),
          workspaceName: z.string().trim().min(1).max(100),
        })
        .parse(await json(request));
      run("UPDATE users SET name=? WHERE id=?", data.name, me.userId);
      run("UPDATE workspaces SET name=? WHERE id=?", data.workspaceName, ws);
      return NextResponse.json({ ok: true });
    }
    if (route === "billing/checkout" && method === "POST") {
      const data = z
        .object({ plan: z.enum(["starter", "creator", "studio"]) })
        .parse(await json(request));
      return NextResponse.json(await checkout(me, data.plan));
    }
    if (route === "billing/portal" && method === "POST")
      return NextResponse.json(await portal(me));
    if (route === "health" && method === "GET")
      return NextResponse.json({
        ok: true,
        origin: new URL(appUrl()).origin,
        supportedModes: modeSchema.options,
      });
    throw new AppError(404, "That endpoint does not exist.");
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error: error.issues
            .map((i) => `${i.path.join(".") || "Input"}: ${i.message}`)
            .join(" "),
        },
        { status: 400 },
      );
    if (error instanceof AppError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    console.error(
      JSON.stringify({
        event: "api.error",
        message: error instanceof Error ? error.message : "Unexpected error",
      }),
    );
    return NextResponse.json(
      {
        error:
          "Something went wrong. Your saved work is safe. Retry or check the server logs.",
      },
      { status: 500 },
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
