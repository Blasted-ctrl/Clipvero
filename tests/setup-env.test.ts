import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseEnv } from "node:util";
import { test } from "node:test";
import assert from "node:assert/strict";

const script = resolve("scripts/setup-env.ts");
const template = resolve(".env.example");

function setup(directory: string) {
  return spawnSync(
    process.execPath,
    ["--import", import.meta.resolve("tsx"), script],
    {
      cwd: directory,
      encoding: "utf8",
      windowsHide: true,
    },
  );
}

test("setup creates distinct secrets and a matching database URL without printing credentials", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "clipvero-env-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  copyFileSync(template, join(directory, ".env.example"));
  const result = setup(directory);
  assert.equal(result.status, 0, result.stderr);
  const values = parseEnv(readFileSync(join(directory, ".env"), "utf8"));
  assert.ok(
    values.SESSION_SECRET && values.POSTGRES_PASSWORD && values.DATABASE_URL,
  );
  assert.match(values.SESSION_SECRET, /^[a-f0-9]{64}$/);
  assert.match(values.POSTGRES_PASSWORD, /^[a-f0-9]{64}$/);
  assert.notEqual(values.SESSION_SECRET, values.POSTGRES_PASSWORD);
  assert.equal(new URL(values.DATABASE_URL).password, values.POSTGRES_PASSWORD);
  assert.equal(values.OPENAI_API_KEY, "");
  assert.equal(values.STRIPE_SECRET_KEY, "");
  for (const secret of [values.SESSION_SECRET, values.POSTGRES_PASSWORD])
    assert.equal(`${result.stdout}${result.stderr}`.includes(secret), false);
});

test("setup preserves existing credentials, custom connections and comments on repeated runs", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "clipvero-env-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const original = [
    "# Keep the deployment credentials",
    'SESSION_SECRET="existing-private-session-value"',
    'POSTGRES_PASSWORD="custom#password"',
    "DATABASE_URL=postgresql+psycopg://clipvero:custom%23password@db.example.com/clipvero",
    "OPENAI_API_KEY=private-provider-credential",
    "",
  ].join("\n");
  writeFileSync(join(directory, ".env"), original);
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = setup(directory);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(directory, ".env"), "utf8"), original);
    assert.doesNotMatch(
      result.stdout + result.stderr,
      /private-|custom#password/,
    );
  }
});

test("setup fills blank secrets and encodes an existing password in the local database URL", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "clipvero-env-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(
    join(directory, ".env"),
    '  SESSION_SECRET=\nPOSTGRES_PASSWORD="a#b@c%"\nDATABASE_URL=\nAPP_URL=http://localhost:3000\n',
  );
  const result = setup(directory);
  assert.equal(result.status, 0, result.stderr);
  const content = readFileSync(join(directory, ".env"), "utf8");
  const values = parseEnv(content);
  assert.ok(values.SESSION_SECRET && values.DATABASE_URL);
  assert.match(values.SESSION_SECRET, /^[a-f0-9]{64}$/);
  assert.equal(values.POSTGRES_PASSWORD, "a#b@c%");
  assert.equal(new URL(values.DATABASE_URL).password, "a%23b%40c%25");
  assert.equal(setup(directory).status, 0);
  assert.equal(readFileSync(join(directory, ".env"), "utf8"), content);
});

test("setup rejects duplicate critical settings before changing the file", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "clipvero-env-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const original = "SESSION_SECRET=\n  export SESSION_SECRET=private-value\n";
  writeFileSync(join(directory, ".env"), original);
  const result = setup(directory);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Remove duplicate SESSION_SECRET/);
  assert.equal(readFileSync(join(directory, ".env"), "utf8"), original);
});
