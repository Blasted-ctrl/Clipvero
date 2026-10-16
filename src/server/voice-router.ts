import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { localSpeechBatch, type SpokenWord } from "./local-voice";
import { binary, execute } from "./media";

/**
 * Narration with the most expressive voice available: ElevenLabs, then Gemini
 * (word timing from Whisper on Groq), then OpenAI's instructable TTS, then local
 * Kokoro. Order comes from CLIPVERO_VOICE_PROVIDERS.
 */
export type Spoken = {
  audio: Buffer;
  duration: number;
  words: SpokenWord[];
  provider: string;
};

const personas: Record<
  string,
  {
    eleven: string;
    elevenEnv: string;
    openai: string;
    style: string;
    gemini: string;
    geminiEnv: string;
    geminiStyle: string;
    orpheus: string;
    orpheusEnv: string;
  }
> = {
  "free-cute": {
    eleven: "MF3mGyEYCl7XYWbV9V6O",
    elevenEnv: "ELEVENLABS_VOICE_CUTE",
    openai: "coral",
    gemini: "Leda",
    geminiEnv: "GEMINI_VOICE_CUTE",
    orpheus: "hannah",
    orpheusEnv: "GROQ_VOICE_CUTE",
    geminiStyle:
      "bright, playful and youthful, like an excited friend sharing something cool, with natural breaths and real emotion, at a quick, energetic pace with no long pauses",
    style:
      "Bright, playful and youthful, like an excited friend sharing something cool. Real emotion, natural breaths, varied pace, little laughs where they fit.",
  },
  "free-warm": {
    eleven: "EXAVITQu4vr4xnSDxMaL",
    elevenEnv: "ELEVENLABS_VOICE_WARM",
    openai: "sage",
    gemini: "Kore",
    geminiEnv: "GEMINI_VOICE_WARM",
    orpheus: "autumn",
    orpheusEnv: "GROQ_VOICE_WARM",
    geminiStyle:
      "warm, calm and encouraging, like a favourite teacher, with natural breaths and gentle emphasis, at a steady, unhurried but flowing pace with no long pauses",
    style:
      "Warm, calm and encouraging teacher. Natural breaths, gentle emphasis on key words, conversational pace.",
  },
  "free-deep": {
    eleven: "pNInz6obpgDQGcFmaJgB",
    elevenEnv: "ELEVENLABS_VOICE_DEEP",
    openai: "onyx",
    gemini: "Charon",
    geminiEnv: "GEMINI_VOICE_DEEP",
    orpheus: "troy",
    orpheusEnv: "GROQ_VOICE_DEEP",
    geminiStyle:
      "deep, confident and measured, like a storyteller, with short dramatic pauses and natural breaths, at a brisk pace",
    style:
      "Deep, confident storyteller. Measured pace, dramatic pauses, natural breaths, real conviction.",
  },
  "free-bold": {
    eleven: "AZnzlk1XvdvUeBnXmlld",
    elevenEnv: "ELEVENLABS_VOICE_BOLD",
    openai: "shimmer",
    gemini: "Zephyr",
    geminiEnv: "GEMINI_VOICE_BOLD",
    orpheus: "diana",
    orpheusEnv: "GROQ_VOICE_BOLD",
    geminiStyle:
      "bold, confident and a little sassy, like a creator who knows exactly what they are talking about, with natural breaths, at a quick pace with no long pauses",
    style:
      "Bold, confident and a little sassy. Quick, punchy delivery, natural breaths, real attitude.",
  },
};

/** Generated voices are sped up (pitch preserved) so sentences don't drag. */
const tempo = (provider: "gemini" | "groq" | "eleven") => {
  const forced = Number(process.env.VOICE_TEMPO);
  if (Number.isFinite(forced) && forced >= 0.8 && forced <= 1.6) return forced;
  return provider === "gemini" ? 1.15 : provider === "groq" ? 1.12 : 1.1;
};

/**
 * Speeds audio up without changing its pitch. Returns the factor actually
 * applied: if encoding fails the original audio is kept (factor 1) so narration
 * is never lost and timings are never scaled for audio that wasn't changed.
 */
