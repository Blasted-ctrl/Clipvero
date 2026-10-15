import { test, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "clipvero-agent-test-"));
process.env.SESSION_SECRET = "test-only-social-encryption-secret-32-characters";
process.env.APP_URL = "https://clipvero.example.test";
delete process.env.OPENAI_API_KEY;
const { db, one, run, all } = await import("../src/server/db");
const { register, login } = await import("../src/server/auth");
const {
  createGrant,
  authenticateAgent,
  createBatch,
  getBatch,
  getAgentProject,
  revokeGrant,
  listGrants,
} = await import("../src/server/automation");
const {
  getJob,
  recordRenderResult,
  finishJob,
  enqueue,
  claimJob,
  recoverExpiredJobs,
} = await import("../src/server/jobs");
const { createPipeline, tickPipelines } =
  await import("../src/server/pipelines");
const { saveProject, getProject } = await import("../src/server/projects");
const {
  sealCredentials,
  openCredentials,
  listConnections,
  planPublications,
  listPublications,
  approvePublication,
  approveTikTokPublication,
  authorizePublicationMedia,
  publicationMediaUrl,
  disconnectSocial,
  beginSocialConnection,
  completeSocialConnection,
  cancelPublication,
  publicationCreator,
  getConnection,
} = await import("../src/server/social");
const { publishTick } = await import("../src/worker/publish");

const originalFetch = globalThis.fetch;
function workspace() {
  const userId = register(
    `${crypto.randomUUID()}@example.test`,
    "Agent Owner",
    "isolated owner password",
  );
  return one<{ id: string }>(
    "SELECT id FROM workspaces WHERE owner_id=?",
    userId,
  )!.id;
}
const script = {
  title: "Original short",
  mode: "script",
  content: "My unchanged original words.",
  duration: 5,
  rightsConfirmed: true,
};
function grant(
  workspaceId: string,
  runLimit = 1,
  creditLimit = 10,
  publishing?: unknown,
) {
  return createGrant(workspaceId, {
    name: "Owner-authorized agent",
    runLimit,
    creditLimit,
    expiresHours: 24,
    publishing,
  });
}
function batch(id: string, videos = [script]) {
  return createBatch(id, { requestId: crypto.randomUUID(), videos });
}
function connection(workspaceId: string, provider = "instagram") {
  const id = crypto.randomUUID();
  run(
    "INSERT INTO social_connections(id,workspace_id,provider,account_id,name,credentials,expires_at,disconnected_at,created_at) VALUES (?,?,?,?,?,?,?,NULL,?)",
    id,
    workspaceId,
    provider,
    "account-fixture",
    "Owner account",
    sealCredentials(id, {
      accessToken: "fixture-platform-token",
      refreshToken: "fixture-refresh-token",
    }),
    Date.now() + 2 * 86400000,
    Date.now(),
  );
  return id;
}
function policy(connectionIds: string[], automatic = false) {
  return {
    connectionIds,
    automatic,
    startAt: Date.now() + 1000,
    intervalMinutes: 15,
    endAt: Date.now() + 20 * 3600000,
  };
}
function complete(workspaceId: string, id: string) {
  const j = getJob(workspaceId, id),
    assetId = crypto.randomUUID();
  run(
    "UPDATE jobs SET state='running',lease_until=? WHERE id=?",
    Date.now() + 60000,
    id,
  );
  // Only metadata is needed by contract tests. The browser suite renders and probes a real file.
  run(
    "INSERT INTO assets(id,workspace_id,name,kind,mime,filename,bytes,duration,provenance,created_at) VALUES (?,?,?,'video','video/mp4',?,1000,5,'Explicit test fixture',?)",
    assetId,
    workspaceId,
    "Rendered fixture",
    `${assetId}.mp4`,
    Date.now(),
  );
  recordRenderResult(id, j.projectId!, assetId, 1);
  finishJob(getJob(workspaceId, id));
  return getProject(workspaceId, j.projectId!);
}
function due() {
  run("UPDATE publications SET scheduled_at=0,next_poll=0");
}
function mockPlatform(handler: (url: string, init?: RequestInit) => unknown) {
  globalThis.fetch = async (input, init) =>
    Response.json(handler(String(input), init));
}
beforeEach(() => {
  run("DELETE FROM publications");
  run("INSERT OR IGNORE INTO agent_batch_dispatch SELECT id FROM jobs");
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});
after(() => {
  db.close();
  rmSync(process.env.DATA_DIR!, { recursive: true, force: true });
});

