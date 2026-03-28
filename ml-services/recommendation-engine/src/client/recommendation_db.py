from __future__ import annotations

from datetime import datetime, timezone
import logging
import time
from typing import Any, Dict
from uuid import uuid4

import requests

from config import settings

LOGGER = logging.getLogger("recommendation-engine.recommendation-db-client")


def _headers(idempotency_key: str | None = None) -> Dict[str, str]:
    headers = {"X-Internal-Key": settings.internal_api_key}
    if idempotency_key:
        headers["X-Idempotency-Key"] = idempotency_key
    return headers


def _base_url() -> str:
    return settings.main_api_url.rstrip("/")


def _request_with_retry(method: str, url: str, **kwargs) -> requests.Response:
    retries = 3
    backoff_seconds = 0.5

    for attempt in range(1, retries + 1):
        try:
            response = requests.request(method, url, **kwargs)
            if response.status_code in (429, 500, 502, 503, 504) and attempt < retries:
                LOGGER.warning(
                    "Internal API retry %s/%s for %s %s due to HTTP %s",
                    attempt,
                    retries,
                    method,
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
                "Internal API retry %s/%s for %s %s due to network error: %s",
                attempt,
                retries,
                method,
                url,
                exc,
            )
            time.sleep(backoff_seconds * attempt)

    raise RuntimeError("Unreachable retry state")


def get_latest_successful_training_time() -> datetime | None:
    response = _request_with_retry(
        "GET",
        f"{_base_url()}/internal/recommendation/training-runs/latest-successful",
        headers=_headers(),
        timeout=30,
    )
    response.raise_for_status()

    payload = response.json() or {}
    latest = payload.get("latest")
    if not isinstance(latest, dict):
        return None

    trained_at = latest.get("trained_at")
    if not trained_at or not isinstance(trained_at, str):
        return None

    parsed = datetime.fromisoformat(trained_at.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def save_training_run(payload: Dict[str, Any]) -> None:
    idempotency_key = str(uuid4())
    response = _request_with_retry(
        "POST",
        f"{_base_url()}/internal/recommendation/training-runs",
        json=payload,
        headers=_headers(idempotency_key),
        timeout=30,
    )
    response.raise_for_status()
