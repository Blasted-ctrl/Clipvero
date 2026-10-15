import { usesFastAPI } from "@/server/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  if (usesFastAPI())
    return Response.json(
      {
        error: {
          code: "LEGACY_DISABLED",
          message: "Use the versioned workspace API.",
        },
        requestId: crypto.randomUUID(),
      },
      { status: 404 },
    );
  return (await import("@/server/legacy-api")).handle(request, context);
}
export {
  handle as GET,
  handle as POST,
  handle as PATCH,
  handle as DELETE,
  handle as HEAD,
};
