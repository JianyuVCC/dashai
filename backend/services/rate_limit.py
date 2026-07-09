from __future__ import annotations
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

_WINDOW_SECONDS = 3600
_MAX_REQUESTS = 20
_hits: dict[str, deque] = defaultdict(deque)


def rate_limit_public_chat(request: Request) -> None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        key = forwarded.split(",")[0].strip()
    else:
        key = request.client.host if request.client else "unknown"
    now = time.monotonic()
    hits = _hits[key]

    while hits and now - hits[0] > _WINDOW_SECONDS:
        hits.popleft()

    if len(hits) >= _MAX_REQUESTS:
        raise HTTPException(429, "Too many requests to this dashboard's chat. Try again later.")

    hits.append(now)
