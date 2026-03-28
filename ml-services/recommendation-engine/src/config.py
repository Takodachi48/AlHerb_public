import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


# Prefer service-root .env (../.env from src/config.py), fallback to src/.env.
SERVICE_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(SERVICE_ROOT / ".env", override=False)
load_dotenv(Path(__file__).resolve().parent / ".env", override=False)


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    recommendation_engine_port: int = _env_int("RECOMMENDATION_ENGINE_PORT", _env_int("FLORA_SERVICE_PORT", 8001))
    recommendation_retrain_threshold: int = _env_int("RECOMMENDATION_RETRAIN_THRESHOLD", _env_int("FLORA_RETRAIN_THRESHOLD", 500))
    recommendation_check_interval_hours: int = _env_int("RECOMMENDATION_CHECK_INTERVAL_HOURS", _env_int("FLORA_CHECK_INTERVAL_HOURS", 6))
    recommendation_retrain_buffer_minutes: int = _env_int("RECOMMENDATION_RETRAIN_BUFFER_MINUTES", _env_int("FLORA_RETRAIN_BUFFER_MINUTES", 60))
    image_classifier_retrain_cron: str = os.getenv("IMAGE_CLASSIFIER_RETRAIN_CRON", "0 2 * * *")
    main_api_url: str = os.getenv("MAIN_API_URL", "http://localhost:5000")
    internal_api_key: str = os.getenv("INTERNAL_API_KEY", "")
    allow_external_internal_calls: bool = _env_bool("ALLOW_EXTERNAL_INTERNAL_CALLS", False)


settings = Settings()