test("agent tokens are stored as hashes, expire and stay within their grant", () => {
  const ws = workspace(),
    a = grant(ws),
    b = grant(ws),
    other = grant(workspace());
  assert.match(a.token, /^cv_[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(listGrants(ws)).includes(a.token), false);
  assert.notEqual(
    one<{ token_hash: string }>(
      "SELECT token_hash FROM agent_grants WHERE id=?",
      a.grant.id,
    )!.token_hash,
    a.token,
  );
  assert.equal(
    authenticateAgent(
      new Request(process.env.APP_URL!, {
        headers: { Authorization: `Bearer ${a.token}` },
      }),
    ).id,
    a.grant.id,
  );
  const first = batch(a.grant.id);
  assert.throws(() => getBatch(b.grant.id, first.id), /Not found/);
  assert.throws(() => getBatch(other.grant.id, first.id), /Not found/);
  assert.throws(
    () => getAgentProject(b.grant.id, first.videos[0].projectId!),
    /Not found/,
  );
  run("UPDATE agent_grants SET expires_at=0 WHERE id=?", a.grant.id);
  assert.throws(() => batch(a.grant.id), /expired/);
});
test("batch retries replay one reservation and changed payloads conflict", () => {
  const ws = workspace(),
    access = grant(ws),
    requestId = crypto.randomUUID();
  const first = createBatch(access.grant.id, { requestId, videos: [script] });
  assert.equal(
    createBatch(access.grant.id, { requestId, videos: [script] }).id,
    first.id,
  );
  assert.equal(
    one<{ credits: number }>("SELECT credits FROM workspaces WHERE id=?", ws)!
      .credits,
    119,
  );
  assert.throws(
    () =>
      createBatch(access.grant.id, {
        requestId,
        videos: [{ ...script, title: "Different" }],
      }),
    /different videos/,
  );
  assert.throws(() => batch(access.grant.id), /video allowance/);
});
test("lifetime video and credit limits are atomic across requests, not per call", () => {
  const ws = workspace(),
    access = grant(ws, 3, 2);
  batch(access.grant.id, [script, script]);
  assert.throws(() => batch(access.grant.id), /credit budget/);
  assert.equal(listGrants(ws)[0].runs, 2);
  const short = grant(ws, 1, 1);
  assert.throws(
    () =>
      batch(short.grant.id, [
        { ...script, duration: 61, content: "A longer scene." },
      ]),
    /credit budget/,
  );
  const noWallet = grant(ws, 3, 10);
  run("UPDATE workspaces SET credits=1 WHERE id=?", ws);
  const count = one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM projects WHERE workspace_id=?",
    ws,
  )!.n;
  assert.throws(() => batch(noWallet.grant.id, [script, script]), /credit/i);
  assert.equal(
    one<{ n: number }>(
      "SELECT COUNT(*) AS n FROM projects WHERE workspace_id=?",
      ws,
    )!.n,
    count,
  );
  assert.equal(listGrants(ws).find((g) => g.id === noWallet.grant.id)!.runs, 0);
  assert.equal(
    one<{ credits: number }>("SELECT credits FROM workspaces WHERE id=?", ws)!
      .credits,
    1,
  );
});
test("missing providers fail before spending; revocation refunds queued jobs once", () => {
  const ws = workspace(),
    access = grant(ws, 3, 10);
  assert.throws(
    () => batch(access.grant.id, [{ ...script, mode: "prompt" }]),
    /OPENAI_API_KEY/,
  );
  assert.equal(listGrants(ws)[0].spent, 0);
  const result = batch(access.grant.id, [script, script]);
  revokeGrant(ws, access.grant.id);
  revokeGrant(ws, access.grant.id);
  assert.ok(result.videos.every((v) => getJob(ws, v.id).state === "failed"));
  assert.equal(
    one<{ credits: number }>("SELECT credits FROM workspaces WHERE id=?", ws)!
      .credits,
    120,
  );
  assert.equal(
    one<{ n: number }>(
      "SELECT COUNT(*) AS n FROM credit_ledger WHERE workspace_id=? AND operation='refund'",
      ws,
    )!.n,
    2,
  );
  assert.throws(() => batch(access.grant.id), /revoked/);
});
test("credentials are authenticated, encrypted, account-bound and never returned", () => {
  const ws = workspace(),
    id = connection(ws),
    stored = one<{ credentials: string }>(
      "SELECT credentials FROM social_connections WHERE id=?",
      id,
    )!.credentials;
  assert.equal(stored.includes("fixture-platform-token"), false);
  assert.equal(
    openCredentials(id, stored).accessToken,
    "fixture-platform-token",
  );
  assert.throws(() => openCredentials(crypto.randomUUID(), stored));
  assert.equal(
    JSON.stringify(listConnections(ws)).includes("credentials"),
    false,
  );
  disconnectSocial(ws, id);
  assert.equal(
    one<{ credentials: string }>(
      "SELECT credentials FROM social_connections WHERE id=?",
      id,
    )!.credentials,
    "",
  );
});
test("publishing policy rejects foreign accounts, excessive windows and auto guided runs", () => {
  const ws = workspace(),
    id = connection(ws);
  assert.throws(() => grant(ws, 1, 10, policy([id], true)), /guided run/);
  assert.throws(
    () => grant(workspace(), 3, 10, policy([id], true)),
    /disconnected/,
  );
  assert.throws(
    () =>
      grant(ws, 3, 10, { ...policy([id]), endAt: Date.now() + 2 * 86400000 }),
    /expires/,
  );
});
test("guided uploads require owner review of the exact rendered revision", () => {
  const ws = workspace(),
    id = connection(ws),
    access = grant(ws, 1, 10, policy([id])),
    result = batch(access.grant.id);
  complete(ws, result.videos[0].id);
  planPublications();
  planPublications();
  const publications = listPublications(ws);
  assert.equal(publications.length, 1);
  assert.equal(publications[0].state, "waiting_review");
  assert.throws(
    () => approvePublication(workspace(), publications[0].id, "Caption"),
    /Not found/,
  );
  const project = getProject(ws, publications[0].projectId);
  saveProject(ws, project.id, "Edited", project.timeline, 1);
  assert.throws(
    () => approvePublication(ws, publications[0].id, "Caption"),
    /changed/,
  );
});
test("Instagram and TikTok jobs are independent; TikTok requires per-video consent", async () => {
  const ws = workspace(),
    ig = connection(ws),
    tt = connection(ws, "tiktok"),
    access = grant(ws, 3, 10, policy([ig, tt], true)),
    result = batch(access.grant.id);
  complete(ws, result.videos[0].id);
  planPublications();
  due();
  const ttPublication = listPublications(ws).find(
    (p) => p.provider === "tiktok",
  )!;
  assert.equal(ttPublication.state, "waiting_review");
  assert.throws(
    () => approvePublication(ws, ttPublication.id, "Caption"),
    /privacy settings/,
  );
  let igCreates = 0,
    ttCreates = 0,
    igPublishes = 0;
  mockPlatform((url, init) => {
    if (url.includes("creator_info/query"))
      return {
        data: {
          creator_username: "owner",
          creator_nickname: "Owner",
          privacy_level_options: ["SELF_ONLY"],
          comment_disabled: true,
          duet_disabled: true,
          stitch_disabled: true,
          max_video_post_duration_sec: 60,
        },
        error: { code: "ok" },
      };
    if (url.endsWith("/media")) {
      igCreates++;
      const body = JSON.parse(init!.body as string);
      assert.equal(body.is_ai_generated, true);
      return { id: "ig-container" };
    }
    if (url.includes("video/init")) {
      ttCreates++;
      const body = JSON.parse(init!.body as string);
      assert.equal(body.post_info.privacy_level, "SELF_ONLY");
      assert.equal(body.post_info.disable_comment, true);
      assert.equal(body.post_info.is_aigc, true);
      return { data: { publish_id: "tt-upload" }, error: { code: "ok" } };
    }
    if (url.includes("status/fetch"))
      return {
        data: {
          status: "PUBLISH_COMPLETE",
          publicaly_available_post_id: ["tt-post"],
        },
        error: { code: "ok" },
      };
    if (url.includes("media_publish")) {
      igPublishes++;
      return { id: "ig-post" };
    }
    if (url.includes("permalink"))
      return { permalink: "https://www.instagram.com/reel/fixture/" };
    return { status_code: "FINISHED" };
  });
  const postInfo = {
    privacy_level: "SELF_ONLY" as const,
    disable_comment: true,
    disable_duet: true,
    disable_stitch: true,
    brand_content_toggle: false,
    brand_organic_toggle: false,
    consent: true as const,
  };
  await assert.rejects(
    () =>
      approveTikTokPublication(ws, ttPublication.id, "Caption", {
        ...postInfo,
        privacy_level: "PUBLIC_TO_EVERYONE",
      }),
    /settings/,
  );
  await approveTikTokPublication(
    ws,
    ttPublication.id,
    "Reviewed TikTok caption",
    postInfo,
  );
  for (let i = 0; i < 7; i++) {
    due();
    await publishTick();
  }
  assert.equal(igCreates, 1);
  assert.equal(ttCreates, 1);
  assert.equal(igPublishes, 1);
  const publications = listPublications(ws);
  assert.equal(
    publications.find((p) => p.provider === "instagram")!.postUrl,
    "https://www.instagram.com/reel/fixture/",
  );
  assert.equal(
    publications.find((p) => p.provider === "tiktok")!.state,
    "published",
  );
  assert.equal(
    publications.find((p) => p.provider === "tiktok")!.postId,
    "tt-post",
  );
});

