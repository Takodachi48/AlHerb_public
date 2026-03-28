from contextlib import asynccontextmanager
import logging
import os
from fastapi import FastAPI
from app.api.routes import router
from app.core.config import settings
import uvicorn

logger = logging.getLogger(__name__)

class SuppressHealthcheckAccessFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        return "GET /api/v1/health" not in message


logging.getLogger("uvicorn.access").addFilter(SuppressHealthcheckAccessFilter())
logging.getLogger("app").setLevel(logging.INFO)
logging.getLogger("training").setLevel(logging.INFO)


def log_model_checkpoint_status() -> None:
    model_paths = {
        "student": settings.STUDENT_PATH,
        "teacher": settings.TEACHER_PATH,
        "active": settings.ACTIVE_MODEL_PATH,
    }
    for model_name, path in model_paths.items():
        if os.path.exists(path):
            logger.warning("%s model checkpoint found at %s", model_name, path)
        else:
            logger.error("%s model checkpoint not found at %s", model_name, path)


@asynccontextmanager
async def lifespan(_: FastAPI):
    if not settings.INTERNAL_API_KEY or len(settings.INTERNAL_API_KEY) < 32:
        raise RuntimeError("INTERNAL_API_KEY must be configured with at least 32 characters")
    log_model_checkpoint_status()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    lifespan=lifespan,
)

# Include routes
app.include_router(router, prefix=settings.API_V1_PREFIX)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
