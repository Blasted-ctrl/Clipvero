import importlib.util
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import sys
import unittest
from unittest.mock import patch

import numpy as np
import soundfile as sf

spec = importlib.util.spec_from_file_location(
    "kokoro_tts", Path(__file__).parents[1] / "scripts/voice/kokoro_tts.py"
)
voice = importlib.util.module_from_spec(spec)
with patch.dict(
    sys.modules,
    {
        "torch": SimpleNamespace(),
        "huggingface_hub": SimpleNamespace(
            hf_hub_download=None, try_to_load_from_cache=None
        ),
        "kokoro": SimpleNamespace(KModel=object, KPipeline=object),
    },
):
    spec.loader.exec_module(voice)


class Audio:
    def cpu(self):
        return self

    def numpy(self):
        return np.ones(voice.RATE, dtype=np.float32) * 0.1


class PacingTests(unittest.TestCase):
    def test_inserted_pauses_shift_word_times_by_exact_sample_duration(self):
        calls = []

        def pipeline(text, **options):
            calls.append((text, options["speed"]))
            return [
                SimpleNamespace(
                    audio=Audio(),
                    tokens=[
                        SimpleNamespace(text=text, start_ts=0.1, end_ts=0.8),
                    ],
                )
            ]

        with TemporaryDirectory() as directory:
            output = str(Path(directory) / "voice.wav")
            result = voice.speak(
                {"text": "First. Second? Third!", "out": output},
                pipeline,
                "af_sky",
                1.1,
                120,
                0.03,
            )
            self.assertEqual(
                [word["start"] for word in result["words"]], [0.1, 1.22, 2.34]
            )
            self.assertEqual(
                [word["end"] for word in result["words"]], [0.8, 1.92, 3.04]
            )
            self.assertEqual(result["duration"], 3.24)
            self.assertEqual(
                [item[0] for item in calls], ["First.", "Second?", "Third!"]
            )
            for actual, expected in zip(
                [item[1] for item in calls], [1.1, 1.07, 1.13]
            ):
                self.assertAlmostEqual(actual, expected)
            audio, rate = sf.read(output)
            self.assertEqual(len(audio), round(3.24 * rate))
            self.assertTrue(np.all(audio[rate : rate + round(0.12 * rate)] == 0))

    def test_default_keeps_existing_single_pass_narration(self):
        calls = []

        def pipeline(text, **options):
            calls.append((text, options["speed"]))
            return [SimpleNamespace(audio=Audio(), tokens=[])]

        with TemporaryDirectory() as directory:
            result = voice.speak(
                {"text": "First. Second?", "out": str(Path(directory) / "voice.wav")},
                pipeline,
                "af_sky",
                1.3,
            )
        self.assertEqual(calls, [("First. Second?", 1.3)])
        self.assertEqual(result["duration"], 1)

    def test_missing_sentence_audio_is_not_replaced_with_silence(self):
        def pipeline(text, **_options):
            return [] if text == "Second." else [SimpleNamespace(audio=Audio(), tokens=[])]

        with TemporaryDirectory() as directory, self.assertRaises(SystemExit):
            voice.speak(
                {"text": "First. Second.", "out": str(Path(directory) / "voice.wav")},
                pipeline,
                "af_sky",
                1.1,
                120,
            )


if __name__ == "__main__":
    unittest.main()