test("unknown submissions are never blindly retried after network loss or worker death", async () => {
  const ws = workspace(),
    ig = connection(ws),
    access = grant(ws, 3, 10, policy([ig], true)),
    result = batch(access.grant.id);
  complete(ws, result.videos[0].id);
  planPublications();
  due();
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts++;
    throw new Error("network lost");
  };
  await publishTick();
  assert.equal(listPublications(ws)[0].state, "uncertain");
  due();
  await publishTick();
  assert.equal(attempts, 1);
  run(
    "UPDATE publications SET state='publishing',provider_id='known-container',lease_until=0",
  );
  mockPlatform(() => ({ status_code: "FINISHED" }));
  due();
  await publishTick();
  assert.equal(listPublications(ws)[0].state, "uncertain");
  assert.equal(attempts, 1);
});
test("edits and revocation prevent publication; expired signed media never leaks", async () => {
  const ws = workspace(),
    id = connection(ws),
    access = grant(ws, 3, 10, policy([id], true)),
    result = batch(access.grant.id);
  const p = complete(ws, result.videos[0].id);
  planPublications();
  const publication = listPublications(ws)[0];
  run("UPDATE publications SET state='processing' WHERE id=?", publication.id);
  const url = new URL(publicationMediaUrl(publication.id));
  assert.equal(
    authorizePublicationMedia(
      publication.id,
      url.searchParams.get("expires"),
      url.searchParams.get("signature"),
    ).workspaceId,
    ws,
  );
  assert.throws(
    () =>
      authorizePublicationMedia(
        publication.id,
        "1000000000000",
        url.searchParams.get("signature"),
      ),
    /expired/,
  );
  assert.throws(
    () =>
      authorizePublicationMedia(
        publication.id,
        url.searchParams.get("expires"),
        "a".repeat(64),
      ),
    /Invalid/,
  );
  saveProject(ws, p.id, "Changed video", p.timeline, p.revision);
  due();
  let called = false;
  mockPlatform(() => {
    called = true;
    return {};
  });
  await publishTick();
  assert.equal(called, false);
  assert.equal(listPublications(ws)[0].state, "cancelled");
  revokeGrant(ws, access.grant.id);
  assert.throws(() =>
    authorizePublicationMedia(
      publication.id,
      url.searchParams.get("expires"),
      url.searchParams.get("signature"),
    ),
  );
});
test("OAuth state is owner-bound and single use; provider tokens stay encrypted", async () => {
  process.env.TIKTOK_CLIENT_KEY = "fixture-key";
  process.env.TIKTOK_CLIENT_SECRET = "fixture-secret";
  const ws = workspace(),
    userId = one<{ owner_id: string }>(
      "SELECT owner_id FROM workspaces WHERE id=?",
      ws,
    )!.owner_id;
  const me = { workspaceId: ws, userId } as Parameters<
    typeof beginSocialConnection
  >[0];
  const begin = beginSocialConnection(me, "tiktok"),
    state = new URL(begin.url).searchParams.get("state")!;
  await assert.rejects(
    () =>
      completeSocialConnection(
        { ...me, userId: crypto.randomUUID() },
        "tiktok",
        state,
        "code",
      ),
    /expired/,
  );
  mockPlatform((url) =>
    url.includes("oauth/token")
      ? {
          access_token: "fixture-access",
          refresh_token: "fixture-refresh",
          expires_in: 86400,
          open_id: "fixture-id",
          scope: "user.info.basic,video.publish",
        }
      : {
          data: { user: { display_name: "My TikTok" } },
          error: { code: "ok" },
        },
  );
  await completeSocialConnection(me, "tiktok", state, "code");
  assert.equal(listConnections(ws)[0].name, "My TikTok");
  await assert.rejects(
    () => completeSocialConnection(me, "tiktok", state, "code"),
    /already used/,
  );
  assert.equal(
    JSON.stringify(
      all(
        "SELECT credentials FROM social_connections WHERE workspace_id=?",
        ws,
      ),
    ).includes("fixture-access"),
    false,
  );
});

