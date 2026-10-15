import { backendUrl, usesFastAPI } from "@/server/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function proxy(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const requestId = crypto.randomUUID();
  const fail = (status: number, code: string, message: string) =>
    Response.json(
      { error: { code, message }, requestId },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  if (!usesFastAPI())
    return fail(
      404,
      "FOUNDATION_DISABLED",
      "The workspace API is disabled in this development mode.",
    );
  if (path.some((part) => !/^[a-zA-Z0-9_-]+$/.test(part)))
    return fail(400, "INVALID_PATH", "Invalid API path.");
  const deadline = AbortSignal.any([
    AbortSignal.timeout(15000),
    request.signal,
  ]);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const cancelRead = () => {
    void reader?.cancel().catch(() => {});
  };
  deadline.addEventListener("abort", cancelRead, { once: true });
  try {
    const headers = new Headers();
    for (const name of ["cookie", "origin", "content-type"]) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    let body: Uint8Array | undefined;
    if (!["GET", "HEAD"].includes(request.method)) {
      reader = request.body?.getReader();
      if (deadline.aborted) cancelRead();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader)
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          size += next.value.length;
          if (size > 1024 * 1024) {
            await reader.cancel();
            return fail(413, "BODY_TOO_LARGE", "Request exceeds 1 MB.");
          }
          chunks.push(next.value);
        }
      body = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.length;
      }
      headers.set("Content-Length", String(size));
    }
    deadline.throwIfAborted();
    const upstream = await fetch(
      `${backendUrl()}/api/v1/${path.join("/")}${new URL(request.url).search}`,
      {
        method: request.method,
        headers,
        body: body as BodyInit | undefined,
        signal: deadline,
        redirect: "manual",
        cache: "no-store",
      },
    );
    const outgoing = new Headers({ "Cache-Control": "no-store" });
    for (const name of ["content-type", "x-request-id"]) {
      const value = upstream.headers.get(name);
      if (value) outgoing.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie())
      outgoing.append("Set-Cookie", cookie);
    return new Response(upstream.body, {
      status: upstream.status,
      headers: outgoing,
    });
  } catch {
    if (deadline.aborted)
      return fail(504, "API_TIMEOUT", "The request timed out. Please retry.");
    return fail(
      503,
      "API_UNAVAILABLE",
      "The workspace service is unavailable. Please retry.",
    );
  } finally {
    deadline.removeEventListener("abort", cancelRead);
  }
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE };
