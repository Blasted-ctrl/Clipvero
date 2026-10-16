import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

function start(directory: string) {
  const child = spawn(
    process.execPath,
    [
      "--import",
      import.meta.resolve("tsx"),
      "--input-type=module",
      "-e",
      `const {db}=await import(${JSON.stringify(pathToFileURL(resolve("src/server/db.ts")).href)}); db.close();`,
    ],
    {
      env: { ...process.env, DATA_DIR: directory },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let error = "";
  child.stderr.on("data", (chunk) => (error += chunk.toString()));
  const timer = setTimeout(() => child.kill(), 30000);
  return new Promise<void>((done, fail) => {
    child.once("error", fail);
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) done();
      else fail(new Error(`startup exited ${code}: ${error}`));
    });
  });
}

test("allowances above 8 are possible after a one-time, concurrency-safe table rebuild", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "clipvero-grants-"));
  const db = new DatabaseSync(join(directory, "clipvero.db"));
  t.after(() => {
    if (db.isOpen) db.close();
  });
  // The database as it was before this change: migrations 001-003 only.
  for (const name of [
    "001_initial.sql",
    "002_agent_automation.sql",
    "003_social.sql",
  ])
    db.exec(readFileSync(resolve("migrations", name), "utf8"));
  assert.throws(
    () =>
      db.exec(
        "INSERT INTO agent_grants(id,workspace_id,name,token_hash,run_limit,credit_limit,policy,expires_at,created_at) VALUES ('x','w','x','x',50,10,'null',1,1)",
      ),
    /CHECK|FOREIGN|constraint/i,
  );
  db.exec(`
    INSERT INTO users VALUES ('u','u@example.test','U','h',0);
    INSERT INTO workspaces(id,owner_id,name,credits,created_at) VALUES ('w','u','W',120,0);
    INSERT INTO agent_grants(id,workspace_id,name,token_hash,run_limit,credit_limit,runs,spent,policy,expires_at,created_at)
      VALUES ('g','w','Keep me','hash-1',3,20,2,2,'{"a":1}',9999999999999,5);
    INSERT INTO agent_batches VALUES ('b','w','g','req','h',6);
  `);
  db.close();

  await Promise.all([start(directory), start(directory), start(directory)]);

  const after = new DatabaseSync(join(directory, "clipvero.db"));
  t.after(() => {
    after.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const grant = after
    .prepare("SELECT * FROM agent_grants WHERE id='g'")
    .get() as Record<string, unknown>;
  assert.equal(grant.name, "Keep me");
  assert.equal(grant.run_limit, 3);
  assert.equal(grant.runs, 2);
  assert.equal(grant.policy, '{"a":1}');
  assert.equal(
    (
      after
        .prepare("SELECT COUNT(*) AS n FROM agent_batches WHERE grant_id='g'")
        .get() as { n: number }
    ).n,
    1,
    "children still point at the rebuilt table",
  );
  after.exec("PRAGMA foreign_keys=ON");
  assert.equal(after.prepare("PRAGMA foreign_key_check").all().length, 0);
  after.exec(
    "INSERT INTO agent_grants(id,workspace_id,name,token_hash,run_limit,credit_limit,policy,expires_at,created_at) VALUES ('big','w','Fifty','hash-2',50,500,'null',9999999999999,7)",
  );
  assert.throws(
    () =>
      after.exec(
        "INSERT INTO agent_grants(id,workspace_id,name,token_hash,run_limit,credit_limit,policy,expires_at,created_at) VALUES ('huge','w','Too many','hash-3',501,500,'null',9999999999999,8)",
      ),
    /CHECK/i,
  );
  assert.equal(
    (
      after
        .prepare(
          "SELECT COUNT(*) AS n FROM sqlite_master WHERE name='agent_grants_new'",
        )
        .get() as { n: number }
    ).n,
    0,
  );
  assert.equal(
    (
      after
        .prepare(
          "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='index' AND name='agent_grants_workspace'",
        )
        .get() as { n: number }
    ).n,
    1,
  );
});