test("Instagram OAuth accepts flat and wrapped token responses and verifies publishing access", async () => {
  process.env.INSTAGRAM_APP_ID = "fixture-instagram-id";
  process.env.INSTAGRAM_APP_SECRET = "fixture-instagram-secret";
  for (const format of [
    "wrapped",
    "flat",
    "array",
    "omitted",
    "declined",
    "probe-denied",
    "malformed",
  ]) {
    const ws = workspace();
    const userId = one<{ owner_id: string }>(
      "SELECT owner_id FROM workspaces WHERE id=?",
      ws,
    )!.owner_id;
    const me = { workspaceId: ws, userId } as Parameters<
      typeof beginSocialConnection
    >[0];
    const state = new URL(
      beginSocialConnection(me, "instagram").url,
    ).searchParams.get("state")!;
    const calls: string[] = [];
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      calls.push(url.pathname);
      if (url.hostname === "api.instagram.com") {
        const token = {
          access_token: "fixture-short-token",
          user_id: "178414000000001",
          ...(format === "omitted" || format === "probe-denied"
            ? {}
            : {
                permissions:
                  format === "array"
                    ? [
                        "instagram_business_basic",
                        "instagram_business_content_publish",
                      ]
                    : format === "declined"
                      ? "instagram_business_basic"
                      : "instagram_business_basic,instagram_business_content_publish",
              }),
        };
        return Response.json(
          format === "wrapped"
            ? { data: [token] }
            : format === "malformed"
              ? { access_token: "fixture-short-token" }
              : token,
        );
      }
      if (url.pathname.endsWith("/content_publishing_limit"))
        return format === "probe-denied"
          ? Response.json({ error: { code: 10 } }, { status: 403 })
          : Response.json({ data: [{ quota_usage: 0 }] });
      if (url.pathname === "/access_token")
        return Response.json({
          access_token: "fixture-long-token",
          token_type: "bearer",
          expires_in: 5184000,
        });
      if (url.pathname === "/v26.0/me")
        return new Response(
          '{"user_id":9223372036854775806,"username":"Owner fixture"}',
        );
      throw new Error("Unexpected Instagram endpoint");
    };
    if (["declined", "probe-denied", "malformed"].includes(format)) {
      await assert.rejects(
        () => completeSocialConnection(me, "instagram", state, "fixture-code"),
        format === "declined"
          ? /publishing permission/
          : format === "malformed"
            ? /authorization response/
            : /platform rejected/,
      );
      assert.equal(listConnections(ws).length, 0);
      if (format !== "probe-denied") assert.equal(calls.length, 1);
    } else {
      await completeSocialConnection(me, "instagram", state, "fixture-code");
      const connection = listConnections(ws)[0];
      assert.equal(connection.name, "Owner fixture");
      assert.equal(
        getConnection(ws, connection.id).accountId,
        "9223372036854775806",
      );
      assert.equal(
        calls.some((p) => p.endsWith("/content_publishing_limit")),
        format === "omitted",
      );
      assert.equal(
        JSON.stringify(
          all(
            "SELECT credentials FROM social_connections WHERE workspace_id=?",
            ws,
          ),
        ).includes("fixture-long-token"),
        false,
      );
    }
  }
});

