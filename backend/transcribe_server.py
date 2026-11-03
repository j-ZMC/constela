"""Turn short voice recordings into text with Whisper, on this computer.

The Next.js server starts this once and keeps it running (src/lib/whisper.ts), so the model loads only once.
Uses the protocol in worker_protocol.py:
  ready:    {"ready": true, "device": "cuda" | "cpu"}
  request:  {"id": "...", "path": "C:/.../recording.webm"}
  result:   {"id": "...", "text": "..."}

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
    samples = decode(path)
    if samples.size == 0:
        return ""
    # vad_filter skips the silence before and after speaking; beam_size 1 is fast and good enough for answers.
    segments, _ = model.transcribe(samples, language="en", beam_size=1, vad_filter=True)
    return " ".join(segment.text.strip() for segment in segments).strip()


def main() -> int:
    add_cuda_dll_dirs()
    model, device = load_model()
    serve(lambda request: {"text": transcribe(model, str(request["path"]))}, {"device": device}, sys.stdin, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
