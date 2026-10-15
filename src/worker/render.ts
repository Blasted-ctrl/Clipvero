import { createServer, type Server } from "node:http";
import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { dataDir, one, run, transaction } from "../server/db";
import { getAsset } from "../server/projects";
import { recordRenderResult, stage, usage, type JobRow } from "../server/jobs";
import { probe } from "../server/media";
import {
  dimensions,
  duration,
  timelineSchema,
  type Timeline,
} from "../lib/model";
import type { MediaMap } from "../video/composition";

let bundled: Promise<string> | undefined;
let server: Server | undefined;
let serverUrl = "";
const token = randomBytes(32).toString("hex");
async function assetServer() {
  if (server) return serverUrl;
  server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      if (url.searchParams.get("token") !== token) {
        res.writeHead(403).end();
        return;
      }
      const id = url.pathname.slice(1);
      const asset = one<{ filename: string; mime: string }>(
        "SELECT filename,mime FROM assets WHERE id=?",
        id,
      );
      if (!asset) {
        res.writeHead(404).end();
        return;
      }
      const path = resolve(dataDir, "assets", asset.filename),
        info = await stat(path);
      const match = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
      const start = match ? Number(match[1]) : 0,
        end =
          match && match[2]
            ? Math.min(Number(match[2]), info.size - 1)
            : info.size - 1;
      if (start > end || start >= info.size) {
        res.writeHead(416).end();
        return;
      }
      res.writeHead(match ? 206 : 200, {
        "Content-Type": asset.mime,
        "Access-Control-Allow-Origin": "*",
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        ...(match
          ? { "Content-Range": `bytes ${start}-${end}/${info.size}` }
          : {}),
      });
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      createReadStream(path, { start, end })
        .on("error", () => res.destroy())
        .pipe(res);
    } catch {
      res.writeHead(500).end();
    }
  });
  await new Promise<void>((resolveReady) =>
    server!.listen(0, "127.0.0.1", resolveReady),
  );
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Could not start render asset server.");
  serverUrl = `http://127.0.0.1:${address.port}`;
  return serverUrl;
}
export async function renderProject(
  job: JobRow,
  timeline: Timeline,
  projectId: string,
  revision: number,
) {
  timelineSchema.parse(timeline);
  stage(job.id, "Composing scenes");
  bundled ??= bundle({
    entryPoint: resolve("src/video/root.tsx"),
    outDir: resolve(".render/bundle"),
    publicDir: null,
  });
  const serveUrl = await bundled;
  const base = await assetServer();
  const ids = new Set(
    timeline.scenes
      .flatMap((s) => [s.assetId, s.narrationId])
      .concat(timeline.musicAssetId)
      .filter((id): id is string => Boolean(id)),
  );
  const media: MediaMap = {};
  for (const id of ids) {
    const asset = getAsset(job.workspaceId, id);
    media[id] = { kind: asset.kind, src: `${base}/${id}?token=${token}` };
  }
  const inputProps = { timeline, media };
  const composition = await selectComposition({
    serveUrl,
    id: "Clipvero",
    inputProps,
  });
  const id = crypto.randomUUID(),
    filename = `${id}.mp4`,
    output = resolve(dataDir, "assets", filename);
  stage(job.id, "Rendering", 0);
  await renderMedia({
    composition,
    serveUrl,
    inputProps,
    codec: "h264",
    outputLocation: output,
    concurrency: 2,
    onProgress: ({ progress }) => stage(job.id, "Rendering", progress),
    chromiumOptions: { gl: "angle" },
  });
  stage(job.id, "Validating output");
  const metadata = await probe(output),
    size = (await stat(output)).size;
  const video = metadata.streams.find((s) => s.codec_type === "video");
  const expected = dimensions(timeline.aspect);
  if (
    !video ||
    video.width !== expected.width ||
    video.height !== expected.height ||
    Math.abs(Number(metadata.format.duration) - duration(timeline) / 30) >
      0.2 ||
    size < 1000
  )
    throw new Error(
      "Rendered media did not pass duration and dimension validation.",
    );
  transaction(() => {
    run(
      "INSERT INTO assets VALUES (?,?,?,?,?,?,?,?,?,?)",
      id,
      job.workspaceId,
      "Rendered video.mp4",
      filename,
      "video",
      "video/mp4",
      size,
      Number(metadata.format.duration),
      `Rendered by Clipvero from project ${projectId}, revision ${revision}.`,
      Date.now(),
    );
    recordRenderResult(job.id, projectId, id, revision);
  });
  usage(job, "rendering", duration(timeline) / 30, { assetId: id, revision });
}
export async function closeRenderer() {
  if (server) await new Promise<void>((r) => server!.close(() => r()));
}
