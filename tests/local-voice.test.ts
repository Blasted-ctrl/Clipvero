import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";

const directory = mkdtempSync(join(tmpdir(), "clipvero-local-voice-test-"));
process.env.DATA_DIR = directory;
const { localSpeechBatch } = await import("../src/server/local-voice");
const { db } = await import("../src/server/db");
after(() => {
  db.close();
  rmSync(directory, { recursive: true, force: true });
});

test("local voice comparison controls reject unsafe or unsupported input before synthesis", async () => {
  await assert.rejects(localSpeechBatch(["Hello."], "free-cute", { speed: 4 }));
  await assert.rejects(localSpeechBatch(["Hello."], "free-cute", { pitch: 0 }));
  await assert.rejects(
    localSpeechBatch(["Hello."], "free-cute", { sentencePauseMs: 501 }),
  );
  await assert.rejects(
    localSpeechBatch(["Hello."], "free-cute", { speedVariation: 0.5 }),
  );
  await assert.rejects(
    localSpeechBatch(["Hello."], "free-cute", {
      voice: "../../secret" as "af_sky",
    }),
  );
  await assert.rejects(localSpeechBatch([], "free-cute", { pitch: 1 }));
});