async function speedUp(audio: Buffer, factor: number) {
  if (factor === 1) return { audio, factor };
  const id = crypto.randomUUID();
  const input = join(tmpdir(), `clipvero-speed-${id}-in.mp3`);
  const output = join(tmpdir(), `clipvero-speed-${id}-out.mp3`);
  try {
    await writeFile(input, audio);
    await execute(binary("ffmpeg"), [
      "-v",
      "error",
      "-y",
      "-i",
      input,
      "-filter:a",
      `atempo=${factor}`,
      "-b:a",
      "128k",
      output,
    ]);
    return { audio: await readFile(output), factor };
  } catch {
    return { audio, factor: 1 };
  } finally {
    await unlink(input).catch(() => {});
    await unlink(output).catch(() => {});
  }
}

const order = () =>
  (
    process.env.CLIPVERO_VOICE_PROVIDERS ||
    "elevenlabs,gemini,groq,openai,local"
  )
    .split(",")
    .map((id) => id.trim());

/** Turns per-character timings into words, dropping v3 audio tags like [excited]. */
export function wordsFromAlignment(alignment: {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}) {
  const words: SpokenWord[] = [];
  let current: SpokenWord | null = null;
  let inTag = false;
  alignment.characters.forEach((char, i) => {
    if (char === "[") inTag = true;
    if (inTag) {
      if (char === "]") inTag = false;
      return;
    }
    if (/\s/.test(char)) {
      if (current) words.push(current);
      current = null;
      return;
    }
    const start = alignment.character_start_times_seconds[i];
    const end = alignment.character_end_times_seconds[i];
    if (!current) current = { text: char, start, end };
    else {
      current.text += char;
      current.end = end;
    }
  });
  if (current) words.push(current);
  return words.filter((w) => /[\p{L}\p{N}]/u.test(w.text));
}

const alignmentSchema = z.object({
  audio_base64: z.string().min(1),
  alignment: z.object({
    characters: z.array(z.string()),
    character_start_times_seconds: z.array(z.number()),
    character_end_times_seconds: z.array(z.number()),
  }),
});

async function elevenLabs(text: string, persona: (typeof personas)[string]) {
  const key = process.env.ELEVENLABS_API_KEY!;
  const voice = process.env[persona.elevenEnv]?.trim() || persona.eleven;
  const models = [
    process.env.ELEVENLABS_MODEL?.trim() || "eleven_v3",
    "eleven_multilingual_v2",
  ];
  let lastStatus = 0;
  for (const model of [...new Set(models)]) {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}/with-timestamps?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ text, model_id: model }),
        signal: AbortSignal.timeout(120000),
      },
    );
    if (response.ok) {
      const data = alignmentSchema.parse(await response.json());
      const words = wordsFromAlignment(data.alignment);
      const ends = data.alignment.character_end_times_seconds;
      // ElevenLabs v3 ignores its speed setting, so the speed-up is applied here
      // and the word timings are scaled to match, keeping captions in sync.
      const fast = await speedUp(
        Buffer.from(data.audio_base64, "base64"),
        tempo("eleven"),
      );
      const factor = fast.factor;
      return {
        audio: fast.audio,
        duration:
          (ends[ends.length - 1] ?? words[words.length - 1]?.end ?? 0) / factor,
        words: words.map((w) => ({
          text: w.text,
          start: w.start / factor,
          end: w.end / factor,
        })),
        provider: `elevenlabs:${model}`,
      };
    }
    lastStatus = response.status;
    // Retry an older model only when this one rejected the request itself.
    if (![400, 404, 422].includes(response.status)) break;
  }
  throw new Error(`ElevenLabs returned HTTP ${lastStatus}`);
}

