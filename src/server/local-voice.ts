import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { binary, execute } from "./media";
import { z } from "zod";

/** Kokoro voice, pitch factor and speed for each free voice option. */
const presets: Record<string, { voice: string; pitch: number; speed: number }> =
  {
    "free-cute": { voice: "af_sky", pitch: 1.14, speed: 1.3 },
    // Nicole: soft, close and calm; a touch faster so sentences don't drag.
    "free-warm": { voice: "af_nicole", pitch: 1, speed: 1.1 },
    "free-deep": { voice: "am_onyx", pitch: 0.94, speed: 1.1 },
    "free-bold": { voice: "af_bella", pitch: 1, speed: 1.12 },
  };

export type SpokenWord = { text: string; start: number; end: number };

const localSpeechOptionsSchema = z
  .object({
    voice: z
      .enum(["af_heart", "af_bella", "af_nicole", "af_sky", "am_onyx"])
      .optional(),
    pitch: z.number().min(0.8).max(1.2).optional(),
    speed: z.number().min(0.8).max(1.5).optional(),
    sentencePauseMs: z.number().int().min(0).max(500).default(0),
    speedVariation: z.number().min(0).max(0.08).default(0),
  })
  .strict();

export type LocalSpeechOptions = z.input<typeof localSpeechOptionsSchema>;

function python() {
  const path =
    process.env.VOICE_PYTHON ||
    resolve(
      process.platform === "win32"
        ? ".tools/voice-venv/Scripts/python.exe"
        : ".tools/voice-venv/bin/python",
    );
  if (!existsSync(path))
    throw new Error(
      "Free voices need the local voice environment. See README: create .tools/voice-venv with kokoro and soundfile.",
    );
  return path;
}

function run(command: string, args: string[], input: string, timeout: number) {
  return new Promise<string>((resolveResult, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      timeout,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolveResult(stdout)
        : reject(
            new Error(
              `Local voice failed: ${stderr.trim().split("\n").pop()?.slice(0, 300) || `exit ${code}`}`,
            ),
          ),
    );
    child.stdin.end(input);
  });
}

/** Speaks text with a free local voice; returns MP3 audio and word timings. */
export async function localSpeech(
  text: string,
  voice: string,
  options: LocalSpeechOptions = {},
) {
  return (await localSpeechBatch([text], voice, options))[0];
}

/** Reuses one model instance for every scene in a video. */
export async function localSpeechBatch(
  texts: string[],
  voice: string,
  options: LocalSpeechOptions = {},
) {
  const selected = presets[voice];
  if (!selected) throw new Error(`Unknown free voice: ${voice}`);
  const controls = localSpeechOptionsSchema.parse(options);
  const preset = {
    ...controls,
    voice: controls.voice ?? selected.voice,
    pitch: controls.pitch ?? selected.pitch,
    speed: controls.speed ?? selected.speed,
  };
  if (!texts.length || texts.length > 60)
    throw new Error("Narration needs 1 to 60 scenes.");
  const files = texts.map(() => {
    const id = crypto.randomUUID();
    return {
      wav: resolve(tmpdir(), `clipvero-${id}.wav`),
      mp3: resolve(tmpdir(), `clipvero-${id}.mp3`),
    };
  });
  try {
    const output = await run(
      python(),
      [resolve("scripts/voice/kokoro_tts.py")],
      JSON.stringify({
        scenes: texts.map((text, i) => ({ text, out: files[i].wav })),
        voice: preset.voice,
        speed: preset.speed,
        sentence_pause_ms: preset.sentencePauseMs,
        speed_variation: preset.speedVariation,
      }),
      Math.min(30 * 60_000, Math.max(600_000, 120_000 + texts.length * 60_000)),
    );
    const results = z
      .array(
        z.object({
          duration: z.number().positive().max(180),
          words: z.array(
            z
              .object({
                text: z.string().min(1),
                start: z.number().nonnegative(),
                end: z.number().positive(),
              })
              .refine((w) => w.end >= w.start),
          ),
        }),
      )
      .length(texts.length)
      .parse(JSON.parse(output));
    // Natural comparisons skip pitch processing; existing presets stay unchanged.
    const p = preset.pitch;
    const spoken = [];
    for (const [i, { wav, mp3 }] of files.entries()) {
      await execute(binary("ffmpeg"), [
        "-v",
        "error",
        "-y",
        "-i",
        wav,
        ...(p === 1
          ? []
          : [
              "-af",
              `asetrate=${Math.round(24000 * p)},aresample=24000,atempo=${(1 / p).toFixed(5)}`,
            ]),
        "-ac",
        "1",
        "-b:a",
        "128k",
        mp3,
      ]);
      spoken.push({ audio: await readFile(mp3), ...results[i] });
    }
    return spoken;
  } finally {
    await Promise.all(
      files.flatMap(({ wav, mp3 }) => [
        unlink(wav).catch(() => {}),
        unlink(mp3).catch(() => {}),
      ]),
    );
  }
}
