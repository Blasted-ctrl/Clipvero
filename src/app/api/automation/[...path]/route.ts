import { z } from "zod";
import { requireIdentity, checkOrigin, rateLimit } from "@/server/auth";
import { createGrant, listGrants, revokeGrant } from "@/server/automation";
import { startContentRun } from "@/server/autopilot";
import { agentBoundary, agentJson, agentError } from "@/server/agent-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    agentBoundary(request);
    const me = await requireIdentity();
    const { path } = await context.params;
    if (request.method !== "GET") checkOrigin(request);
    if (path.join("/") === "grants") {
      if (request.method === "GET")
        return Response.json(
          { grants: listGrants(me.workspaceId) },
          { headers: { "Cache-Control": "no-store" } },
        );
      if (request.method === "POST") {
        rateLimit(`agent-grants:${me.workspaceId}`, 20, 3600000);
        return Response.json(
          createGrant(me.workspaceId, await agentJson(request)),
          { status: 201, headers: { "Cache-Control": "no-store" } },
        );
      }
    }
    if (path.join("/") === "runs" && request.method === "POST") {
      rateLimit(`autopilot:${me.workspaceId}`, 6, 3600000);
      return Response.json(
        await startContentRun(me.workspaceId, await agentJson(request)),
        { status: 201, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (
      path[0] === "grants" &&
      path.length === 2 &&
      request.method === "DELETE"
    )
      return Response.json(
        revokeGrant(me.workspaceId, z.string().uuid().parse(path[1])),
      );
    return Response.json({ error: { message: "Not found." } }, { status: 404 });
  } catch (error) {
    return agentError(error);
  }
}
export { handle as GET, handle as POST, handle as DELETE };