test("concurrent publishers reserve schedule slots atomically", async () => {
  const ws = workspace(),
    id = connection(ws),
    access = grant(ws, 3, 10, policy([id], true)),
    result = batch(access.grant.id, [script, script]);
  result.videos.forEach((v) => complete(ws, v.id));
  planPublications();
  due();
  let writes = 0;
  mockPlatform(() => {
    writes++;
    return { id: "container" };
  });
  await Promise.all([publishTick(), publishTick()]);
  assert.equal(writes, 1);
  assert.equal(
    listPublications(ws).filter((p) => p.state === "queued").length,
    1,
  );
});
test("an expired processing continuation cannot issue another publish or overwrite the winner", async () => {
  const ws = workspace(),
    id = connection(ws),
    access = grant(ws, 3, 10, policy([id], true)),
    result = batch(access.grant.id);
  complete(ws, result.videos[0].id);
  planPublications();
  due();
  run("UPDATE publications SET state='processing',provider_id='container'");
  let release: (response: Response) => void = () => {},
    started: () => void = () => {};
  const paused = new Promise<Response>((resolve) => {
      release = resolve;
    }),
    waiting = new Promise<void>((resolve) => {
      started = resolve;
    });
  let reads = 0,
    writes = 0;
  globalThis.fetch = async (url) => {
    if (String(url).includes("media_publish")) {
      writes++;
      return Response.json({ id: "one-post" });
    }
    reads++;
    if (reads === 1) {
      started();
      return paused;
    }
    return Response.json({ status_code: "FINISHED" });
  };
  const old = publishTick();
  await waiting;
  run("UPDATE publications SET lease_until=0");
  await publishTick();
  release(Response.json({ status_code: "FINISHED" }));
  await old;
  assert.equal(writes, 1);
  assert.equal(listPublications(ws)[0].state, "published");
  assert.equal(listPublications(ws)[0].postId, "one-post");
});
test("accepted TikTok posts reconcile after revocation without claiming cancellation", async () => {
  const ws = workspace(),
    id = connection(ws, "tiktok"),
    access = grant(ws, 3, 10, policy([id], true)),
    result = batch(access.grant.id);
  complete(ws, result.videos[0].id);
  planPublications();
  const item = listPublications(ws)[0];
  approvePublication(ws, item.id, "Reviewed caption", {
    privacy_level: "SELF_ONLY",
    disable_comment: true,
    disable_duet: true,
    disable_stitch: true,
    brand_content_toggle: false,
    brand_organic_toggle: false,
    consent: true,
  });
  run(
    "UPDATE publications SET state='processing',provider_id='accepted',submitted_at=?",
    Date.now(),
  );
  assert.throws(() => cancelPublication(ws, item.id), /cannot be cancelled/);
  revokeGrant(ws, access.grant.id);
  assert.equal(listPublications(ws)[0].state, "uncertain");
  due();
  globalThis.fetch = async () =>
    new Response(
      '{"data":{"status":"PUBLISH_COMPLETE","publicaly_available_post_id":[9223372036854775806]},"error":{"code":"ok"}}',
      { headers: { "Content-Type": "application/json" } },
    );
  await publishTick();
  assert.equal(listPublications(ws)[0].state, "published");
  assert.equal(listPublications(ws)[0].postId, "9223372036854775806");
});
test("TikTok review refreshes expired tokens and refresh contention preserves queued uploads", async () => {
  process.env.TIKTOK_CLIENT_KEY = "fixture-key";
  process.env.TIKTOK_CLIENT_SECRET = "fixture-secret";
  const ws = workspace(),
    id = connection(ws, "tiktok"),
    access = grant(ws, 3, 10, policy([id], true)),
    result = batch(access.grant.id);
  complete(ws, result.videos[0].id);
  planPublications();
  run("UPDATE social_connections SET expires_at=0 WHERE id=?", id);
  let refreshes = 0;
  mockPlatform((url) => {
    if (url.includes("oauth/token")) {
      refreshes++;
      return {
        access_token: "refreshed-access",
        refresh_token: "rotated-refresh",
        expires_in: 86400,
      };
    }
    return {
      data: {
        creator_username: "owner",
        creator_nickname: "Owner",
        privacy_level_options: ["SELF_ONLY"],
        comment_disabled: true,
        duet_disabled: true,
        stitch_disabled: true,
        max_video_post_duration_sec: 60,
      },
      error: { code: "ok" },
    };
  });
  await publicationCreator(ws, listPublications(ws)[0].id);
  assert.equal(refreshes, 1);
  const igWs = workspace(),
    ig = connection(igWs),
    igGrant = grant(igWs, 3, 10, policy([ig], true)),
    igBatch = batch(igGrant.grant.id);
  complete(igWs, igBatch.videos[0].id);
  planPublications();
  due();
  run(
    "UPDATE social_connections SET expires_at=0,refresh_until=?,refresh_owner='another-request' WHERE id=?",
    Date.now() + 60000,
    ig,
  );
  await publishTick();
  assert.equal(listPublications(igWs)[0].state, "queued");
});

