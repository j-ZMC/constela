"""The line protocol shared by the long-running workers (transcribe_server.py, speak_server.py).

The Next.js server starts a worker once and keeps it running (src/lib/python-worker.ts), so its model loads once.
One JSON object per line:
  stdout, first:  {"ready": true, ...details}
  stdin:          {"id": "...", ...request}
  stdout:         {"id": "...", ...result}  or  {"id": "...", "error": "..."}
"""
from __future__ import annotations

import json
from typing import Any, Callable, Iterable, TextIO


def serve(handle: Callable[[dict[str, Any]], dict[str, Any]], ready: dict[str, Any], lines: Iterable[str], out: TextIO) -> None:
    def send(message: dict[str, Any]) -> None:
        out.write(json.dumps(message) + "\n")
        out.flush()

    send({"ready": True, **ready})
    for line in lines:
        if not line.strip():
            continue
        request_id = None
        try:
            # Some Windows shells start the input with a byte-order mark.
            request = json.loads(line.lstrip("﻿"))
            request_id = request["id"]
            send({"id": request_id, **handle(request)})
        except Exception as error:  # noqa: BLE001 - one bad request must not stop the worker
            send({"id": request_id, "error": str(error)[:300]})
