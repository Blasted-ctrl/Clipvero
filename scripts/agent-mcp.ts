import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const url = new URL(process.env.CLIPVERO_URL || "http://localhost:3000");
if (
  url.username ||
  url.password ||
  url.pathname !== "/" ||
  url.search ||
  url.hash ||
  !["http:", "https:"].includes(url.protocol)
)
  throw new Error("CLIPVERO_URL must be the Clipvero origin.");
if (
  url.protocol !== "https:" &&
  !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
)
  throw new Error("Remote Clipvero servers require HTTPS.");
const token = process.env.CLIPVERO_AGENT_TOKEN;
if (!token?.match(/^cv_[a-f0-9]{64}$/))
  throw new Error(
    "Set CLIPVERO_AGENT_TOKEN to a grant created in Clipvero Automation.",
  );
const client = new Client({ name: "clipvero-bridge", version: "0.1.0" });
await client.connect(
  new StreamableHTTPClientTransport(new URL("/api/mcp", url), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  }),
);
const bridge = new McpServer(
  { name: "clipvero", version: "0.1.0" },
  { capabilities: { tools: {} } },
);
bridge.server.setRequestHandler(ListToolsRequestSchema, () =>
  client.listTools(),
);
bridge.server.setRequestHandler(CallToolRequestSchema, (request) =>
  client.callTool(request.params),
);
await bridge.connect(new StdioServerTransport());
process.on("SIGINT", () => {
  void client.close().finally(() => bridge.close());
});
process.on("SIGTERM", () => {
  void client.close().finally(() => bridge.close());
});
