import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

function initialize(directory: string, starting?: () => void) {
  const child = spawn(
    process.execPath,
    [
      "--import",
      import.meta.resolve("tsx"),
      "--input-type=module",
      "-e",
      `console.log('starting'); const {db}=await import(${JSON.stringify(pathToFileURL(resolve("src/server/db.ts")).href)}); db.close();`,
    ],
    {
      env: { ...process.env, DATA_DIR: directory },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let error = "";
  child.stderr.on("data", (chunk) => {
    error += chunk.toString();
  });
  child.stdout.once("data", () => starting?.());
  const timer = setTimeout(() => child.kill(), 20000);
  return new Promise<void>((resolveResult, reject) => {
    child.once("error", reject);
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolveResult();
      else
        reject(new Error(`Database initialization exited ${code}: ${error}`));
    });
  });
}

test("database startup waits for a concurrent lock before enabling WAL", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "clipvero-db-lock-"));
  const db = new DatabaseSync(join(directory, "clipvero.db"));
  db.exec(
    "CREATE TABLE preserved(value TEXT); INSERT INTO preserved VALUES ('keep'); BEGIN EXCLUSIVE",
  );
  let release: ReturnType<typeof setTimeout> | undefined;
  t.after(() => {
    clearTimeout(release);
    if (db.isTransaction) db.exec("ROLLBACK");
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  await initialize(directory, () => {
    release = setTimeout(() => db.exec("COMMIT"), 1500);
  });
  assert.equal(db.prepare("SELECT value FROM preserved").get()!.value, "keep");
  assert.equal(db.prepare("PRAGMA journal_mode").get()!.journal_mode, "wal");
});

test("simultaneous startup upgrades older social databases without losing rows", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "clipvero-db-upgrade-"));
  const db = new DatabaseSync(join(directory, "clipvero.db"));
  for (const migration of [
    "001_initial.sql",
    "002_agent_automation.sql",
    "003_social.sql",
  ])
    db.exec(readFileSync(resolve("migrations", migration), "utf8"));
  db.exec(
    "ALTER TABLE social_connections DROP COLUMN refresh_until; ALTER TABLE social_connections DROP COLUMN refresh_owner; ALTER TABLE publications DROP COLUMN lease_token; INSERT INTO users VALUES ('preserved-user','owner@example.test','Owner','unused-fixture-hash',0)",
  );
  db.close();
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  await Promise.all(Array.from({ length: 4 }, () => initialize(directory)));
  const upgraded = new DatabaseSync(join(directory, "clipvero.db"), {
    readOnly: true,
  });
  try {
    assert.equal(
      upgraded
        .prepare("SELECT COUNT(*) AS n FROM users WHERE id='preserved-user'")
        .get()!.n,
      1,
    );
    const connections = upgraded
      .prepare("PRAGMA table_info(social_connections)")
      .all();
    assert.ok(connections.some((c) => c.name === "refresh_until"));
    assert.ok(connections.some((c) => c.name === "refresh_owner"));
    assert.ok(
      upgraded
        .prepare("PRAGMA table_info(publications)")
        .all()
        .some((c) => c.name === "lease_token"),
    );
  } finally {
    upgraded.close();
  }
});
