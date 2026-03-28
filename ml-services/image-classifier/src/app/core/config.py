from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import computed_field
from typing import Optional

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # API
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "Herb Image Classification Service"
    
    # Models
    STUDENT_MODEL: str = "mobilenetv3_small_100"
    TEACHER_MODEL: str = "efficientnet_b0"
    
    # Paths (relative to repository root or absolute)
    STUDENT_PATH: str = "src/models/student/best_student_model.pth"
    TEACHER_PATH: str = "src/models/teacher/best_teacher_model.pth"
    ACTIVE_MODEL_PATH: str = "src/models/active/model.pth"
    
    NUM_CLASSES: int = 3   # ONLY modify this value - everything else adapts automatically
    IMAGE_SIZE: int = 224
    
    # Knowledge Distillation
    DISTILLATION_TEMPERATURE: float = 2.0
    DISTILLATION_ALPHA: float = 0.7
    DISTILLATION_LOSS_WEIGHT: float = 0.3
    DISTILL_ALPHA: float = 0.3      # Weight for CE loss
    DISTILL_TEMPERATURE: float = 4.0 # Softening temperature
    
    # Inference Settings
    INFERENCE_TEMPERATURE: float = 1.5  # >1.0 reduces confidence, <1.0 increases confidence
    INFERENCE_UNCERTAINTY_LOW_CONFIDENCE_THRESHOLD: float = 0.75
    INFERENCE_UNCERTAINTY_MARGIN_THRESHOLD: float = 0.15
    INFERENCE_UNCERTAINTY_USE_ENTROPY: bool = False
    # Normalized entropy threshold in [0, 1]. Used only when INFERENCE_UNCERTAINTY_USE_ENTROPY=true.
    INFERENCE_UNCERTAINTY_ENTROPY_THRESHOLD: float = 0.85
    
    # Training
    TRAIN_OLD_DATA_RATIO: float = 0.8  # 80% old data
    TRAIN_NEW_DATA_RATIO: float = 0.2  # 20% new data
    MIN_NEW_SAMPLES: int = 500
    MAX_NEW_SAMPLES_PER_TRAINING: int = 500
    TRAINING_EPOCHS: int = 15
    EARLY_STOPPING_PATIENCE: int = 5

    # Batch sizing (adaptive defaults are computed in DataBuffer when set to 0).
    TRAIN_BATCH_SIZE: int = 0
    TRAIN_BATCH_SIZE_CUDA_40_CLASS: int = 12
    TRAIN_BATCH_SIZE_CUDA_10_CLASS: int = 16
    TRAIN_BATCH_SIZE_CPU_40_CLASS: int = 8
    TRAIN_BATCH_SIZE_CPU_10_CLASS: int = 12

    # Memory and stability knobs for larger class counts.
    USE_MIXED_PRECISION: bool = True
    GRADIENT_ACCUMULATION_STEPS: int = 1

    # Image cache for retraining dataset (prevents repeat downloads).
    TRAIN_IMAGE_CACHE_DIR: str = "src/models/cache/images"
    TRAIN_IMAGE_CACHE_MAX_FILES: int = 5000
    
    @computed_field
    @property
    def LABELS_PATH(self) -> str:
        """Dynamic labels path based on NUM_CLASSES"""
        return f"src/models/herb_labels_{self.NUM_CLASSES}_classes.json"
    LEARNING_RATE: float = 0.0005
    
    # Trigger Conditions
    TRIGGER_SAMPLE_THRESHOLD: int = 500
    TRIGGER_TIME_DAYS: int = 7
    TRIGGER_MIN_SAMPLES_FOR_TIME: int = 200
    
    # Main API (internal persistence endpoints)
    MAIN_API_URL: str = "http://localhost:5000"
    INTERNAL_API_KEY: str = ""
    ALLOW_EXTERNAL_INTERNAL_CALLS: bool = False
    # Deprecated and ignored by current architecture (kept for backward compatibility)
    IMAGE_CLASSIFIER_DB_URI: Optional[str] = None
    
    # Cloudinary
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

settings = Settings()
