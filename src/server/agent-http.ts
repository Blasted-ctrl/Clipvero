import { z } from "zod";
import { AppError } from "./errors";
import { appUrl } from "./auth";
import { usesFastAPI } from "./backend";

export function agentBoundary(request: Request) {
  if (usesFastAPI())
    throw new AppError(
      503,
      "The personal automation pilot currently uses the video studio backend.",
    );
  const url = new URL(appUrl());
  if (request.headers.get("host") !== url.host)
    throw new AppError(403, "Request host does not match APP_URL.");
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin)
    throw new AppError(
      403,
      "This request must come from your Clipvero application.",
    );
}

export async function agentJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, "Send a JSON body.");
  const deadline = AbortSignal.any([
    request.signal,
    AbortSignal.timeout(10000),
  ]);
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  deadline.addEventListener("abort", abort, { once: true });
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      if (deadline.aborted) throw new AppError(408, "Request timed out.");
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 1024 * 1024) {
        await reader.cancel();
        throw new AppError(413, "Request exceeds 1 MB.");
      }
      chunks.push(part.value);
    }
    if (deadline.aborted) throw new AppError(408, "Request timed out.");
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new AppError(400, "Send valid JSON.");
    }
  } finally {
    deadline.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

export function agentError(error: unknown) {
  const status =
    error instanceof AppError
      ? error.status
      : error instanceof z.ZodError
        ? 422
        : 500;
  return Response.json(
    {
      error: {
        code: status === 401 ? "UNAUTHENTICATED" : "REQUEST_FAILED",
        message:
          error instanceof AppError
            ? error.message
            : error instanceof z.ZodError
              ? error.issues.map((issue) => issue.message).join(" ")
              : "The operation could not be completed.",
      },
      requestId: crypto.randomUUID(),
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(status === 401
          ? { "WWW-Authenticate": 'Bearer realm="Clipvero"' }
          : {}),
      },
    },
  );
}