test("private owner can create the initial account locally before enabling HTTPS", () => {
  const previousUrl = process.env.APP_URL;
  const email = `${crypto.randomUUID()}@example.test`;
  process.env.PILOT_OWNER_EMAIL = email.toUpperCase();
  try {
    process.env.APP_URL = "http://localhost:3000";
    assert.throws(
      () => register("other@example.test", "Other", "isolated owner password"),
      /Registration is closed/,
    );
    const user = register(email, "Owner", "isolated owner password");
    assert.equal(login(email, "isolated owner password"), user);
    assert.equal(
      one<{ count: number }>(
        "SELECT count(*) AS count FROM credit_ledger WHERE workspace_id IN (SELECT id FROM workspaces WHERE owner_id=?)",
        user,
      )!.count,
      1,
    );
    assert.throws(
      () => register(email, "Owner", "isolated owner password"),
      /already exists/,
    );
    process.env.PILOT_OWNER_EMAIL = `${crypto.randomUUID()}@example.test`;
    process.env.APP_URL = "https://clipvero.example.test";
    assert.throws(
      () =>
        register(
          process.env.PILOT_OWNER_EMAIL!,
          "Owner",
          "isolated owner password",
        ),
      /Registration is closed/,
    );
    process.env.APP_URL = "http://public.example.test";
    assert.throws(
      () =>
        register(
          process.env.PILOT_OWNER_EMAIL!,
          "Owner",
          "isolated owner password",
        ),
      /Registration is closed/,
    );
  } finally {
    process.env.APP_URL = previousUrl;
    delete process.env.PILOT_OWNER_EMAIL;
  }
});

