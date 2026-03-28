from __future__ import annotations

from contextlib import asynccontextmanager
import json
import ipaddress
import logging
from pathlib import Path
from typing import List
import hmac

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field

from config import settings
from client.recommendation_db import get_latest_successful_training_time
from model.predictor import load_model_bundle, score_candidates
from model.trainer import train_models
from scheduler import start_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")
LOGGER = logging.getLogger("recommendation-engine.api")


class SuppressHealthcheckAccessFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        return "GET /health" not in message


logging.getLogger("uvicorn.access").addFilter(SuppressHealthcheckAccessFilter())

META_PATH = Path(__file__).resolve().parent / "model" / "artifacts" / "feature_meta.json"
MODEL_STATE = {"bundle": None}


class Candidate(BaseModel):
    herb_id: str
    symptoms: List[str] = Field(default_factory=list)
    properties: List[str] = Field(default_factory=list)


class UserProfile(BaseModel):
    age: int = 0
    gender: str = "other"
    severity: str = "moderate"
    conditions: List[str] = Field(default_factory=list)
    medications: List[str] = Field(default_factory=list)


class ScoreRequest(BaseModel):
    candidates: List[Candidate]
    user_profile: UserProfile


@asynccontextmanager
async def lifespan(_: FastAPI):
    _validate_internal_key()
    _refresh_bundle()
    start_scheduler()
    yield


app = FastAPI(title="recommendation-engine", lifespan=lifespan)


def _validate_internal_key() -> None:
    if not settings.internal_api_key or len(settings.internal_api_key) < 32:
        raise RuntimeError("INTERNAL_API_KEY must be configured with at least 32 characters")


def _is_internal_client(host: str | None) -> bool:
    if not host:
        return False
    try:
        ip = ipaddress.ip_address(host)
        return ip.is_loopback or ip.is_private
    except ValueError:
        # Docker DNS names are internal service names (no dots in most cases).
        return "." not in host


def require_internal_access(
    request: Request,
    internal_key: str = Header(default="", alias="X-Internal-Key"),
):
    if not hmac.compare_digest(internal_key, settings.internal_api_key):
        raise HTTPException(status_code=401, detail="Invalid internal API key")

    if settings.allow_external_internal_calls:
        return

    if not _is_internal_client(request.client.host if request.client else None):
        raise HTTPException(status_code=403, detail="Endpoint is restricted to internal network clients")


def _refresh_bundle() -> None:
    MODEL_STATE["bundle"] = load_model_bundle()


@app.get("/health")
def health():
    meta = {}
    if META_PATH.exists():
        meta = json.loads(META_PATH.read_text(encoding="utf-8"))
    db_last_trained = None
    try:
        latest = get_latest_successful_training_time()
        db_last_trained = latest.isoformat() if latest else None
    except Exception as exc:  # noqa: BLE001
        LOGGER.warning("Failed to read training status from recommendation DB: %s", exc)
    return {
        "status": "ok",
        "model_loaded": MODEL_STATE["bundle"] is not None,
        "last_trained": meta.get("trained_at"),
        "last_trained_db": db_last_trained,
    }


@app.get("/model/info")
def model_info():
    if not META_PATH.exists():
        return {"model_loaded": False}
    meta = json.loads(META_PATH.read_text(encoding="utf-8"))
    return {
        "model_loaded": MODEL_STATE["bundle"] is not None,
        "model_version": meta.get("model_version"),
        "trained_at": meta.get("trained_at"),
        "record_count": meta.get("record_count"),
        "cv_scores": meta.get("cv_scores", {}),
    }


@app.post("/retrain")
def retrain(_: None = Depends(require_internal_access)):
    result = train_models()
    _refresh_bundle()
    return {"ok": True, "result": result}


@app.post("/score")
def score(request: ScoreRequest, _: None = Depends(require_internal_access)):
    bundle = MODEL_STATE["bundle"]
    if bundle is None:
        raise HTTPException(status_code=503, detail="Model is not loaded yet")

    ranked = score_candidates(
        candidates=[candidate.model_dump() for candidate in request.candidates],
        user_profile=request.user_profile.model_dump(),
        bundle=bundle,
    )
    return {"ranked": ranked}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=settings.recommendation_engine_port, reload=False)
