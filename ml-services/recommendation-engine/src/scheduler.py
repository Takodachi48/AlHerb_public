from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List

from apscheduler.schedulers.background import BackgroundScheduler
from croniter import croniter

from client.mongo_client import count_new_feedback_since
from client.recommendation_db import get_latest_successful_training_time
from config import settings
from model.trainer import train_models

LOGGER = logging.getLogger("recommendation-engine.scheduler")
META_PATH = Path(__file__).resolve().parent / "model" / "artifacts" / "feature_meta.json"


def _load_last_trained_at() -> datetime | None:
    try:
        latest = get_latest_successful_training_time()
        if latest is not None:
            return latest
    except Exception as exc:  # noqa: BLE001
        LOGGER.warning("Failed to load last trained time from recommendation DB: %s", exc)

    if not META_PATH.exists():
        return None
    data = json.loads(META_PATH.read_text(encoding="utf-8"))
    trained_at = data.get("trained_at")
    if not trained_at:
        return None
    return datetime.fromisoformat(trained_at.replace("Z", "+00:00")).astimezone(timezone.utc)


def _upcoming_image_retrain_times(start: datetime, hours: int) -> List[datetime]:
    iterator = croniter(settings.image_classifier_retrain_cron, start)
    end = start + timedelta(hours=hours)
    runs = []
    for _ in range(32):
        nxt = iterator.get_next(datetime)
        if nxt > end:
            break
        if nxt.tzinfo is None:
            nxt = nxt.replace(tzinfo=timezone.utc)
        else:
            nxt = nxt.astimezone(timezone.utc)
        runs.append(nxt)
    return runs


def _find_conflict(candidate_time: datetime) -> datetime | None:
    buffer_delta = timedelta(minutes=settings.recommendation_retrain_buffer_minutes)
    for image_run in _upcoming_image_retrain_times(candidate_time, settings.recommendation_check_interval_hours):
        if abs((candidate_time - image_run).total_seconds()) <= buffer_delta.total_seconds():
            return image_run
    return None


def _run_retrain():
    LOGGER.info("Retrain triggered")
    try:
        result = train_models()
        LOGGER.info("Retrain finished: %s", result)
    except Exception as exc:  # noqa: BLE001
        LOGGER.exception("Retrain failed: %s", exc)


def _check_and_schedule():
    now = datetime.now(timezone.utc)
    last_trained_at = _load_last_trained_at()
    new_feedback_count = count_new_feedback_since(last_trained_at)

    if new_feedback_count < settings.recommendation_retrain_threshold:
        LOGGER.info(
            "Retrain skipped: new_feedback=%d threshold=%d",
            new_feedback_count,
            settings.recommendation_retrain_threshold,
        )
        return

    conflict_time = _find_conflict(now)
    if conflict_time is None:
        _run_retrain()
        return

    retry_at = conflict_time + timedelta(minutes=settings.recommendation_retrain_buffer_minutes)
    LOGGER.info(
        "Retrain delayed — image classifier retraining at %s, will retry at %s",
        conflict_time.strftime("%H:%M"),
        retry_at.strftime("%H:%M"),
    )
    SCHEDULER.add_job(_check_and_schedule, "date", run_date=retry_at, id="delayed_retrain", replace_existing=True)


SCHEDULER = BackgroundScheduler(timezone=timezone.utc)


def start_scheduler() -> None:
    if SCHEDULER.running:
        return

    SCHEDULER.add_job(
        _check_and_schedule,
        "interval",
        hours=settings.recommendation_check_interval_hours,
        id="retrain_check",
        replace_existing=True,
    )
    SCHEDULER.start()
    LOGGER.info(
        "Scheduler started: check_interval=%sh threshold=%s buffer=%sm",
        settings.recommendation_check_interval_hours,
        settings.recommendation_retrain_threshold,
        settings.recommendation_retrain_buffer_minutes,
    )
