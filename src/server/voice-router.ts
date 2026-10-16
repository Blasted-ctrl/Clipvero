import { z } from "zod";
import { localSpeechBatch, type SpokenWord } from "./local-voice";

/**
 * Narration with the most expressive voice available: ElevenLabs, then OpenAI's
 * instructable TTS, then local Kokoro. Order comes from CLIPVERO_VOICE_PROVIDERS.
 */
export type Spoken = {
  audio: Buffer;
  duration: number;
  words: SpokenWord[];
  provider: string;
};

const personas: Record<
  string,
  { eleven: string; elevenEnv: string; openai: string; style: string }
> = {
  "free-cute": {
    eleven: "MF3mGyEYCl7XYWbV9V6O",
    elevenEnv: "ELEVENLABS_VOICE_CUTE",
    openai: "coral",
    style:
      "Bright, playful and youthful, like an excited friend sharing something cool. Real emotion, natural breaths, varied pace, little laughs where they fit.",
  },
  "free-warm": {
    eleven: "EXAVITQu4vr4xnSDxMaL",
    elevenEnv: "ELEVENLABS_VOICE_WARM",
    openai: "sage",
    style:
      "Warm, calm and encouraging teacher. Natural breaths, gentle emphasis on key words, conversational pace.",
  },
  "free-deep": {
    eleven: "pNInz6obpgDQGcFmaJgB",
    elevenEnv: "ELEVENLABS_VOICE_DEEP",
    openai: "onyx",
    style:
      "Deep, confident storyteller. Measured pace, dramatic pauses, natural breaths, real conviction.",
  },
};

const order = () =>
  (process.env.CLIPVERO_VOICE_PROVIDERS || "elevenlabs,openai,local")
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
      return {
        audio: Buffer.from(data.audio_base64, "base64"),
        duration: ends[ends.length - 1] ?? words[words.length - 1]?.end ?? 0,
        words,
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
