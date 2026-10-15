import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { urlVerification } from "../src/server/url-verification";
test("URL verification serves only small plain text proofs from its fixed directory", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "clipvero-url-proof-")),
    previous = process.cwd();
  process.chdir(directory);
  t.after(() => {
    process.chdir(previous);
    rmSync(directory, { recursive: true, force: true });
  });
  const root = join(directory, ".local-services", "tiktok-verification");
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "tiktokProof.txt"), "owner-verification-value\n");
  writeFileSync(join(root, "large.txt"), "x".repeat(4097));
  writeFileSync(join(directory, ".env"), "PRIVATE=not-public");
  const response = urlVerification("tiktokProof.txt")!;
  assert.equal(await response.text(), "owner-verification-value\n");
  assert.match(response.headers.get("content-type")!, /text\/plain/);
  assert.equal(urlVerification("tiktokProof.txt", true)!.body, null);
  for (const name of [
    "../.env",
    ".env",
    "missing.txt",
    "large.txt",
    "tiktokProof.txt/../.env",
  ])
    assert.equal(urlVerification(name), null);
});
