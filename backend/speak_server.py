"""Read the interview AI's replies out loud with Kokoro-82M, on this computer.

The Next.js server starts this once and keeps it running (src/lib/kokoro.ts), so the model loads only once.
Uses the protocol in worker_protocol.py:
  ready:    {"ready": true, "voice": "af_heart"}
  request:  {"id": "...", "text": "One sentence.", "path": "C:/.../speech.wav"}
  result:   {"id": "...", "seconds": 2.4}    (the audio is written to `path` as a WAV file)

It runs on the CPU, which is fast enough for a model this small and leaves the GPU to Ollama and Whisper.
The model files (about 340 MB) are downloaded once into backend/models/kokoro the first time it runs.
Settings: KOKORO_VOICE (default af_heart), KOKORO_SPEED (default 0.95), KOKORO_DIR.
"""
from __future__ import annotations

import os
import sys
import urllib.request
import wave
from typing import Any

from worker_protocol import serve

MODEL_DIR = os.environ.get("KOKORO_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "kokoro"))
VOICE = os.environ.get("KOKORO_VOICE", "af_heart")
# A little slower than normal speech, easier to follow.
SPEED = float(os.environ.get("KOKORO_SPEED", "0.95"))
FILES_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
FILES = ("kokoro-v1.0.onnx", "voices-v1.0.bin")


def download_model() -> None:
    os.makedirs(MODEL_DIR, exist_ok=True)
    for name in FILES:
        target = os.path.join(MODEL_DIR, name)
        if os.path.exists(target):
            continue
        print(f"Downloading {name} for the Kokoro voice...", file=sys.stderr)
        # A partial download never takes the real name, so a broken one is fetched again next time.
        partial = target + ".part"
        urllib.request.urlretrieve(f"{FILES_URL}/{name}", partial)
        os.replace(partial, target)


def load_model() -> Any:
    from kokoro_onnx import Kokoro

    download_model()
    model = Kokoro(os.path.join(MODEL_DIR, FILES[0]), os.path.join(MODEL_DIR, FILES[1]))
    if VOICE not in model.get_voices():
        raise ValueError(f"Unknown KOKORO_VOICE {VOICE!r}. Try af_heart, af_bella, am_michael or bf_emma.")
    # The first sentence is much slower than the rest; say one now, before anyone is waiting.
    model.create("Ready.", voice=VOICE, speed=SPEED, lang="en-us")
    return model


def write_wav(path: str, samples: Any, rate: int) -> float:
    """16-bit mono WAV, which every browser plays. Returns its length in seconds."""
    import numpy as np

    pcm = (np.clip(samples, -1.0, 1.0) * 32767).astype("<i2")
    with wave.open(path, "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(rate)
        out.writeframes(pcm.tobytes())
    return round(len(pcm) / rate, 2)


def speak(model: Any, text: str, path: str, speed: float | None = None) -> dict[str, Any]:
    if not text.strip():
        raise ValueError("Nothing to say.")
    # The person's "Slower AI voice" setting; anything odd falls back to the default.
    speed = speed if isinstance(speed, (int, float)) and 0.5 <= speed <= 1.5 else SPEED
    samples, rate = model.create(text, voice=VOICE, speed=speed, lang="en-us")
    return {"seconds": write_wav(path, samples, rate)}


def main() -> int:
    model = load_model()
    serve(
        lambda request: speak(model, str(request["text"]), str(request["path"]), request.get("speed")),
        {"voice": VOICE},
        sys.stdin,
        sys.stdout,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
