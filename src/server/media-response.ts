import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { dataDir } from "./db";
import { getAsset } from "./projects";

export async function mediaResponse(
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
