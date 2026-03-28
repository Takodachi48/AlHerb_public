from __future__ import annotations

from datetime import datetime, timezone
import logging
import time
from typing import List

import requests

from config import settings

LOGGER = logging.getLogger("recommendation-engine.mongo-client")


def _request_with_retry(url: str, *, params: dict | None = None, timeout: int = 30) -> requests.Response:
    retries = 3
    backoff_seconds = 0.5

    for attempt in range(1, retries + 1):
        try:
            response = requests.get(
                url,
                params=params,
                headers={"X-Internal-Key": settings.internal_api_key},
                timeout=timeout,
            )
            if response.status_code in (429, 500, 502, 503, 504) and attempt < retries:
                LOGGER.warning(
                    "Internal API retry %s/%s for GET %s due to HTTP %s",
                    attempt,
                    retries,
                    url,
                    response.status_code,
                )
                time.sleep(backoff_seconds * attempt)
                continue
            return response
        except requests.RequestException as exc:
            if attempt >= retries:
                raise
            LOGGER.warning(
                "Internal API retry %s/%s for GET %s due to network error: %s",
                attempt,
                retries,
                url,
                exc,
            )
            time.sleep(backoff_seconds * attempt)

    raise RuntimeError("Unreachable retry state")


def fetch_training_data(limit: int = 5000) -> List[dict]:
    response = _request_with_retry(
        f"{settings.main_api_url}/internal/feedback/training-data",
        params={"limit": limit},
        timeout=60,
    )
    response.raise_for_status()
    return response.json()


def count_new_feedback_since(last_trained_at: datetime | None) -> int:
    params = {}
    if last_trained_at is not None:
        if last_trained_at.tzinfo is None:
            last_trained_at = last_trained_at.replace(tzinfo=timezone.utc)
        else:
            last_trained_at = last_trained_at.astimezone(timezone.utc)
        params["since"] = last_trained_at.isoformat()

    response = _request_with_retry(
        f"{settings.main_api_url}/internal/feedback/count",
        params=params,
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json() or {}
    return int(payload.get("count", 0))
