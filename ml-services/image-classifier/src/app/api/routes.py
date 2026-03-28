import hmac
import ipaddress
import socket
import logging
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from typing import Any, Dict, List, Optional
from datetime import datetime
from celery.result import AsyncResult

from app.services import internal_api
from app.services.cloudinary_storage import CloudinaryStorage
from app.ml.inference import InferenceService
from app.core.config import settings
from training.tasks import train_herb_model, celery_app

router = APIRouter()
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def _assert_redis_broker_available() -> None:
    parsed = urlparse(settings.REDIS_URL)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or 6379
    try:
        with socket.create_connection((host, port), timeout=0.75):
            return
    except OSError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Retraining queue unavailable: cannot reach Redis broker at {host}:{port} ({exc}).",
        ) from exc


def _redis_broker_status() -> dict:
    parsed = urlparse(settings.REDIS_URL)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or 6379
    try:
        with socket.create_connection((host, port), timeout=0.75):
            return {
                "reachable": True,
                "host": host,
                "port": port,
                "redis_url": settings.REDIS_URL,
            }
    except OSError as exc:
        return {
            "reachable": False,
            "host": host,
            "port": port,
            "redis_url": settings.REDIS_URL,
            "error": str(exc),
        }

def _is_internal_client(host: str | None) -> bool:
    if not host:
        return False
    try:
        ip = ipaddress.ip_address(host)
        return ip.is_loopback or ip.is_private
    except ValueError:
        return "." not in host


def require_internal_access(
    request: Request,
    internal_key: str = Header(default="", alias="X-Internal-Key"),
):
    if not hmac.compare_digest(internal_key, settings.INTERNAL_API_KEY):
        raise HTTPException(status_code=401, detail="Invalid internal API key")
    if settings.ALLOW_EXTERNAL_INTERNAL_CALLS:
        return
    if not _is_internal_client(request.client.host if request.client else None):
        raise HTTPException(status_code=403, detail="Endpoint is restricted to internal network clients")


# Initialize Inference Service
inference_service = InferenceService()

class ClassifyRequest:
    # Manual schema since using MongoDB might not require Pydantic models for everything
    # but still good for FastAPI validation
    pass

from pydantic import BaseModel

class ClassifyRequest(BaseModel):
    image_url: str

class ClassificationResponse(BaseModel):
    prediction_id: str
    herb_id: int
    herb_name: str
    scientific_name: str
    confidence: float
    top_k: List[dict]
    uncertainty: Optional[Dict[str, Any]] = None
    inference_time_ms: float

class FeedbackRequest(BaseModel):
    prediction_id: str
    correct_herb_id: int
    correct_herb_name: str
    correct_scientific_name: str
    user_id: Optional[str] = None
    feedback_type: str = "correction"

@router.post("/classify-image", response_model=ClassificationResponse)
async def classify_image(request: ClassifyRequest, _: None = Depends(require_internal_access)):
    try:
        logger.info("classify-image request received (image_url=%s)", request.image_url)
        # 1. Download image
        image_bytes = CloudinaryStorage.download_image(request.image_url)
        
        # 2. Predict
        results = inference_service.predict(image_bytes)
        
        # 3. Store prediction metadata in server internal persistence
        prediction_doc = {
            "prediction_id": results['prediction_id'],
            "image_url": request.image_url,
            "predicted_herb_id": results['herb_id'],
            "predicted_herb_name": results['herb_name'],
            "predicted_scientific_name": results['scientific_name'],
            "confidence": results['confidence'],
            "top_5_predictions": results['top_k'],
            "model_version": settings.STUDENT_PATH,
            "inference_time_ms": results['inference_time_ms'],
            "created_at": datetime.utcnow().isoformat()
        }
        internal_api.save_prediction(prediction_doc)
        logger.info(
            "classify-image success (prediction_id=%s herb=%s confidence=%.4f)",
            results.get("prediction_id"),
            results.get("scientific_name"),
            float(results.get("confidence") or 0.0),
        )
        return results
    except Exception as e:
        logger.exception("classify-image failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/feedback")
async def store_feedback(request: FeedbackRequest, _: None = Depends(require_internal_access)):
    logger.info(
        "feedback received (prediction_id=%s type=%s correct_herb_id=%s)",
        request.prediction_id,
        request.feedback_type,
        request.correct_herb_id,
    )
    # 1. Store feedback
    feedback_doc = {
        "prediction_id": request.prediction_id,
        "correct_herb_id": request.correct_herb_id,
        "correct_herb_name": request.correct_herb_name,
        "correct_scientific_name": request.correct_scientific_name,
        "user_id": request.user_id,
        "feedback_type": request.feedback_type,
        "used_for_training": False,
        "created_at": datetime.utcnow().isoformat()
    }
    internal_api.save_feedback(feedback_doc)
    
    # 2. Buffer for training data
    original_pred = internal_api.get_prediction(request.prediction_id)
    if original_pred:
        training_doc = {
            "image_url": original_pred["image_url"],
            "herb_id": request.correct_herb_id,
            "herb_name": request.correct_herb_name,
            "scientific_name": request.correct_scientific_name,
            "source": "feedback",
            "is_new": True,
            "used_in_training": False,
            "created_at": datetime.utcnow().isoformat()
        }
        internal_api.save_training_data(training_doc)
        
    logger.info("feedback stored successfully (prediction_id=%s)", request.prediction_id)
    return {"status": "success", "message": "Feedback received"}

@router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@router.get("/modelinfo")
async def model_info():
    active_model = internal_api.get_active_model_version()
    return {
        "student_model": settings.STUDENT_MODEL,
        "teacher_model": settings.TEACHER_MODEL,
        "num_classes": settings.NUM_CLASSES,
        "active_version": active_model["version"] if active_model else "initial",
        "trained_at": active_model["trained_at"] if active_model else None
    }


@router.get("/queue/health")
async def queue_health(_: None = Depends(require_internal_access)):
    status = _redis_broker_status()
    logger.info("queue-health check (reachable=%s host=%s port=%s)", status.get("reachable"), status.get("host"), status.get("port"))
    if status["reachable"]:
        return {"status": "ok", "queue": status}
    raise HTTPException(status_code=503, detail={"status": "unavailable", "queue": status})


@router.post("/retrain")
async def retrain(_: None = Depends(require_internal_access)):
    try:
        _assert_redis_broker_available()
        task = train_herb_model.delay()
        logger.info("retrain queued (task_id=%s)", task.id)
        return {"status": "queued", "task_id": task.id}
    except Exception as e:
        logger.exception("retrain trigger failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/retrain/status/{task_id}")
async def retrain_status(task_id: str, _: None = Depends(require_internal_access)):
    try:
        result = AsyncResult(task_id, app=celery_app)
        payload = {
            "task_id": task_id,
            "state": result.state,
            "ready": result.ready(),
            "successful": result.successful() if result.ready() else False,
        }

        if result.ready():
            if result.successful():
                payload["result"] = result.result
            else:
                payload["error"] = str(result.result)
        logger.info(
            "retrain status (task_id=%s state=%s ready=%s successful=%s)",
            task_id,
            payload.get("state"),
            payload.get("ready"),
            payload.get("successful"),
        )
        return payload
    except Exception as e:
        logger.exception("retrain status failed (task_id=%s): %s", task_id, e)
        raise HTTPException(status_code=500, detail=str(e))
