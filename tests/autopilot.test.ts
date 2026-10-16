import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, test } from "node:test";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "clipvero-autopilot-"));
process.env.CLAUDE_BIN = "none";
process.env.CODEX_BIN = "none";
process.env.CLIPVERO_TEXT_PROVIDERS = "openai";
process.env.OPENAI_API_KEY = "test-key";
process.env.CLIPVERO_VOICE_PROVIDERS = "local";
process.env.SESSION_SECRET = "test-only-social-encryption-secret-32-characters";
process.env.APP_URL = "https://clipvero.example.test";
const { db, one, all, run } = await import("../src/server/db");
const { register } = await import("../src/server/auth");
const { contentRunSchema, planRun, startContentRun } =
  await import("../src/server/autopilot");
const { sealCredentials } = await import("../src/server/social");

const realFetch = globalThis.fetch;
let replies: { topic: string; angle: string }[][] = [];
let calls = 0;
beforeEach(() => {
  calls = 0;
  globalThis.fetch = (async () =>
    Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({ topics: replies[calls++] ?? [] }),
          },
        },
      ],
    })) as typeof fetch;
});
after(() => {
  globalThis.fetch = realFetch;
  db.close();
  rmSync(process.env.DATA_DIR!, { recursive: true, force: true });
});

function workspace() {
  const userId = register(
    `${crypto.randomUUID()}@example.test`,
    "Owner",
    "isolated owner password",
  );
  return one<{ id: string }>(
    "SELECT id FROM workspaces WHERE owner_id=?",
    userId,
  )!.id;
}
const topics = (n: number, prefix = "Topic") =>
  Array.from({ length: n }, (_, i) => ({
    topic: `${prefix} ${["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet", "kilo", "lima", "mike", "november"][i]} concept`,
    angle: "A concrete angle",
  }));
function connection(workspaceId: string) {
  const id = crypto.randomUUID();
  run(
    "INSERT INTO social_connections(id,workspace_id,provider,account_id,name,credentials,expires_at,disconnected_at,created_at) VALUES (?,?,?,?,?,?,?,NULL,?)",
    id,
    workspaceId,
    "instagram",
    "acct",
    "Owner",
    sealCredentials(id, { accessToken: "t", refreshToken: "r" }),
    Date.now() + 2 * 86400000,
    Date.now(),
  );
  return id;
}
const generateJobs = (ws: string) =>
  all<{ id: string; kind: string; input: string }>(
    "SELECT id,kind,input FROM jobs WHERE workspace_id=? ORDER BY created_at",
    ws,
  );

test("conversation videos need a background and the window math respects spacing", () => {
  assert.throws(
    () => contentRunSchema.parse({ count: 5, hours: 6, style: "conversation" }),
    /gameplay/,
  );
  const plan = planRun(
    contentRunSchema.parse({ count: 50, hours: 24 }),
    1_000_000,
  );
  assert.equal(plan.interval, 28);
  assert.equal(plan.endAt - plan.startAt, 24 * 3600000);
  assert.equal(plan.expiresHours, 30);
  const dense = planRun(
    contentRunSchema.parse({ count: 100, hours: 6 }),
    1_000_000,
  );
  assert.equal(dense.interval, 15, "never tighter than 15 minutes");
  assert.ok(
    dense.endAt - dense.startAt >= 100 * 15 * 60000,
    "the window grows to fit the spacing",
  );
});

