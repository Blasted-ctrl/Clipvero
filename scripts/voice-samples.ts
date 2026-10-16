import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { binary, execute } from "../src/server/media";

// Usage: pnpm voice:samples
// Speaks the same lines with every voice you have access to and saves MP3s to
// ~/Videos/voice-samples so you can compare them by ear. Providers without a key
// are skipped; the free local Kokoro voices always run.
const out = resolve(
  process.env.VOICE_SAMPLES_DIR || join(homedir(), "Videos", "voice-samples"),
);
mkdirSync(out, { recursive: true });
const plain =
  "Your code works on ten items. Cool. Now give it a million, and watch what happens to the time.";
const emotive =
  "[curious] Your code works on ten items. [laughs] Cool. [excited] Now give it a million, and watch what happens to the time.";
const style =
  "Say this like a friendly, quick-witted tech creator talking to a friend, with natural breaths, real emotion and varied pace: ";
const saved: string[] = [];
const failed: string[] = [];

async function toMp3(input: Buffer | string, name: string, rawPcm = false) {
  const file = join(out, `${name}.mp3`);
  if (typeof input === "string")
    await execute(binary("ffmpeg"), [
      "-v",
      "error",
      "-y",
      "-i",
      input,
      "-b:a",
      "160k",
      file,
    ]);
  else {
    const raw = join(
      tmpdir(),
      `clipvero-sample-${crypto.randomUUID()}.${rawPcm ? "pcm" : "mp3"}`,
    );
    writeFileSync(raw, input);
    await execute(
      binary("ffmpeg"),
      rawPcm
        ? [
            "-v",
            "error",
            "-y",
            "-f",
            "s16le",
            "-ar",
            "24000",
            "-ac",
            "1",
            "-i",
            raw,
            "-b:a",
            "160k",
            file,
          ]
        : ["-v", "error", "-y", "-i", raw, "-b:a", "160k", file],
    );
  }
  saved.push(`${name}.mp3`);
}
async function attempt(label: string, work: () => Promise<void>) {
  try {
    await work();
  } catch (error) {
    failed.push(
      `${label}: ${error instanceof Error ? error.message : "failed"}`,
    );
  }
}

// Free local Kokoro voices, with no pitch shifting and natural speeds.
const python =
  process.env.VOICE_PYTHON ||
  resolve(
    process.platform === "win32"
      ? ".tools/voice-venv/Scripts/python.exe"
      : ".tools/voice-venv/bin/python",
  );
function kokoro(voice: string, speed: number, file: string) {
  return new Promise<void>((done, fail) => {
    const child = spawn(python, [resolve("scripts/voice/kokoro_tts.py")], {
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    let error = "";
    child.stderr.on("data", (c) => (error += c.toString()));
    child.on("close", (code) =>
      code === 0
        ? done()
        : fail(new Error(error.trim().split("\n").pop() || `exit ${code}`)),
    );
    child.stdin.end(JSON.stringify({ text: plain, voice, speed, out: file }));
  });
}
for (const voice of [
  "af_heart",
  "af_bella",
  "af_nicole",
  "af_sky",
  "am_michael",
])
  for (const speed of [1.0, 1.12])
    await attempt(`kokoro ${voice}`, async () => {
      const wav = join(tmpdir(), `clipvero-${crypto.randomUUID()}.wav`);
      await kokoro(voice, speed, wav);
      await toMp3(wav, `kokoro-${voice}-${speed.toFixed(2)}x`);
    });

const eleven = process.env.ELEVENLABS_API_KEY?.trim();
if (eleven) {
  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": eleven },
  });
  const voices = response.ok
    ? (
        (await response.json()) as {
          voices: { voice_id: string; name: string; category?: string }[];
        }
      ).voices
    : [];
  if (!response.ok)
    failed.push(`elevenlabs voices list: HTTP ${response.status}`);
  for (const v of voices.filter((x) => x.category === "premade").slice(0, 8))
    await attempt(`elevenlabs ${v.name}`, async () => {
      const model = process.env.ELEVENLABS_MODEL?.trim() || "eleven_v3";
      const speak = (m: string) =>
        fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${v.voice_id}?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: {
              "xi-api-key": eleven,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: m === "eleven_v3" ? emotive : plain,
              model_id: m,
            }),
          },
        );
      let r = await speak(model);
      if (!r.ok && model === "eleven_v3")
        r = await speak("eleven_multilingual_v2");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await toMp3(
        Buffer.from(await r.arrayBuffer()),
        `elevenlabs-${v.name.replace(/\W+/g, "")}`,
      );
    });
}

const openai = process.env.OPENAI_API_KEY?.trim();
if (openai)
  for (const voice of ["coral", "sage", "nova", "shimmer", "ash"])
    await attempt(`openai ${voice}`, async () => {
      const r = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openai}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_SPEECH_MODEL || "gpt-4o-mini-tts",
          voice,
          input: plain,
          instructions: style,
          response_format: "mp3",
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await toMp3(Buffer.from(await r.arrayBuffer()), `openai-${voice}`);
    });

const google = (
  process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
)?.trim();
if (google)
  for (const voice of ["Kore", "Puck", "Zephyr", "Leda", "Aoede", "Charon"])
    await attempt(`gemini ${voice}`, async () => {
      const model =
        process.env.GEMINI_TTS_MODEL?.trim() || "gemini-2.5-flash-preview-tts";
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "x-goog-api-key": google,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${style}${plain}` }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
              },
            },
          }),
        },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as {
        candidates?: {
          content?: { parts?: { inlineData?: { data?: string } }[] };
        }[];
      };
      const base64 =
        data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64) throw new Error("no audio returned");
      await toMp3(Buffer.from(base64, "base64"), `gemini-${voice}`, true);
    });

console.log(`Saved ${saved.length} samples to ${out}`);
for (const name of saved) console.log(`  ${name}`);
if (failed.length) {
  console.log("Skipped:");
  for (const line of failed) console.log(`  ${line}`);
}
console.log(
  `Providers with a key: ${[eleven && "ElevenLabs", openai && "OpenAI", google && "Gemini"].filter(Boolean).join(", ") || "none (Kokoro only)"}`,
);
