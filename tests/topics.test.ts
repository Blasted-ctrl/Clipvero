import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "clipvero-topics-"));
process.env.IDEAS_DIR = mkdtempSync(join(tmpdir(), "clipvero-ideas-"));
process.env.CLAUDE_BIN = "none";
process.env.CODEX_BIN = "none";
process.env.CLIPVERO_TEXT_PROVIDERS = "openai";
process.env.OPENAI_API_KEY = "test-key";
const { db, run } = await import("../src/server/db");
const {
  indexIdeas,
  listSources,
  markTopicUsed,
  nextTopics,
  similar,
  textChapters,
} = await import("../src/server/topics");

after(() => {
  db.close();
  rmSync(process.env.DATA_DIR!, { recursive: true, force: true });
  rmSync(process.env.IDEAS_DIR!, { recursive: true, force: true });
});
run("INSERT INTO users VALUES ('u','u@example.test','U','x',0)");
run(
  "INSERT INTO workspaces(id,owner_id,name,credits,created_at) VALUES ('w','u','W',100,0)",
);

test("text notes split into chapters at headings", () => {
  const chapters = textChapters(
    "# Threads\nA thread runs code.\n## Thread pools\nWorkers wait for tasks.",
    "notes",
  );
  assert.deepEqual(
    chapters.map((c) => c.title),
    ["Threads", "Thread pools"],
  );
  assert.equal(chapters[1].text, "Workers wait for tasks.");
});

test("similar topics are detected so they are not queued twice", () => {
  assert.ok(
    similar("How a thread pool reuses workers", "Thread pool: reusing workers"),
  );
  assert.ok(!similar("Binary search halves the list", "Hash map buckets"));
});

test("the ideas folder is indexed into a deduplicated, round-robin topic queue", async () => {
  const filler =
    " Workers pick tasks from a shared queue so threads are reused instead of created per task.".repeat(
      4,
    );
  writeFileSync(
    join(process.env.IDEAS_DIR!, "concurrency.md"),
    `# Thread pools\n${filler}\n# Futures\n${filler}`,
  );
  writeFileSync(
    join(process.env.IDEAS_DIR!, "algos.md"),
    `# Sorting\n${filler}`,
  );
  writeFileSync(join(process.env.IDEAS_DIR!, "links.txt"), "not a url\n");
  assert.equal(listSources().length, 2);
  let call = 0;
  const replies = [
    [{ topic: "Merge sort in one picture", style: "explainer" }],
    [
      { topic: "How a thread pool reuses workers", style: "conversation" },
      { topic: "Why thread pools beat spawning threads", style: "explainer" },
    ],
    [
      { topic: "Thread pool: reusing workers", style: "explainer" },
      { topic: "What a future actually waits for", style: "explainer" },
    ],
  ];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({ topics: replies[call++] ?? [] }),
          },
        },
      ],
    })) as typeof fetch;
  try {
    const { added } = await indexIdeas("w");
    assert.equal(added, 4, "the near-duplicate thread pool topic is skipped");
    assert.equal(
      (await indexIdeas("w")).added,
      0,
      "indexed sources are not reprocessed",
    );
  } finally {
    globalThis.fetch = realFetch;
  }
  const picked = nextTopics("w", 3);
  assert.equal(picked.length, 3);
  assert.notEqual(
    picked[0].source,
    picked[1].source,
    "topics alternate between sources",
  );
  markTopicUsed("w", picked[0].id, null);
  assert.ok(!nextTopics("w", 10).some((t) => t.id === picked[0].id));
});