test("private runs close registration and reject other accounts, grants and queued work", () => {
  const owner = workspace(),
    other = workspace(),
    ownerGrant = grant(owner),
    otherGrant = grant(other),
    social = connection(other);
  const ownerBatch = batch(ownerGrant.grant.id),
    otherBatch = batch(otherGrant.grant.id);
  const ownerEmail = one<{ email: string }>(
    "SELECT u.email FROM users u JOIN workspaces w ON w.owner_id=u.id WHERE w.id=?",
    owner,
  )!.email;
  const otherEmail = one<{ email: string }>(
    "SELECT u.email FROM users u JOIN workspaces w ON w.owner_id=u.id WHERE w.id=?",
    other,
  )!.email;
  process.env.PILOT_OWNER_EMAIL = ownerEmail.toUpperCase();
  try {
    assert.throws(
      () =>
        register("another@example.test", "Another", "isolated owner password"),
      /Registration is closed/,
    );
    assert.ok(login(ownerEmail, "isolated owner password"));
    assert.throws(
      () => login(otherEmail, "isolated owner password"),
      /incorrect/,
    );
    assert.throws(
      () => getBatch(otherGrant.grant.id, otherBatch.id),
      /private owner/,
    );
    assert.throws(() => getConnection(other, social), /private owner/);
    assert.throws(
      () =>
        enqueue(
          other,
          "render",
          crypto.randomUUID(),
          otherBatch.videos[0].projectId!,
        ),
      /private owner/,
    );
    assert.equal(claimJob()!.id, ownerBatch.videos[0].id);
    assert.equal(claimJob(), null);
    assert.equal(getJob(other, otherBatch.videos[0].id).state, "queued");
  } finally {
    delete process.env.PILOT_OWNER_EMAIL;
  }
});