async function openAI(text: string, persona: (typeof personas)[string]) {
  const key = process.env.OPENAI_API_KEY!;
  const speech = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_SPEECH_MODEL || "gpt-4o-mini-tts",
      voice: persona.openai,
      input: text,
      instructions: persona.style,
      response_format: "mp3",
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!speech.ok)
    throw new Error(`OpenAI speech returned HTTP ${speech.status}`);
  const audio = Buffer.from(await speech.arrayBuffer());
  const form = new FormData();
  form.set("model", "whisper-1");
  form.set("response_format", "verbose_json");
  form.set("timestamp_granularities[]", "word");
  form.set(
    "file",
    new Blob([new Uint8Array(audio)], { type: "audio/mpeg" }),
    "speech.mp3",
  );
  const transcript = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(120000),
    },
  );
  if (!transcript.ok)
    throw new Error(`OpenAI transcription returned HTTP ${transcript.status}`);
  const data = z
    .object({
      duration: z.number().positive(),
      words: z.array(
        z.object({ word: z.string(), start: z.number(), end: z.number() }),
      ),
    })
    .parse(await transcript.json());
  // Whisper drops punctuation; reuse the script's words when the counts line up.
  const scriptWords = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  const same = scriptWords.length === data.words.length;
  return {
    audio,
    duration: data.duration,
    words: data.words.map((w, i) => ({
      text: same ? scriptWords[i] : w.word,
      start: w.start,
      end: Math.max(w.end, w.start),
    })),
    provider: "openai",
  };
}

const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));
const groqKeys = () =>
  (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);

/** Word timings for speech audio from Whisper on Groq, using the script's own spelling. */
async function groqAlign(audio: Buffer, text: string) {
  const [key] = groqKeys();
  if (!key)
    throw new Error(
      "This narration needs word timing: add a Groq key (GROQ_API_KEYS) or use another voice provider.",
    );
  const form = new FormData();
  form.set("model", process.env.GROQ_WHISPER_MODEL || "whisper-large-v3-turbo");
  form.set("response_format", "verbose_json");
  form.set("timestamp_granularities[]", "word");
  form.set("language", "en");
  form.set(
    "file",
    new Blob([new Uint8Array(audio)], { type: "audio/mpeg" }),
    "speech.mp3",
  );
  let response: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
        signal: AbortSignal.timeout(120000),
      },
    );
    if (response.status !== 429) break;
    await pause(Number(process.env.VOICE_RETRY_MS ?? 8000) * (attempt + 1));
  }
  if (!response?.ok)
    throw new Error(`Groq transcription returned HTTP ${response?.status}`);
  const data = z
    .object({
      duration: z.number().positive(),
      words: z.array(
        z.object({ word: z.string(), start: z.number(), end: z.number() }),
      ),
    })
    .parse(await response.json());
  const scriptWords = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  const same = scriptWords.length === data.words.length;
  return {
    duration: data.duration,
    words: data.words.map((w, i) => ({
      text: same ? scriptWords[i] : w.word.trim(),
      start: w.start,
      end: Math.max(w.end, w.start),
    })),
  };
}

async function gemini(text: string, persona: (typeof personas)[string]) {
  const key = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ""
  ).trim();
  const model =
    process.env.GEMINI_TTS_MODEL?.trim() || "gemini-2.5-flash-preview-tts";
  const voiceName = process.env[persona.geminiEnv]?.trim() || persona.gemini;
  let response: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { parts: [{ text: `Say this ${persona.geminiStyle}: ${text}` }] },
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName } },
            },
          },
        }),
        signal: AbortSignal.timeout(120000),
      },
    );
    if (response.status !== 429) break;
    await pause(Number(process.env.VOICE_RETRY_MS ?? 8000) * (attempt + 1));
  }
  if (!response?.ok)
    throw new Error(`Gemini speech returned HTTP ${response?.status}`);
  const data = (await response.json()) as {
    candidates?: {
      content?: { parts?: { inlineData?: { data?: string } }[] };
    }[];
  };
  const base64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64) throw new Error("Gemini returned no audio.");
  // Gemini returns raw 24 kHz 16-bit mono PCM; encode it so it plays everywhere.
  const id = crypto.randomUUID();
  const raw = join(tmpdir(), `clipvero-gemini-${id}.pcm`);
  const mp3 = join(tmpdir(), `clipvero-gemini-${id}.mp3`);
  try {
    await writeFile(raw, Buffer.from(base64, "base64"));
    await execute(binary("ffmpeg"), [
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
      "-filter:a",
      `atempo=${tempo("gemini")}`,
      "-b:a",
      "128k",
      mp3,
    ]);
    const audio = await readFile(mp3);
    const aligned = await groqAlign(audio, text);
    return { audio, ...aligned, provider: `gemini:${voiceName}` };
  } finally {
    await unlink(raw).catch(() => {});
    await unlink(mp3).catch(() => {});
  }
}

