import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { scriptTimeline } from "../src/lib/model";

test("an unavailable render browser leaves queued jobs and reserved credits untouched", async () => {
  const directory = mkdtempSync(join(tmpdir(), "clipvero-worker-start-"));
  const db = new DatabaseSync(join(directory, "clipvero.db"));
  for (const migration of [
    "001_initial.sql",
    "002_agent_automation.sql",
    "003_social.sql",
  ])
    db.exec(readFileSync(resolve("migrations", migration), "utf8"));
  const timeline = JSON.stringify(
    scriptTimeline("Original worker startup check.", "9:16", 5),
  );
  db.exec(
    "INSERT INTO users VALUES ('owner','owner@example.test','Owner','unused-fixture-hash',0); INSERT INTO workspaces(id,owner_id,name,credits,created_at) VALUES ('workspace','owner','Owner',119,0)",
  );
  db.prepare(
    "INSERT INTO projects(id,workspace_id,title,mode,timeline,created_at,updated_at) VALUES ('project','workspace','Startup','script',?,0,0)",
  ).run(timeline);
  db.prepare(
    "INSERT INTO jobs(id,workspace_id,project_id,kind,input,revision,cost,idempotency_key,created_at,updated_at) VALUES ('job','workspace','project','render',?,1,1,'startup-check',0,0)",
  ).run(JSON.stringify({ timeline: JSON.parse(timeline) }));
  const child = spawn(
    process.execPath,
    ["--import", import.meta.resolve("tsx"), resolve("src/worker/main.ts")],
    {
      env: {
        ...process.env,
        DATA_DIR: directory,
        PILOT_OWNER_EMAIL: "",
        REMOTION_BROWSER_EXECUTABLE: join(directory, "missing-browser.exe"),
      },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolveResult, reject) => {
      const read = (chunk: Buffer) => {
        output += chunk.toString();
        if (/Worker loop:|"event":"job.failed"/.test(output)) resolveResult();
      };
      child.stdout.on("data", read);
      child.stderr.on("data", read);
      child.once("error", reject);
      child.once("exit", (code) =>
        reject(new Error(`Worker exited ${code}: ${output}`)),
      );
      timer = setTimeout(
        () => reject(new Error(`Worker startup timed out: ${output}`)),
        30000,
      );
    });
    assert.equal(
      db.prepare("SELECT state FROM jobs WHERE id='job'").get()!.state,
      "queued",
    );
    assert.equal(
      db.prepare("SELECT credits FROM workspaces WHERE id='workspace'").get()!
        .credits,
      119,
    );
    assert.equal(
      db.prepare("SELECT count(*) AS n FROM credit_ledger").get()!.n,
      0,
    );
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null && child.signalCode === null) {
      const closed = new Promise((resolveResult) =>
        child.once("close", resolveResult),
      );
      child.kill();
      await closed;
    }
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