test("private workers preserve other accounts' schedules, publications and expired jobs", async () => {
  const owner = workspace(),
    other = workspace(),
    social = connection(other);
  const access = grant(other, 3, 10, policy([social], true));
  const queued = batch(access.grant.id);
  complete(other, queued.videos[0].id);
  planPublications();
  due();
  const unplanned = batch(access.grant.id);
  complete(other, unplanned.videos[0].id);
  const expired = batch(access.grant.id);
  run(
    "UPDATE jobs SET state='running',lease_until=0 WHERE id=?",
    expired.videos[0].id,
  );
  const pipeline = createPipeline(other, {
    name: "Other owner's schedule",
    config: { ...script, mode: "prompt" },
    intervalHours: 24,
    maxRuns: 2,
    budget: 10,
  });
  run("UPDATE pipelines SET active=1,next_run=0 WHERE id=?", pipeline.id);
  const snapshot = () =>
    JSON.stringify({
      jobs: all("SELECT * FROM jobs WHERE workspace_id=? ORDER BY id", other),
      projects: all(
        "SELECT * FROM projects WHERE workspace_id=? ORDER BY id",
        other,
      ),
      pipelines: all(
        "SELECT * FROM pipelines WHERE workspace_id=? ORDER BY id",
        other,
      ),
      publications: all(
        "SELECT * FROM publications WHERE workspace_id=? ORDER BY id",
        other,
      ),
      ledger: all(
        "SELECT * FROM credit_ledger WHERE workspace_id=? ORDER BY id",
        other,
      ),
      dispatched: all(
        "SELECT d.* FROM agent_batch_dispatch d JOIN jobs j ON j.id=d.job_id WHERE j.workspace_id=? ORDER BY job_id",
        other,
      ),
    });
  const before = snapshot();
  process.env.PILOT_OWNER_EMAIL = one<{ email: string }>(
    "SELECT u.email FROM users u JOIN workspaces w ON w.owner_id=u.id WHERE w.id=?",
    owner,
  )!.email;
  globalThis.fetch = async () => {
    throw new Error("Excluded accounts must not call a provider");
  };
  try {
    tickPipelines();
    recoverExpiredJobs();
    assert.equal(await publishTick(), false);
    assert.equal(snapshot(), before);
  } finally {
    delete process.env.PILOT_OWNER_EMAIL;
  }
});
