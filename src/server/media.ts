import { spawn } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { dataDir, run } from "./db";
import { AppError } from "./errors";
const require = createRequire(import.meta.url);
export function binary(name: "ffmpeg" | "ffprobe") {
  return (
    process.env[name === "ffmpeg" ? "FFMPEG_PATH" : "FFPROBE_PATH"] ||
    ((name === "ffmpeg"
      ? require("ffmpeg-static")
      : require("ffprobe-static").path) as string)
  );
}
export function execute(command: string, args: string[], timeout = 120000) {
  return new Promise<string>((resolveResult, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      timeout,
    });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-12000);
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolveResult(stdout)
        : reject(
            new Error(
              `${command.split(/[\\/]/).pop()} failed (${code}): ${stderr.slice(-1000)}`,
            ),
          ),
    );
  });
}
export async function probe(path: string) {
  const data = JSON.parse(
    await execute(binary("ffprobe"), [
      "-v",
      "error",
      "-show_format",
      "-show_streams",
      "-of",
      "json",
      path,
    ]),
  );
  return data as {
    format: { duration?: string };
    streams: {
      codec_type: string;
      width?: number;
      height?: number;
      codec_name: string;
    }[];
  };
}
const formats: Record<string, { kind: string; ext: string }> = {
  "image/png": { kind: "image", ext: "png" },
  "image/jpeg": { kind: "image", ext: "jpg" },
  "image/webp": { kind: "image", ext: "webp" },
  "video/mp4": { kind: "video", ext: "mp4" },
  "video/webm": { kind: "video", ext: "webm" },
  "video/quicktime": { kind: "video", ext: "mov" },
  "audio/mpeg": { kind: "audio", ext: "mp3" },
  "audio/wav": { kind: "audio", ext: "wav" },
  "audio/mp4": { kind: "audio", ext: "m4a" },
};
export async function storeMedia(
  workspace: string,
  bytes: Buffer,
  mime: string,
  name: string,
  provenance: string,
) {
  const type = formats[mime];
  if (!type || !bytes.length || bytes.length > 100 * 1024 * 1024)
    throw new AppError(
      400,
      "Choose a supported image, audio, or video file under 100 MB.",
    );
  const id = crypto.randomUUID(),
    filename = `${id}.${type.ext}`,
    path = resolve(dataDir, "assets", filename);
  await writeFile(path, bytes, { flag: "wx" });
  try {
    const result = await probe(path);
    const isVideo = result.streams.some((s) => s.codec_type === "video");
    const isAudio = result.streams.some((s) => s.codec_type === "audio");
    const visual = result.streams.find((s) => s.codec_type === "video");
    if (type.kind !== "audio" && (!visual?.width || !visual.height))
      throw new AppError(
        400,
        "The image or video could not be decoded with valid dimensions.",
      );
    if (
      ((type.kind === "image" || type.kind === "video") && !isVideo) ||
      (type.kind === "audio" && !isAudio)
    )
      throw new AppError(
        400,
        "The file contents do not match the selected media type.",
      );
    if (
      type.kind === "image" &&
      !["png", "mjpeg", "webp"].includes(result.streams[0]?.codec_name)
    )
      throw new AppError(400, "Upload a still PNG, JPEG, or WebP image.");
    if (type.kind === "image" && Number(result.format.duration || 0) > 0.2)
      throw new AppError(
        400,
        "Animated images are not supported. Upload a video instead.",
      );
    if (result.streams.some((s) => (s.width || 0) * (s.height || 0) > 40000000))
      throw new AppError(
        400,
        "This image or video exceeds the 40 megapixel limit.",
      );
    const duration =
      type.kind !== "image" && Number(result.format.duration) > 0
        ? Number(result.format.duration)
        : null;
    if (type.kind !== "image" && (!duration || duration > 14400))
      throw new AppError(
        400,
        "The media must have a valid duration under four hours.",
      );
    run(
      "INSERT INTO assets VALUES (?,?,?,?,?,?,?,?,?,?)",
      id,
      workspace,
      name.slice(0, 200),
      filename,
      type.kind,
      mime,
      bytes.length,
      duration,
      provenance.slice(0, 2000),
      Date.now(),
    );
    return { id, filename, duration, kind: type.kind };
  } catch (e) {
    await unlink(path).catch(() => {});
    if (e instanceof AppError) throw e;
    throw new AppError(
      400,
      "This file could not be read as supported media. Check its format and try another file.",
    );
  }
}
