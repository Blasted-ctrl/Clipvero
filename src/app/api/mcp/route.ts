import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateAgent } from "@/server/automation";
import { agentMcp } from "@/server/agent-mcp";
import { agentBoundary, agentJson, agentError } from "@/server/agent-http";
import { rateLimit } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    agentBoundary(request);
    const grant = authenticateAgent(request);
    rateLimit(`agent:${grant.id}`, 120, 60000);
    const body = await agentJson(request);
    const server = agentMcp(grant);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
      maxRequestBodySize: 1024 * 1024,
    });
    await server.connect(transport);
    try {
      const response = await transport.handleRequest(request, {
        parsedBody: body,
      });
      const complete = new Response(await response.arrayBuffer(), {
        status: response.status,
        headers: response.headers,
      });
      complete.headers.set("Cache-Control", "no-store");
      return complete;
    } finally {
      await server.close();
    }
  } catch (error) {
    return agentError(error);
  }
}

export function GET() {
  return Response.json(
    {
      error: { message: "Use MCP Streamable HTTP POST with your agent token." },
    },
    { status: 405, headers: { Allow: "POST" } },
  );
}
