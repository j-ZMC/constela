"""Turn short voice recordings into text with Whisper, on this computer.

The Next.js server starts this once and keeps it running (src/lib/whisper.ts), so the model loads only once.
Uses the protocol in worker_protocol.py:
  ready:    {"ready": true, "device": "cuda" | "cpu"}
  request:  {"id": "...", "path": "C:/.../recording.webm", "tone": true}
  result:   {"id": "...", "text": "...", "tone": {"neutral": 0.7, "happy": 0.1, "angry": 0.1, "sad": 0.1}}

"tone" is only asked for when the person turned on "Adjust the practice to how it is going". It comes from a
wav2vec2 model (onnx-community/wav2vec2-base-superb-er-ONNX, Apache 2.0) run with ONNX Runtime on the CPU, on the same
samples Whisper reads. It is weak evidence: trained on acted speech, it hears a calm synthetic voice as "angry". The
app only compares it with the same person's earlier answers (src/lib/practice-signals.ts), and never shows or keeps it.

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


TONE_REPO = "onnx-community/wav2vec2-base-superb-er-ONNX"
# The model's id2label order: neu, hap, ang, sad.
TONE_LABELS = ("neutral", "happy", "angry", "sad")
_tone_session: Any = None


def tone_session() -> Any:
    """Loaded the first time a tone is asked for (about 380 MB, downloaded once into the Hugging Face cache)."""
    global _tone_session
    if _tone_session is None:
        import onnxruntime as ort
        from huggingface_hub import hf_hub_download

        _tone_session = ort.InferenceSession(hf_hub_download(TONE_REPO, "onnx/model.onnx"), providers=["CPUExecutionProvider"])
    return _tone_session


def tone(samples: Any, session: Any = None) -> dict[str, float] | None:
    """How the voice sounds to the model, as shares that add up to 1. None for less than a second of speech."""
    import numpy as np

    if samples.size < 16_000:
        return None
    clip = samples[-16_000 * 20 :]  # the last 20 seconds are enough, and keep it fast
    logits = (session or tone_session()).run(None, {"input_values": clip[None, :].astype(np.float32)})[0][0]
    shares = np.exp(logits - logits.max())
    shares /= shares.sum()
    return {label: round(float(v), 3) for label, v in zip(TONE_LABELS, shares)}


def handle(model: Any, request: dict[str, Any]) -> dict[str, Any]:
    samples = decode(str(request["path"]))
    result: dict[str, Any] = {"text": transcribe_samples(model, samples)}
    if request.get("tone") is True:
        try:
            heard = tone(samples)
            if heard:
                result["tone"] = heard
        except Exception as error:  # noqa: BLE001 - the words matter; a tone that fails is simply left out
            print(f"Tone failed: {error}", file=sys.stderr)
    return result


def main() -> int:
    add_cuda_dll_dirs()
    model, device = load_model()
    serve(lambda request: handle(model, request), {"device": device}, sys.stdin, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
