import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import ffprobe from "ffprobe-static";
const require = createRequire(import.meta.url);
function output<T>(raw: unknown): T {
  const result = CallToolResultSchema.parse(raw);
  expect(result.isError).not.toBe(true);
  const content = result.content as { type: string; text: string }[];
  return JSON.parse(content[0].text) as T;
}
test("owner grants MCP access; HTTP and stdio agents reconnect to one durable real render", async ({
  page,
  request,
}) => {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Automation Owner");
  await page
    .getByLabel("Email address")
    .fill(`agent-${Date.now()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("isolated automation password");
  await page.getByRole("button", { name: "Create your account" }).click();
  await page.getByRole("link", { name: "Automation", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Automation", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Connect an agent", exact: true })
    .click();
  await page.getByLabel("Agent name", { exact: true }).fill("My first agent");
  await page
    .getByRole("button", { name: "Create agent token", exact: true })
    .click();
  const token = await page
    .getByLabel("Agent token", { exact: true })
    .inputValue();
  expect(token).toMatch(/^cv_[a-f0-9]{64}$/);
  await page.keyboard.press("Escape");
  await expect(page.getByText("My first agent", { exact: true })).toBeVisible();
  const unauthenticated = await request.post("/api/mcp", {
    data: { jsonrpc: "2.0", method: "tools/list", id: 1 },
  });
  expect(unauthenticated.status()).toBe(401);
  const foreign = await request.post("/api/mcp", {
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: "https://foreign.example",
    },
    data: { jsonrpc: "2.0", method: "tools/list", id: 1 },
  });
  expect(foreign.status()).toBe(403);
  const endpoint = new URL("http://localhost:3000/api/mcp");
  const connect = async () => {
    const client = new Client({
      name: "clipvero-browser-acceptance",
      version: "1.0.0",
    });
    await client.connect(
      new StreamableHTTPClientTransport(endpoint, {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      }),
    );
    return client;
  };
  const client = await connect();
  const requestId = crypto.randomUUID();
  let batchId = "";
  try {
    expect((await client.listTools()).tools.map((t) => t.name)).toContain(
      "clipvero_create_batch",
    );
    const args = {
      requestId,
      videos: [
        {
          title: "Agent-created original short",
          mode: "script",
          content: "One idea. Created through a real MCP connection.",
          duration: 5,
          rightsConfirmed: true,
        },
      ],
    };
    const batch = output<{ id: string }>(
      await client.callTool({ name: "clipvero_create_batch", arguments: args }),
    );
    batchId = batch.id;
    expect(
      output<{ id: string }>(
        await client.callTool({
          name: "clipvero_create_batch",
          arguments: args,
        }),
      ).id,
    ).toBe(batchId);
    expect(
      (
        await client.callTool({
          name: "clipvero_create_batch",
          arguments: { ...args, requestId: crypto.randomUUID() },
        })
      ).isError,
    ).toBe(true);
  } finally {
    await client.close();
  }
  // The real worker continues while no agent session is connected.
  const reconnected = await connect();
  let projectId = "";
  try {
    await expect
      .poll(
        async () => {
          const result = output<{
            complete: boolean;
            videos: {
              state: string;
              error: string | null;
              projectId: string;
            }[];
          }>(
            await reconnected.callTool({
              name: "clipvero_get_batch",
              arguments: { batchId },
            }),
          );
          if (result.videos[0].state === "failed")
            throw new Error(result.videos[0].error ?? "Render failed");
          projectId = result.videos[0].projectId;
          return result.complete;
        },
        { timeout: 180000, intervals: [1000, 2000] },
      )
      .toBe(true);
    const video = await page.request.get(`/api/projects/${projectId}/download`);
    expect(video.status()).toBe(200);
    const path = resolve("test-results", "mcp-created.mp4");
    writeFileSync(path, await video.body());
    const probe = spawnSync(
      ffprobe.path,
      ["-v", "error", "-show_streams", "-show_format", "-of", "json", path],
      { encoding: "utf8", windowsHide: true },
    );
    expect(probe.status, probe.stderr).toBe(0);
    const metadata = JSON.parse(probe.stdout);
    expect(
      metadata.streams.find(
        (s: { codec_type: string }) => s.codec_type === "video",
      ).codec_name,
    ).toBe("h264");
    expect(Number(metadata.format.duration)).toBeCloseTo(5, 0);
  } finally {
    await reconnected.close();
  }
  const bridge = new Client({
    name: "clipvero-stdio-acceptance",
    version: "1.0.0",
  });
  try {
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
    await bridge.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [require.resolve("tsx/cli"), resolve("scripts/agent-mcp.ts")],
        cwd: process.cwd(),
        env: {
          ...env,
          CLIPVERO_URL: "http://localhost:3000",
          CLIPVERO_AGENT_TOKEN: token,
        },
        stderr: "pipe",
      }),
    );
    expect(
      output<{ videos: { projectId: string }[] }>(
        await bridge.callTool({
          name: "clipvero_get_batch",
          arguments: { batchId },
        }),
      ).videos[0].projectId,
    ).toBe(projectId);
  } finally {
    await bridge.close();
  }
  await page
    .getByRole("button", { name: "Revoke My first agent", exact: true })
    .click();
  await expect(page.getByText(/Revoked/)).toBeVisible();
  const revoked = await request.post("/api/mcp", {
    headers: { Authorization: `Bearer ${token}` },
    data: { jsonrpc: "2.0", method: "tools/list", id: 1 },
  });
  expect(revoked.status()).toBe(401);
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      )
      .toBe(true);
  }
});
