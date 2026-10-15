import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  rmSync,
  copyFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { parseEnv } from "node:util";
const script = resolve("scripts/setup-pilot.ts"),
  template = resolve(".env.example");
function setup(cwd: string) {
  return spawnSync(
    process.execPath,
    ["--import", import.meta.resolve("tsx"), script],
    { cwd, encoding: "utf8", windowsHide: true },
  );
}
test("pilot setup preserves secrets, seeds private fields and never prints the tunnel token", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "clipvero-pilot-env-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  copyFileSync(template, join(directory, ".env.example"));
  writeFileSync(
    join(directory, ".env"),
    "# Preserve my keys\nSESSION_SECRET=existing-session-secret-over-32-characters\nPOSTGRES_PASSWORD=existing-password\nDATABASE_URL=postgresql://private-db\nAPP_URL=http://localhost:3000\nOPENAI_API_KEY=fixture-provider-key\nNGROK_AUTHTOKEN=fixture-private-token\n",
  );
  const first = setup(directory);
  assert.equal(first.status, 0, first.stderr);
  const before = readFileSync(join(directory, ".env"), "utf8"),
    values = parseEnv(before);
  assert.equal(values.APP_URL, "http://localhost:3000");
  assert.equal(values.NGROK_DOMAIN, "");
  assert.equal(values.PILOT_OWNER_EMAIL, "");
  assert.equal(values.OPENAI_API_KEY, "fixture-provider-key");
  assert.ok(before.includes("# Preserve my keys"));
  const second = setup(directory);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(readFileSync(join(directory, ".env"), "utf8"), before);
  assert.doesNotMatch(
    first.stdout + first.stderr + second.stdout + second.stderr,
    /fixture-private-token|fixture-provider-key|existing-password/,
  );
});
test("pilot setup requires an existing owner and accepts only a hostname for APP_URL", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "clipvero-pilot-owner-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, "data"));
  const db = new DatabaseSync(join(directory, "data", "clipvero.db"));
  db.exec("CREATE TABLE users(id TEXT,email TEXT)");
  db.prepare("INSERT INTO users VALUES (?,?)").run(
    "owner",
    "owner@example.test",
  );
  db.close();
  const original =
    "SESSION_SECRET=existing-session-secret-over-32-characters\nPOSTGRES_PASSWORD=private-password\nDATABASE_URL=postgresql://private-db\nAPP_URL=http://localhost:3000\nNGROK_AUTHTOKEN=fixture-private-token\nNGROK_DOMAIN=assigned.ngrok-free.dev\nPILOT_OWNER_EMAIL=OWNER@example.test\n";
  writeFileSync(join(directory, ".env"), original);
  let result = setup(directory);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    parseEnv(readFileSync(join(directory, ".env"), "utf8")).APP_URL,
    "https://assigned.ngrok-free.dev",
  );
  assert.doesNotMatch(
    result.stdout + result.stderr,
    /fixture-private-token|private-password/,
  );
  for (const replacement of [
    original.replace("assigned.ngrok-free.dev", "https://other.example/path"),
    original.replace("OWNER@example.test", "absent@example.test"),
    original + "APP_URL=https://duplicate.example\n",
  ]) {
    writeFileSync(join(directory, ".env"), replacement);
    result = setup(directory);
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(join(directory, ".env"), "utf8"), replacement);
    assert.doesNotMatch(
      result.stdout + result.stderr,
      /fixture-private-token|private-password/,
    );
  }
});
