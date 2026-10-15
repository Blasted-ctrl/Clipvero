import { z } from "zod";
import { requireIdentity, checkOrigin, rateLimit } from "@/server/auth";
import { agentBoundary, agentJson, agentError } from "@/server/agent-http";
import {
  beginSocialConnection,
  completeSocialConnection,
  listConnections,
  disconnectSocial,
  listPublications,
  approvePublication,
  cancelPublication,
  authorizePublicationMedia,
  publicationCreator,
  approveTikTokPublication,
} from "@/server/social";
import { providerSchema, tiktokPostSchema } from "@/lib/social";
import { mediaResponse } from "@/server/media-response";
import { publisherStatus } from "@/worker/publish";
import { urlVerification } from "@/server/url-verification";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    agentBoundary(request);
    const { path } = await context.params;
    if (
      path[0] === "media" &&
      path.length === 2 &&
      ["GET", "HEAD"].includes(request.method)
    ) {
      if (path[1].endsWith(".txt"))
        return (
          urlVerification(path[1], request.method === "HEAD") ??
          new Response("Not found.", { status: 404 })
        );
      const url = new URL(request.url),
        id = z.string().uuid().parse(path[1]);
      const media = authorizePublicationMedia(
        id,
        url.searchParams.get("expires"),
        url.searchParams.get("signature"),
      );
      const response = await mediaResponse(
        request,
        media.workspaceId,
        media.assetId,
      );
      response.headers.set("Referrer-Policy", "no-referrer");
      return response;
    }
    const me = await requireIdentity();
    if (request.method !== "GET") checkOrigin(request);
    if (
      path[0] === "callback" &&
      path.length === 2 &&
      request.method === "GET"
    ) {
      const url = new URL(request.url);
      if (url.searchParams.has("error"))
        throw new Error("Connection was declined.");
      await completeSocialConnection(
        me,
        providerSchema.parse(path[1]),
        z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .parse(url.searchParams.get("state")),
        z.string().min(1).max(4096).parse(url.searchParams.get("code")),
      );
      return Response.redirect(
        new URL("/automation?connected=1", request.url),
        303,
      );
    }
    if (path.join("/") === "status" && request.method === "GET")
      return Response.json(
        {
          connections: listConnections(me.workspaceId),
          publications: listPublications(me.workspaceId),
          publisher: publisherStatus(),
          configured: {
            instagram:
              !!process.env.INSTAGRAM_APP_ID &&
              !!process.env.INSTAGRAM_APP_SECRET,
            tiktok:
              !!process.env.TIKTOK_CLIENT_KEY &&
              !!process.env.TIKTOK_CLIENT_SECRET,
          },
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    if (
      path[0] === "connect" &&
      path.length === 2 &&
      request.method === "POST"
    ) {
      rateLimit(`social-connect:${me.workspaceId}`, 20, 3600000);
      return Response.json(
        beginSocialConnection(me, providerSchema.parse(path[1])),
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (
      path[0] === "connections" &&
      path.length === 2 &&
      request.method === "DELETE"
    )
      return Response.json(
        disconnectSocial(me.workspaceId, z.string().uuid().parse(path[1])),
      );
    if (
      path[0] === "publications" &&
      path.length === 3 &&
      path[2] === "creator" &&
      request.method === "GET"
    ) {
      rateLimit(`tiktok-creator:${me.workspaceId}`, 30, 60000);
      return Response.json(
        await publicationCreator(
          me.workspaceId,
          z.string().uuid().parse(path[1]),
        ),
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (path[0] === "publications" && path.length === 2) {
      const id = z.string().uuid().parse(path[1]);
      if (request.method === "POST") {
        const input = z
          .object({
            caption: z.string().trim().min(1).max(2200),
            consent: z.literal(true),
            revision: z.number().int().positive(),
            tiktok: tiktokPostSchema.optional(),
          })
          .strict()
          .parse(await agentJson(request));
        return Response.json(
          input.tiktok
            ? await approveTikTokPublication(
                me.workspaceId,
                id,
                input.caption,
                input.tiktok,
                input.revision,
              )
            : approvePublication(
                me.workspaceId,
                id,
                input.caption,
                undefined,
                input.revision,
              ),
        );
      }
      if (request.method === "DELETE")
        return Response.json(cancelPublication(me.workspaceId, id));
    }
    return Response.json({ error: { message: "Not found." } }, { status: 404 });
  } catch (error) {
    return agentError(error);
  }
}
export { handle as GET, handle as POST, handle as DELETE, handle as HEAD };
