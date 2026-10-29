"""JSON adapter for the existing jobs filter, suitable for a local web worker."""
import json
import sys
from typing import Any

from filter_jobs_openai import filter_jobs


def search(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {"error": "invalid_input"}

    query = payload.get("query")
    blockers = payload.get("userBlockers", [])
    if (
        not isinstance(query, str)
        or not query.strip()
        or len(query.strip()) > 200
        or not isinstance(blockers, list)
        or len(blockers) > 33
        or not all(isinstance(blocker, str) for blocker in blockers)
    ):
        return {"error": "invalid_input"}

    try:
        return filter_jobs(query=query.strip(), user_blockers=blockers)
    except FileNotFoundError:
        return {"error": "cache_unavailable"}
    except Exception as error:
        print(f"Job filter failed: {type(error).__name__}", file=sys.stderr)
        return {"error": "backend_failed"}


def main() -> int:
    for stream in (sys.stdin, sys.stdout):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")

    try:
        payload = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, UnicodeDecodeError):
        payload = None

    result = search(payload)
    try:
        sys.stdout.write(json.dumps(result, ensure_ascii=False, allow_nan=False))
    except (TypeError, ValueError) as error:
        print(f"Job result serialization failed: {type(error).__name__}", file=sys.stderr)
        sys.stdout.write('{"error":"backend_failed"}')
        return 1
    return 0 if "error" not in result else 1


if __name__ == "__main__":
    raise SystemExit(main())