test("a run uses library topics first, brainstorms the rest and skips repeats", async () => {
  const ws = workspace();
  run(
    "INSERT INTO topic_ideas(id,workspace_id,topic,angle,style,created_at) VALUES (?,?,?,?,?,?)",
    crypto.randomUUID(),
    ws,
    "Library topic about thread pools",
    "From a book",
    "explainer",
    1,
  );
  run(
    "INSERT INTO projects(id,workspace_id,title,mode,timeline,created_at,updated_at) VALUES (?,?,?,?,?,0,0)",
    crypto.randomUUID(),
    ws,
    "Topic alpha concept",
    "script",
    "{}",
  );
  replies = [
    [
      ...topics(4),
      { topic: "Topic alpha concept explained", angle: "near duplicate" },
    ],
  ];
  const result = await startContentRun(ws, { count: 4, hours: 4 });
  assert.equal(result.queued, 4);
  assert.equal(result.topics[0], "Library topic about thread pools");
  assert.ok(
    !result.topics.some((t) => /alpha/.test(t)),
    "a topic already made is not repeated",
  );
  const jobs = generateJobs(ws);
  assert.equal(jobs.length, 4);
  assert.ok(
    jobs.every(
      (j) => j.kind === "generate" && JSON.parse(j.input).style === "explainer",
    ),
  );
  assert.equal(
    all("SELECT id FROM topic_ideas WHERE workspace_id=? AND status='used'", ws)
      .length,
    4,
  );
  const grant = one<{ run_limit: number; credit_limit: number }>(
    "SELECT run_limit,credit_limit FROM agent_grants WHERE workspace_id=?",
    ws,
  )!;
  assert.equal(grant.run_limit, 4);
  assert.equal(grant.credit_limit, 4 * result.perVideoCredits);
});

test("large runs queue in batches of eight under one grant and reserve credits once", async () => {
  const ws = workspace();
  replies = [topics(14)];
  const before = one<{ credits: number }>(
    "SELECT credits FROM workspaces WHERE id=?",
    ws,
  )!.credits;
  const result = await startContentRun(ws, { count: 10, hours: 5 });
  assert.equal(result.queued, 10);
  assert.equal(
    all("SELECT id FROM agent_batches WHERE grant_id=?", result.grantId).length,
    2,
  );
  assert.equal(generateJobs(ws).length, 10);
  const after = one<{ credits: number }>(
    "SELECT credits FROM workspaces WHERE id=?",
    ws,
  )!.credits;
  assert.equal(before - after, 10 * result.perVideoCredits);
  const grant = one<{ runs: number; spent: number }>(
    "SELECT runs,spent FROM agent_grants WHERE id=?",
    result.grantId,
  )!;
  assert.equal(grant.runs, 10);
  assert.equal(grant.spent, 10 * result.perVideoCredits);
});

test("publishing spreads uploads evenly and automatic approval is explicit", async () => {
  const ws = workspace();
  const account = connection(ws);
  replies = [topics(12)];
  const result = await startContentRun(ws, {
    count: 10,
    hours: 5,
    connectionIds: [account],
    automatic: true,
  });
  assert.equal(result.intervalMinutes, 30);
  assert.equal(result.lastUpload! - result.firstUpload!, 9 * 30 * 60000);
  assert.equal(result.automatic, true);
  const policy = JSON.parse(
    one<{ policy: string }>(
      "SELECT policy FROM agent_grants WHERE id=?",
      result.grantId,
    )!.policy,
  );
  assert.equal(policy.automatic, true);
  assert.deepEqual(policy.connectionIds, [account]);
  replies = [topics(6)];
  calls = 0;
  const manual = await startContentRun(workspace(), { count: 3, hours: 3 });
  assert.equal(manual.automatic, false);
  assert.equal(
    manual.firstUpload,
    null,
    "no destination means videos wait for review in Clipvero",
  );
});

test("a run that the wallet cannot cover is refused before anything is created", async () => {
  const ws = workspace();
  run("UPDATE workspaces SET credits=5 WHERE id=?", ws);
  replies = [topics(14)];
  await assert.rejects(
    startContentRun(ws, { count: 10, hours: 5 }),
    /reserve 30 credits.*has 5/,
  );
  assert.equal(
    all("SELECT id FROM agent_grants WHERE workspace_id=?", ws).length,
    0,
  );
  assert.equal(generateJobs(ws).length, 0);
  assert.equal(calls, 0, "no topics were requested for an unaffordable run");
});

test("without any script writer the run explains what to add", async () => {
  const saved = process.env.CLIPVERO_TEXT_PROVIDERS;
  process.env.CLIPVERO_TEXT_PROVIDERS = "none";
  try {
    await assert.rejects(
      startContentRun(workspace(), { count: 3, hours: 3 }),
      /script writer/,
    );
  } finally {
    process.env.CLIPVERO_TEXT_PROVIDERS = saved;
  }
});
