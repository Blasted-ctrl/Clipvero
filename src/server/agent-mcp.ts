import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { batchSchema } from "@/lib/automation";
import {
  createBatch,
  getBatch,
  listBatches,
  getAgentProject,
  type Grant,
} from "./automation";
import { AppError } from "./errors";
import { scriptStyleGuide } from "@/lib/script-style";

export function agentMcp(grant: Grant) {
  const server = new McpServer(
    { name: "clipvero", version: "0.1.0" },
    { maxToolInputElements: 10000 },
  );
  async function result(fn: () => unknown) {
    try {
      const output = await fn();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(output) }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text:
              error instanceof AppError
                ? error.message
                : "The operation could not be completed.",
          },
        ],
      };
    }
  }
  server.registerTool(
    "clipvero_status",
    {
      description:
        "Read the owner-authorized video allowance, credit budget, destinations and publishing window. You cannot change them or approve the guided run. Instagram follows the owner policy. Every TikTok post requires owner review, audience selection and consent in Clipvero.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () =>
      result(() => ({
        grant,
        features: {
          asyncCreation: true,
          instagramPublishing: true,
          tiktokReviewedPublishing: true,
        },
      })),
  );
  server.registerTool(
    "clipvero_create_batch",
    {
      description: `Queue distinct script or AI videos asynchronously. For free narration with word-timed captions use voice "free-cute", "free-warm" or "free-deep" (no API key). For the animated explainer look set style "explainer" (visual "complexity" draws Big O growth curves, "grid" is a subtle dark backdrop) and a mascot appears automatically. For a two-host conversation (curious Byte and sharp Theo, each with their own voice, diagrams popping up) set style "conversation" with an AI mode such as explainer or prompt; sourceAssetId sets the owner's background gameplay recording. You can supply typed beats with text, visual, panel, optional code and presentation (camera wide/close, mascotSide left/right, optional reaction up to 24 characters); beat text must join with blank lines to equal content. Reuse panel IDs across adjacent visuals of the same type to preserve the diagram. Use mode script for a supplied storyboard. Scripts are rejected if they sound machine-written: ${scriptStyleGuide} Use a UUID requestId and reuse it for retries of this exact request. Costs and total video count must fit your human-issued grant. Returns batch/job IDs; poll get_batch until completed, then open reviewUrl.`,
      inputSchema: batchSchema,
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    async (input) => result(() => createBatch(grant.id, input)),
  );
  server.registerTool(
    "clipvero_list_batches",
    {
      description:
        "List this agent grant's recent batches, including requests started in earlier conversations.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => result(() => listBatches(grant.id)),
  );
  server.registerTool(
    "clipvero_get_batch",
    {
      description:
        "Read durable video job progress, errors and review URLs. Calling this does not start another job or consume credits.",
      inputSchema: { batchId: z.string().uuid() },
      annotations: { readOnlyHint: true },
    },
    async ({ batchId }) => result(() => getBatch(grant.id, batchId)),
  );
  server.registerTool(
    "clipvero_get_project",
    {
      description:
        "Read a project produced by this grant, including its current timeline and rendered revision.",
      inputSchema: { projectId: z.string().uuid() },
      annotations: { readOnlyHint: true },
    },
    async ({ projectId }) => result(() => getAgentProject(grant.id, projectId)),
  );
  return server;
}
