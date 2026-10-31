"""JSON subprocess adapter for the local resume parser."""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path


PARSER_PATH = Path(__file__).parent / "resume_parser" / "resume_parser.py"


def load_parser():
    spec = importlib.util.spec_from_file_location("constela_resume_parser", PARSER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Resume parser could not be loaded.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: resume_api.py <pdf-path>", file=sys.stderr)
        return 2

    try:
        profile = load_parser().parse_resume(Path(sys.argv[1]))
        if not profile:
            raise ValueError("No extractable text was found in the PDF.")
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stdout.write(json.dumps(profile, ensure_ascii=False))
        return 0
    except Exception as error:
        print(f"Resume parsing failed: {type(error).__name__}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
