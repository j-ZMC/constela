"""Get a fresh clone of Constela ready to run on this computer: `npm run setup` (or `python backend/setup_local.py`).

1. A Python environment in `.venv` at the project root, with backend/requirements.txt.
2. The models that would otherwise download the first time someone uses them, so the first voice reply already uses
   Kokoro instead of the browser's voice: Kokoro (the AI's voice, about 340 MB), Whisper small.en (about 500 MB) and the
   voice-tone model for "Adjust the practice" (about 380 MB).
3. The Ollama models (llama3.1:8b and qwen3-embedding:0.6b), when Ollama is installed.

Safe to run again: everything already in place is skipped. Uses only the standard library, so any Python 3.10+ runs it.
`npm run dev` runs it first with --if-needed: right after cloning it sets everything up, and afterwards it only checks
a marker file and returns at once.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import venv

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "backend")
VENV = os.path.join(ROOT, ".venv")
PYTHON = os.path.join(VENV, "Scripts", "python.exe") if os.name == "nt" else os.path.join(VENV, "bin", "python")
OLLAMA_MODELS = ("llama3.1:8b", "qwen3-embedding:0.6b")
# Written when the Python part is done, so `--if-needed` can skip everything on later starts.
READY = os.path.join(VENV, ".constela-setup-done")

# Run inside .venv, from backend/, so it uses the same settings as the app's workers.
PRELOAD = """
import speak_server, transcribe_server
from faster_whisper import download_model
from huggingface_hub import hf_hub_download
speak_server.download_model(); print("  Kokoro voice: ready", flush=True)
download_model(transcribe_server.MODEL_NAME); print("  Whisper " + transcribe_server.MODEL_NAME + ": ready", flush=True)
hf_hub_download(transcribe_server.TONE_REPO, "onnx/model.onnx"); print("  Voice tone model: ready", flush=True)
"""


def step(title: str) -> None:
    print(f"\n== {title}", flush=True)


def run(command: list[str], cwd: str = ROOT) -> None:
    print("  $ " + " ".join(command), flush=True)
    subprocess.run(command, cwd=cwd, check=True)


def main() -> int:
    if "--if-needed" in sys.argv and os.path.exists(READY):
        return 0
    if "--if-needed" in sys.argv:
        print("First start: setting up Constela on this computer (about 2 GB, once).", flush=True)
    if sys.version_info < (3, 10):
        print("Constela needs Python 3.10 or newer (3.12 recommended).", file=sys.stderr)
        return 1

    step("Python environment (.venv)")
    if not os.path.exists(PYTHON):
        venv.create(VENV, with_pip=True)
        print("  Created .venv")
    run([PYTHON, "-m", "pip", "install", "--disable-pip-version-check", "-q", "-r", os.path.join(BACKEND, "requirements.txt")])

    step("Voice and speech models")
    run([PYTHON, "-W", "ignore", "-c", PRELOAD], cwd=BACKEND)
    with open(READY, "w", encoding="utf-8") as marker:
        print("Python environment and voice models are ready. Delete this file to run the setup again.", file=marker)

    step("Ollama models")
    ollama = shutil.which("ollama")
    if ollama:
        for model in OLLAMA_MODELS:
            run([ollama, "pull", model])
    else:
        print("  Ollama is not installed. Get it at https://ollama.com/download, then run:")
        for model in OLLAMA_MODELS:
            print(f"    ollama pull {model}")

    step("Done")
    print("  Start Constela with: npm run dev   (then open http://localhost:3000)")
    print("  Job data and search vectors come with the repository; nothing else to build.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
