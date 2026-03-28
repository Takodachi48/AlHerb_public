from __future__ import annotations

import time
import logging
from typing import Any, Dict, List
from uuid import uuid4

import requests

from app.core.config import settings

LOGGER = logging.getLogger("image-classifier.internal-api")


def _base_url() -> str:
    return settings.MAIN_API_URL.rstrip("/")


def _headers(idempotency_key: str | None = None) -> Dict[str, str]:
    headers = {"X-Internal-Key": settings.INTERNAL_API_KEY}
    if idempotency_key:
        headers["X-Idempotency-Key"] = idempotency_key
    return headers


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


def save_prediction(payload: Dict[str, Any]) -> None:
    idempotency_key = str(uuid4())
    response = _request_with_retry(
        "POST",
        f"{_base_url()}/internal/image-classifier/predictions",
        json=payload,
        headers=_headers(idempotency_key),
        timeout=30,
    )
    if response.status_code not in (201, 409):
        response.raise_for_status()


def get_prediction(prediction_id: str) -> Dict[str, Any] | None:
    response = _request_with_retry(
        "GET",
        f"{_base_url()}/internal/image-classifier/predictions/{prediction_id}",
        headers=_headers(),
        timeout=30,
    )
    if response.status_code == 404:
        return None
    response.raise_for_status()
    payload = response.json() or {}
    prediction = payload.get("prediction")
    return prediction if isinstance(prediction, dict) else None


def save_feedback(payload: Dict[str, Any]) -> None:
    idempotency_key = str(uuid4())
    response = _request_with_retry(
        "POST",
        f"{_base_url()}/internal/image-classifier/feedback",
        json=payload,
        headers=_headers(idempotency_key),
        timeout=30,
    )
    response.raise_for_status()


def save_training_data(payload: Dict[str, Any]) -> None:
    idempotency_key = str(uuid4())
    response = _request_with_retry(
        "POST",
        f"{_base_url()}/internal/image-classifier/training-data",
        json=payload,
        headers=_headers(idempotency_key),
        timeout=30,
    )
    response.raise_for_status()


def fetch_training_data(is_new: bool, limit: int) -> List[Dict[str, Any]]:
    response = _request_with_retry(
        "GET",
        f"{_base_url()}/internal/image-classifier/training-data",
        params={"is_new": str(is_new).lower(), "limit": limit},
        headers=_headers(),
        timeout=60,
    )
    response.raise_for_status()
    payload = response.json() or {}
    items = payload.get("items")
    return items if isinstance(items, list) else []


def mark_training_data_as_used(sample_ids: List[str]) -> int:
    idempotency_key = str(uuid4())
    response = _request_with_retry(
        "POST",
        f"{_base_url()}/internal/image-classifier/training-data/mark-used",
        json={"sampleIds": sample_ids},
        headers=_headers(idempotency_key),
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json() or {}
    return int(payload.get("modifiedCount", 0))


def get_training_state() -> Dict[str, Any]:
    response = _request_with_retry(
        "GET",
        f"{_base_url()}/internal/image-classifier/training-state",
        headers=_headers(),
        timeout=30,
    )
    response.raise_for_status()
    return response.json() or {}


def get_active_model_version() -> Dict[str, Any] | None:
    response = _request_with_retry(
        "GET",
        f"{_base_url()}/internal/image-classifier/model-versions/active",
        headers=_headers(),
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json() or {}
    active = payload.get("active")
    return active if isinstance(active, dict) else None


def activate_model_version(payload: Dict[str, Any]) -> None:
    idempotency_key = str(uuid4())
    response = _request_with_retry(
        "POST",
        f"{_base_url()}/internal/image-classifier/model-versions/activate",
        json=payload,
        headers=_headers(idempotency_key),
        timeout=30,
    )
    response.raise_for_status()
