"""Turn short voice recordings into text with Whisper, on this computer.

The Next.js server starts this once and keeps it running (src/lib/whisper.ts), so the model loads only once.
Uses the protocol in worker_protocol.py:
  ready:    {"ready": true, "device": "cuda" | "cpu"}
  request:  {"id": "...", "path": "C:/.../recording.webm", "voice": true}
  result:   {"id": "...", "text": "...", "voice": {"seconds": 12.4, "pauses": 0.18}}

"voice" is only asked for when the person turned on "Adjust the practice to how it is going". It is measured straight
from the samples Whisper reads, with no model: how long the person spoke, and what share of that was pauses. It does
not guess feelings. The app only compares it with the same person's earlier answers (src/lib/practice-signals.ts), and
never shows or keeps it.

Set WHISPER_MODEL to use another model (default: small.en). The model is downloaded once from
Hugging Face the first time it runs; recordings never leave this computer.
"""
from __future__ import annotations

import os
import sys
from typing import Any

from worker_protocol import serve

MODEL_NAME = os.environ.get("WHISPER_MODEL", "small.en")


def add_cuda_dll_dirs() -> None:
    """pip's nvidia-cublas-cu12 and nvidia-cudnn-cu12 put their DLLs in site-packages/nvidia/*/bin.

    Windows only finds them when those folders are on the DLL search path.
    """
    if os.name != "nt":
        return
    import importlib.util

    spec = importlib.util.find_spec("nvidia")
    for base in (spec.submodule_search_locations or []) if spec else []:
        for name in os.listdir(base):
            bin_dir = os.path.join(base, name, "bin")
            if os.path.isdir(bin_dir):
                os.add_dll_directory(bin_dir)
                os.environ["PATH"] = bin_dir + os.pathsep + os.environ.get("PATH", "")


def load_model() -> tuple[Any, str]:
    """The GPU when it works, otherwise the CPU. Slower on the CPU, but voice still works."""
    import numpy as np
    from faster_whisper import WhisperModel

    try:
        model = WhisperModel(MODEL_NAME, device="cuda", compute_type="float16")
        # CUDA problems often appear only on first use; one second of silence brings them out now.
        list(model.transcribe(np.zeros(16_000, dtype=np.float32), language="en")[0])
        return model, "cuda"
    except Exception as error:  # noqa: BLE001 - any CUDA failure falls back to the CPU
        print(f"Whisper on the GPU failed, using the CPU: {error}", file=sys.stderr)
        return WhisperModel(MODEL_NAME, device="cpu", compute_type="int8"), "cpu"


def decode(path: str, sampling_rate: int = 16_000) -> Any:
    """The recording as 16 kHz mono float32 samples, the input Whisper expects.

    faster-whisper's own decoder passes an option (metadata_errors) that PyAV 15 and later removed,
    so the file is read here instead.
    """
    import av
    import numpy as np

    resampler = av.AudioResampler(format="s16", layout="mono", rate=sampling_rate)
    chunks = []
    with av.open(path) as container:
        for frame in container.decode(audio=0):
            chunks += [out.to_ndarray().reshape(-1) for out in resampler.resample(frame)]
        chunks += [out.to_ndarray().reshape(-1) for out in resampler.resample(None)]  # what is left in the resampler
    samples = np.concatenate(chunks) if chunks else np.zeros(0, dtype=np.int16)
    return samples.astype(np.float32) / 32768.0


def transcribe(model: Any, path: str) -> str:
    return transcribe_samples(model, decode(path))


def transcribe_samples(model: Any, samples: Any) -> str:
    if samples.size == 0:
        return ""
    # vad_filter skips the silence before and after speaking; beam_size 1 is fast and good enough for answers.
    segments, _ = model.transcribe(samples, language="en", beam_size=1, vad_filter=True)
    return " ".join(segment.text.strip() for segment in segments).strip()


FRAME = 480  # 30 ms at 16 kHz
# A silence of 270 ms or more counts as a pause; shorter gaps are normal between words.
LONG_PAUSE = 9


def voice(samples: Any) -> dict[str, float] | None:
    """Seconds from the first sound to the last, and the share of that time spent in pauses. None under a second."""
    import numpy as np

    frames = samples[: samples.size // FRAME * FRAME].reshape(-1, FRAME)
    if len(frames) == 0:
        return None
    level = np.sqrt((frames**2).mean(axis=1))
    # Relative to this recording's loud parts, so a quiet microphone works too; the floor keeps room noise out.
    is_loud = level > max(0.003, 0.1 * float(np.percentile(level, 95)))
    loud = np.flatnonzero(is_loud)
    if loud.size == 0 or loud[-1] - loud[0] + 1 < 16_000 // FRAME:
        return None
    spoken = is_loud[loud[0] : loud[-1] + 1]
    # Start and end of each run of quiet frames, then the frames in runs long enough to be pauses.
    edges = np.diff(np.concatenate(([0], (~spoken).astype(np.int8), [0])))
    runs = np.flatnonzero(edges == -1) - np.flatnonzero(edges == 1)
    paused = int(runs[runs >= LONG_PAUSE].sum())
    return {"seconds": round(spoken.size * FRAME / 16_000, 2), "pauses": round(paused / spoken.size, 3)}


def handle(model: Any, request: dict[str, Any]) -> dict[str, Any]:
    samples = decode(str(request["path"]))
    result: dict[str, Any] = {"text": transcribe_samples(model, samples)}
    if request.get("voice") is True:
        try:
            heard = voice(samples)
            if heard:
                result["voice"] = heard
        except Exception as error:  # noqa: BLE001 - the words matter; a measurement that fails is simply left out
            print(f"Voice measurement failed: {error}", file=sys.stderr)
    return result


def main() -> int:
    add_cuda_dll_dirs()
    model, device = load_model()
    serve(lambda request: handle(model, request), {"device": device}, sys.stdin, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
