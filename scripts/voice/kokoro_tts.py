"""Local, free narration with word timings using Kokoro.

Reads a scene or scenes array with voice and speed from JSON on stdin. Optional
sentence_pause_ms and speed_variation retain word times at their actual audio
offsets. Writes 24 kHz WAV files and prints duration and word timings as JSON.
"""

import json
import math
import re
import sys
import warnings

warnings.filterwarnings("ignore")

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402
import torch  # noqa: E402
from huggingface_hub import hf_hub_download, try_to_load_from_cache  # noqa: E402
from kokoro import KModel, KPipeline  # noqa: E402

RATE = 24000
REPOSITORY = "hexgrad/Kokoro-82M"


def model_file(filename: str) -> str:
    cached = try_to_load_from_cache(REPOSITORY, filename)
    if isinstance(cached, str):
        return cached
    return hf_hub_download(REPOSITORY, filename)


def speak(
    request: dict,
    pipeline: KPipeline,
    voice: str,
    speed: float,
    sentence_pause_ms: int = 0,
    speed_variation: float = 0,
) -> dict:
    chunks: list[np.ndarray] = []
    words: list[dict[str, object]] = []
    offset = 0.0
    sentences = (
        re.split(r"(?<=[.!?])\s+", request["text"].strip())
        if sentence_pause_ms or speed_variation
        else [request["text"]]
    )
    for index, sentence in enumerate(sentences):
        produced_audio = False
        if index and sentence_pause_ms:
            silence = np.zeros(round(RATE * sentence_pause_ms / 1000), dtype=np.float32)
            chunks.append(silence)
            offset += len(silence) / RATE
        sentence_speed = min(
            1.5, max(0.8, speed + (0, -speed_variation, speed_variation)[index % 3])
        )
        for result in pipeline(sentence, voice=voice, speed=sentence_speed):
            if result.audio is None:
                continue
            audio = result.audio.cpu().numpy()
            produced_audio = True
            for token in result.tokens or []:
                text = (token.text or "").strip()
                if not text or token.start_ts is None or token.end_ts is None:
                    continue
                # Punctuation tokens attach to the previous word so captions read naturally.
                if words and not any(c.isalnum() for c in text):
                    words[-1]["text"] = f"{words[-1]['text']}{text}"
                    continue
                words.append(
                    {
                        "text": text,
                        "start": round(offset + token.start_ts, 3),
                        "end": round(offset + token.end_ts, 3),
                    }
                )
            chunks.append(audio)
            offset += len(audio) / RATE
        if not produced_audio:
            raise SystemExit("Kokoro produced no audio for a sentence.")
    if not chunks:
        raise SystemExit("Kokoro produced no audio for this text.")
    sf.write(request["out"], np.concatenate(chunks), RATE)
    return {"duration": round(offset, 3), "words": words}


def main() -> None:
    request = json.load(sys.stdin)
    speed = float(request.get("speed", 1.0))
    sentence_pause_ms = int(request.get("sentence_pause_ms", 0))
    speed_variation = float(request.get("speed_variation", 0))
    if not math.isfinite(speed) or not 0.8 <= speed <= 1.5:
        raise SystemExit("Local voice speed must be between 0.8 and 1.5.")
    if not 0 <= sentence_pause_ms <= 500:
        raise SystemExit("Sentence pauses must be between 0 and 500 ms.")
    if not math.isfinite(speed_variation) or not 0 <= speed_variation <= 0.08:
        raise SystemExit("Sentence speed variation must be between 0 and 0.08.")
    model = (
        KModel(
            repo_id=REPOSITORY,
            config=model_file("config.json"),
            model=model_file("kokoro-v1_0.pth"),
        )
        .to("cuda" if torch.cuda.is_available() else "cpu")
        .eval()
    )
    pipeline = KPipeline(lang_code="a", repo_id=REPOSITORY, model=model)
    voice = model_file(f"voices/{request['voice']}.pt")
    # One model load per video; older single-scene callers remain supported.
    if "scenes" in request:
        results = [
            speak(scene, pipeline, voice, speed, sentence_pause_ms, speed_variation)
            for scene in request["scenes"]
        ]
        json.dump(results, sys.stdout)
    else:
        json.dump(
            speak(request, pipeline, voice, speed, sentence_pause_ms, speed_variation),
            sys.stdout,
        )


if __name__ == "__main__":
    main()
