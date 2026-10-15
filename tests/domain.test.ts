import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "clipvero-test-"));
const { db, one, run } = await import("../src/server/db");
const { hashPassword, verifyPassword, register } =
  await import("../src/server/auth");
const { createSchema, scriptTimeline, timelineSchema, duration } =
  await import("../src/lib/model");
const {
  getProject,
  insertProject,
  saveProject,
  reviewProject,
  getAsset,
  listAssets,
} = await import("../src/server/projects");
const { enqueue, claimJob, finishJob, recoverExpiredJobs, recordRenderResult } =
  await import("../src/server/jobs");
const { createPipeline, runPipeline, getPipeline } =
  await import("../src/server/pipelines");
function workspace(email: string) {
  const id = register(email, "Test Creator", "a sufficiently long password");
  return one<{ id: string }>("SELECT id FROM workspaces WHERE owner_id=?", id)!
    .id;
}
const ws = workspace("creator@example.test"),
  other = workspace("other@example.test");
const input = createSchema.parse({
  title: "An original story",
  mode: "script",
  content: "Keep my exact words.\n\nThis is scene two.",
  duration: 5,
  rightsConfirmed: true,
});
after(() => {
  db.close();
  rmSync(process.env.DATA_DIR!, { recursive: true, force: true });
});
test("passwords are salted, verify correctly, and reject incorrect passwords", () => {
  const hash = hashPassword("a sufficiently long password");
  assert.notEqual(hash, hashPassword("a sufficiently long password"));
  assert.equal(verifyPassword("a sufficiently long password", hash), true);
  assert.equal(verifyPassword("wrong password", hash), false);
});
test("scripts retain exact scene text and the timeline uses the requested duration", () => {
  const t = scriptTimeline(input.content, "9:16", 5);
  assert.deepEqual(
    t.scenes.map((s) => s.script),
    ["Keep my exact words.", "This is scene two."],
  );
  assert.equal(duration(t), 150);
  assert.equal(
    timelineSchema.safeParse({ ...t, scenes: [t.scenes[0], t.scenes[0]] })
      .success,
    false,
  );
});
test("long scripts preserve every accepted paragraph and reject unsupported scene counts", () => {
  const paragraphs = Array.from(
    { length: 40 },
    (_, i) => `Original paragraph ${i + 1}.`,
  );
  assert.deepEqual(
    scriptTimeline(paragraphs.join("\n\n"), "9:16", 60).scenes.map(
      (s) => s.script,
    ),
    paragraphs,
  );
  assert.throws(
    () => scriptTimeline(Array(61).fill("A paragraph").join("\n\n")),
    /at most 60 scenes/,
  );
  assert.equal(
    createSchema.safeParse({
      ...input,
      content: paragraphs.join("\n\n"),
      generateImages: true,
    }).success,
    false,
  );
});
test("projects enforce workspace isolation and optimistic concurrency", () => {
  const p = insertProject(ws, input);
  assert.throws(() => getProject(other, p.id), /Not found/);
  const updated = saveProject(ws, p.id, "Edited title", p.timeline, p.revision);
  assert.equal(updated.revision, 2);
  assert.throws(
    () => saveProject(ws, p.id, "Stale update", p.timeline, p.revision),
    /another tab/,
  );
  assert.throws(
    () => reviewProject(ws, p.id, "approve"),
    /Render the current version/,
  );
});
test("queued render snapshots are immutable; duplicate requests reserve only once", () => {
  const p = insertProject(ws, input);
  const a = enqueue(ws, "render", "same-key", p.id);
  const b = enqueue(ws, "render", "same-key", p.id);
  assert.equal(a.id, b.id);
  assert.equal(
    one<{ credits: number }>("SELECT credits FROM workspaces WHERE id=?", ws)!
      .credits,
    119,
  );
  const edited = structuredClone(p.timeline);
  edited.scenes[0].caption = "New caption";
  saveProject(ws, p.id, p.title, edited, 1);
  assert.equal(
    JSON.parse(a.input).timeline.scenes[0].caption,
    "Keep my exact words.",
  );
  const claim = claimJob()!;
  finishJob(claim, "Deliberate worker test failure");
  finishJob(claim, "Second attempt must not refund twice");
  assert.equal(
    one<{ credits: number }>("SELECT credits FROM workspaces WHERE id=?", ws)!
      .credits,
    120,
  );
  assert.equal(getProject(ws, p.id).status, "draft");
});
test("quota exhaustion cannot make a wallet negative", () => {
  run("UPDATE workspaces SET credits=1 WHERE id=?", other);
  const p = insertProject(other, input);
  enqueue(other, "render", "spend-last-credit", p.id);
  assert.throws(
    () =>
      enqueue(
        other,
        "render",
        "no-more-credit",
        insertProject(other, input).id,
      ),
    /needs 1 credits/,
  );
  assert.equal(
    one<{ credits: number }>(
      "SELECT credits FROM workspaces WHERE id=?",
      other,
    )!.credits,
    0,
  );
});
test("lost worker leases fail and refund once rather than silently rerunning", () => {
  const job = claimJob()!;
  run("UPDATE jobs SET lease_until=0 WHERE id=?", job.id);
  recoverExpiredJobs();
  recoverExpiredJobs();
  assert.equal(
    one<{ credits: number }>(
      "SELECT credits FROM workspaces WHERE id=?",
      other,
    )!.credits,
    1,
  );
  assert.equal(
    one<{ state: string }>("SELECT state FROM jobs WHERE id=?", job.id)!.state,
    "failed",
  );
});
test("missing AI credentials fail before reserving credits", () => {
  const old = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const balance = one<{ credits: number }>(
    "SELECT credits FROM workspaces WHERE id=?",
    ws,
  )!.credits;
  assert.throws(
    () =>
      enqueue(ws, "generate", "blocked", null, { ...input, mode: "prompt" }),
    /OpenAI API key/,
  );
  assert.equal(
    one<{ credits: number }>("SELECT credits FROM workspaces WHERE id=?", ws)!
      .credits,
    balance,
  );
  if (old) process.env.OPENAI_API_KEY = old;
});
test("a recovered lease cannot publish late results or consume refunded credits", () => {
  const p = insertProject(ws, input);
  const queued = enqueue(ws, "render", "late-worker", p.id);
  const claimed = claimJob()!;
  assert.equal(claimed.id, queued.id);
  run("UPDATE jobs SET lease_until=0 WHERE id=?", claimed.id);
  recoverExpiredJobs();
  assert.throws(
    () => recordRenderResult(claimed.id, p.id, crypto.randomUUID(), p.revision),
    /live worker lease/,
  );
  finishJob(claimed);
  assert.equal(getProject(ws, p.id).outputAssetId, null);
  assert.equal(
    one<{ credits: number }>("SELECT credits FROM workspaces WHERE id=?", ws)!
      .credits,
    120,
  );
});
test("pipeline duplicate triggers cannot double-spend and lifetime limits stop additional runs", () => {
  process.env.OPENAI_API_KEY = "test-only-provider-fixture-never-called";
  try {
    const pipeline = createPipeline(ws, {
      name: "Test autopilot",
      config: { ...input, mode: "prompt" },
      intervalHours: 24,
      maxRuns: 1,
      budget: 3,
    });
    const a = runPipeline(ws, pipeline.id, "trigger-once")!;
    const b = runPipeline(ws, pipeline.id, "trigger-once")!;
    assert.equal(a.id, b.id);
    assert.equal(getPipeline(ws, pipeline.id).runs, 1);
    assert.equal(getPipeline(ws, pipeline.id).spent, 3);
    assert.throws(
      () => runPipeline(ws, pipeline.id, "another-trigger"),
      /run or credit limit/,
    );
    const job = claimJob()!;
    finishJob(job, "Test-only failure");
  } finally {
    delete process.env.OPENAI_API_KEY;
  }
});
test("staged render artifacts are hidden until successful job completion", () => {
  for (const fail of [true, false]) {
    const p = insertProject(ws, input),
      job = enqueue(ws, "render", `staged-${fail}`, p.id),
      claimed = claimJob()!;
    assert.equal(job.id, claimed.id);
    const assetId = crypto.randomUUID();
    run(
      "INSERT INTO assets VALUES (?,?,?,?,?,?,?,?,?,?)",
      assetId,
      ws,
      "Test-only render metadata",
      `${assetId}.mp4`,
      "video",
      "video/mp4",
      1000,
      5,
      "Domain fixture, no physical media",
      Date.now(),
    );
    recordRenderResult(job.id, p.id, assetId, p.revision);
    assert.throws(() => getAsset(ws, assetId), /Not found/);
    assert.equal(
      listAssets(ws).some((a) => a.id === assetId),
      false,
    );
    finishJob(claimed, fail ? "Test-only partial render failure" : undefined);
    if (fail) {
      assert.throws(() => getAsset(ws, assetId), /Not found/);
      assert.equal(getProject(ws, p.id).outputAssetId, null);
    } else {
      assert.equal(getAsset(ws, assetId).id, assetId);
      assert.equal(getProject(ws, p.id).status, "review");
    }
  }
});
