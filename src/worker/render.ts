import { createServer, type Server } from "node:http";
import { randomBytes } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import {
  openBrowser,
  renderMedia,
  selectComposition,
} from "@remotion/renderer";
import { dataDir, one, run, transaction } from "../server/db";
import { getAsset } from "../server/projects";
import { recordRenderResult, stage, usage, type JobRow } from "../server/jobs";
import { binary, execute, probe } from "../server/media";
import {
  dimensions,
  duration,
  timelineSchema,
  type Timeline,
} from "../lib/model";
import { highlightTimelineCode } from "@clipvero/video-engine/code-tokens";
import {
  builtinMedia,
  type MediaMap,
} from "@clipvero/video-engine/composition";

let bundled: Promise<string> | undefined;
let browser: Awaited<ReturnType<typeof openBrowser>> | undefined;
let server: Server | undefined;
let serverUrl = "";
const token = randomBytes(32).toString("hex");
export async function prepareRenderer() {
  if (browser) {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        browser.connection.send("Target.setDiscoverTargets", {
          discover: true,
        }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("Render browser did not respond.")),
            3000,
          );
        }),
      ]);
      return browser;
    } catch {
      await closeRenderer();
    } finally {
      clearTimeout(timeout);
    }
  }
  browser ??= await openBrowser("chrome", {
    browserExecutable:
      process.env.REMOTION_BROWSER_EXECUTABLE?.trim() || undefined,
    chromiumOptions: { gl: "angle" },
  });
  return browser;
}
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
      const builtin = builtinMedia[id as keyof typeof builtinMedia];
      const asset = builtin
        ? { filename: resolve(`public${builtin}`), mime: "image/png" }
        : one<{ filename: string; mime: string }>(
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
    entryPoint: resolve("packages/video-engine/src/root.tsx"),
    outDir: resolve(`.render/bundle-${process.pid}`),
    publicDir: null,
  });
  const serveUrl = await bundled;
  const puppeteerInstance = await prepareRenderer();
  const base = await assetServer();
  const ids = new Set(
    timeline.scenes
      .flatMap((s) => [s.assetId, s.narrationId])
      .concat(
        timeline.musicAssetId,
        timeline.mascotAssetId,
        timeline.backgroundAssetId,
        ...timeline.speakers.map((s) => s.assetId),
      )
      .filter((id): id is string => Boolean(id)),
  );
  const media: MediaMap = {};
  for (const id of ids) {
    const asset = getAsset(job.workspaceId, id);
    media[id] = { kind: asset.kind, src: `${base}/${id}?token=${token}` };
  }
  // A missing built-in image (for example the owner's mascot, which is not in
  // the repository) is left out, and the composition draws its own instead.
  for (const [builtin, path] of Object.entries(builtinMedia))
    if (existsSync(resolve(`public${path}`)))
      media[builtin] = {
        kind: "image",
        src: `${base}/${builtin}?token=${token}`,
      };
  const code = await highlightTimelineCode(timeline);
  const inputProps = { timeline, media, code };
  const composition = await selectComposition({
    puppeteerInstance,
    serveUrl,
    id: "Clipvero",
    inputProps,
  });
  const id = crypto.randomUUID(),
    filename = `${id}.mp4`,
    output = resolve(dataDir, "assets", filename),
    rendered = resolve(dataDir, "assets", `${id}.render.mp4`);
  stage(job.id, "Rendering", 0);
  await renderMedia({
    puppeteerInstance,
    composition,
    serveUrl,
    inputProps,
    codec: "h264",
    // Instagram Reels expect AAC audio and limited-range 4:2:0 video.
    colorSpace: "bt709",
    enforceAudioTrack: true,
    outputLocation: rendered,
    concurrency: 2,
    onProgress: ({ progress }) => stage(job.id, "Rendering", progress),
  });
  await finalizeVideo(rendered, output, timeline);
  await unlink(rendered);
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
/** Keep video frames intact while preparing narration and the MP4 container. */
export async function finalizeVideo(
  input: string,
  output: string,
  timeline: Timeline,
) {
  const narratedExplainer =
    timeline.style === "explainer" &&
    timeline.scenes.some((scene) => scene.narrationId);
  // Instagram rejects edit lists. Normalizing the complete mix avoids volume
  // jumps between short narration scenes; silent/manual exports stay untouched.
  await execute(
    binary("ffmpeg"),
    [
      "-v",
      "error",
      "-y",
      "-i",
      input,
      "-map",
      "0",
      "-c:v",
      "copy",
      ...(narratedExplainer
        ? [
            "-af",
            "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-ar",
            "48000",
          ]
        : ["-c:a", "copy"]),
      "-use_editlist",
      "0",
      "-movflags",
      "+faststart",
      output,
    ],
    300_000,
  );
}
export async function closeRenderer() {
  const previousBrowser = browser;
  browser = undefined;
  await previousBrowser?.close({ silent: true });
  if (server) await new Promise<void>((r) => server!.close(() => r()));
  server = undefined;
  serverUrl = "";
}