/** Splits text at sentence ends into pieces no longer than `max` characters. */
export function sentenceChunks(text: string, max = 380) {
  const parts = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const part of parts) {
    if (current && (current + part).length > max) {
      chunks.push(current.trim());
      current = part;
    } else current += part;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/** Orpheus on Groq: very natural, emotional speech; Whisper supplies word timing. */
async function orpheus(text: string, persona: (typeof personas)[string]) {
  const [key] = groqKeys();
  if (!key)
    throw new Error("Orpheus narration needs a Groq key (GROQ_API_KEYS).");
  const model =
    process.env.GROQ_TTS_MODEL?.trim() || "canopylabs/orpheus-v1-english";
  const voiceName = process.env[persona.orpheusEnv]?.trim() || persona.orpheus;
  const id = crypto.randomUUID();
  const files: string[] = [];
  const mp3 = join(tmpdir(), `clipvero-orpheus-${id}.mp3`);
  try {
    for (const [i, chunk] of sentenceChunks(text).entries()) {
      let response: Response | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        response = await fetch("https://api.groq.com/openai/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            voice: voiceName,
            input: chunk,
            response_format: "wav",
          }),
          signal: AbortSignal.timeout(120000),
        });
        if (response.status !== 429) break;
        await pause(Number(process.env.VOICE_RETRY_MS ?? 8000) * (attempt + 1));
      }
      if (!response?.ok)
        throw new Error(`Groq speech returned HTTP ${response?.status}`);
      const file = join(tmpdir(), `clipvero-orpheus-${id}-${i}.wav`);
      await writeFile(file, Buffer.from(await response.arrayBuffer()));
      files.push(file);
    }
    const speed = `atempo=${tempo("groq")}`;
    await execute(binary("ffmpeg"), [
      "-v",
      "error",
      "-y",
      ...files.flatMap((file) => ["-i", file]),
      ...(files.length > 1
        ? [
            "-filter_complex",
            `${files.map((_, i) => `[${i}:a]`).join("")}concat=n=${files.length}:v=0:a=1,${speed}`,
          ]
        : ["-af", speed]),
      "-b:a",
      "128k",
      mp3,
    ]);
    const audio = await readFile(mp3);
    const aligned = await groqAlign(audio, text);
    return { audio, ...aligned, provider: `groq:${voiceName}` };
  } finally {
    await Promise.all(
      [...files, mp3].map((file) => unlink(file).catch(() => {})),
    );
  }
}

/** Speaks every scene with one provider so a video never mixes voices. */
export async function speakScenes(
  texts: string[],
  voice: string,
): Promise<Spoken[]> {
  const persona = personas[voice];
  const errors: string[] = [];
  for (const id of order()) {
    try {
      if (
        id === "elevenlabs" &&
        persona &&
        process.env.ELEVENLABS_API_KEY?.trim()
      ) {
        const spoken = [];
        for (const text of texts) spoken.push(await elevenLabs(text, persona));
        return spoken;
      }
      if (
        id === "gemini" &&
        persona &&
        (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)?.trim()
      ) {
        const spoken = [];
        for (const text of texts) spoken.push(await gemini(text, persona));
        return spoken;
      }
      if (id === "groq" && persona && groqKeys().length) {
        const spoken = [];
        for (const text of texts) spoken.push(await orpheus(text, persona));
        return spoken;
      }
      if (id === "openai" && persona && process.env.OPENAI_API_KEY?.trim()) {
        const spoken = [];
        for (const text of texts) spoken.push(await openAI(text, persona));
        return spoken;
      }
      if (id === "local")
        return (await localSpeechBatch(texts, voice)).map((s) => ({
          ...s,
          provider: "kokoro",
        }));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `${id} failed`);
    }
  }
  throw new Error(
    `No narration provider succeeded: ${errors.join("; ") || "none configured"}`,
  );
}
