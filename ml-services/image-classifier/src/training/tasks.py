from celery import Celery
from app.core.config import settings
from app.ml.distillation import KnowledgeDistillationTrainer
from app.services import internal_api
from training.model_manager import ModelManager
from training.data_buffer import DataBuffer
import logging
import os
import torch
from collections import Counter
from math import ceil
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

celery_app = Celery("herb_training", broker=settings.REDIS_URL, backend=settings.REDIS_URL)
celery_app.conf.broker_connection_retry_on_startup = True


def _log_checkpoint_status():
    model_paths = {
        "student": settings.STUDENT_PATH,
        "teacher": settings.TEACHER_PATH,
        "active": settings.ACTIVE_MODEL_PATH,
    }
    for model_name, path in model_paths.items():
        if os.path.exists(path):
            logger.info("%s model checkpoint found at %s", model_name, path)
        else:
            logger.warning("%s model checkpoint not found at %s", model_name, path)

def _required_per_class(min_total: int) -> int:
    return max(1, ceil(min_total / max(1, settings.NUM_CLASSES)))


def _has_per_class_minimum(new_data, min_total: int) -> tuple[bool, dict[int, int], int]:
    required_per_class = _required_per_class(min_total)
    counts = Counter()
    for item in new_data:
        try:
            class_id = int(item.get("herb_id"))
        except (TypeError, ValueError):
            continue
        counts[class_id] += 1

    missing_or_low = {}
    for class_id in range(settings.NUM_CLASSES):
        class_count = counts.get(class_id, 0)
        if class_count < required_per_class:
            missing_or_low[class_id] = class_count

    return len(missing_or_low) == 0, dict(counts), required_per_class


@celery_app.task(name="training.check_and_trigger_training")
def check_and_trigger_training():
    """Periodic task to check if training conditions are met"""
    _log_checkpoint_status()

    # First check if teacher model exists
    if not os.path.exists(settings.TEACHER_PATH):
        logger.info("Training disabled - no teacher model available")
        return

    state = internal_api.get_training_state()
    new_samples_count = int(state.get("newSamplesCount", 0))
    last_model = state.get("lastModel")
    new_data = None

    should_train = False
    if new_samples_count >= settings.TRIGGER_SAMPLE_THRESHOLD:
        if new_data is None:
            new_data = internal_api.fetch_training_data(is_new=True, limit=50000)
        per_class_ok, class_counts, required_per_class = _has_per_class_minimum(
            new_data,
            settings.TRIGGER_SAMPLE_THRESHOLD,
        )
        if per_class_ok:
            should_train = True
            logger.info(
                "Triggering training: sample threshold reached with per-class minimum met "
                "(required_per_class=%s class_counts=%s).",
                required_per_class,
                class_counts,
            )
        else:
            logger.info(
                "Training deferred: sample threshold reached but class balance minimum not met "
                "(required_per_class=%s class_counts=%s).",
                required_per_class,
                class_counts,
            )
    elif last_model and last_model.get("trained_at"):
        trained_at = datetime.fromisoformat(str(last_model["trained_at"]).replace("Z", "+00:00")).replace(tzinfo=None)
        if (datetime.utcnow() - trained_at) >= timedelta(days=settings.TRIGGER_TIME_DAYS):
            if new_samples_count >= settings.TRIGGER_MIN_SAMPLES_FOR_TIME:
                if new_data is None:
                    new_data = internal_api.fetch_training_data(is_new=True, limit=50000)
                per_class_ok, class_counts, required_per_class = _has_per_class_minimum(
                    new_data,
                    settings.TRIGGER_MIN_SAMPLES_FOR_TIME,
                )
                if per_class_ok:
                    should_train = True
                    logger.info(
                        "Triggering training: time threshold + min samples reached with per-class minimum met "
                        "(required_per_class=%s class_counts=%s).",
                        required_per_class,
                        class_counts,
                    )
                else:
                    logger.info(
                        "Training deferred: time threshold met but class balance minimum not met "
                        "(required_per_class=%s class_counts=%s).",
                        required_per_class,
                        class_counts,
                    )

    if should_train:
        train_herb_model.delay()

@celery_app.task(name="training.train_herb_model")
def train_herb_model():
    """Execute knowledge distillation training"""
    logger.info("Starting knowledge distillation training...")
    _log_checkpoint_status()
    try:
        # 1. Init Trainer to check if training is available
        device = "cuda" if torch.cuda.is_available() else "cpu"
        try:
            trainer = KnowledgeDistillationTrainer(
                student_path=settings.STUDENT_PATH,
                teacher_path=settings.TEACHER_PATH,
                device=device
            )
        except Exception as e:
            logger.error(f"Failed to initialize trainer: {str(e)}")
            logger.info("Training unavailable due to trainer initialization error (check teacher checkpoint format/path).")
            return {
                "status": "skipped",
                "reason": f"trainer_init_failed: {str(e)}",
            }
            
        if not trainer.training_enabled:
            logger.info("Training disabled - no teacher model available")
            return {
                "status": "skipped",
                "reason": "training_disabled_no_teacher",
            }
        
        # 2. Prepare Data
        buffer = DataBuffer()
        train_loader, val_loader, stats = buffer.prepare_loaders()
        
        if not train_loader:
            logger.warning("No training data available. Skipping.")
            return {
                "status": "skipped",
                "reason": "no_training_data",
            }

        class_counts = stats.get("class_counts", {})
        if class_counts:
            counts = [max(1, int(class_counts.get(class_id, 0))) for class_id in range(settings.NUM_CLASSES)]
            inverse = torch.tensor([1.0 / c for c in counts], dtype=torch.float32)
            class_weights = inverse * (len(counts) / torch.sum(inverse))
            trainer.set_class_weights(class_weights)
            logger.info("Using class-weighted loss with counts=%s", class_counts)

        # 3. Train (multi-epoch with early stopping for larger class counts)
        best_val = None
        best_train = None
        best_epoch = 0
        best_state = None
        epochs_without_improvement = 0

        for epoch in range(1, max(1, int(settings.TRAINING_EPOCHS)) + 1):
            train_results = trainer.train_epoch(train_loader)
            val_results = trainer.validate(val_loader)

            logger.info(
                "Epoch %s/%s - train_loss=%.4f val_loss=%.4f val_accuracy=%.4f",
                epoch,
                settings.TRAINING_EPOCHS,
                train_results.get("loss", 0.0),
                val_results.get("loss", 0.0),
                val_results.get("accuracy", 0.0),
            )

            if best_val is None or val_results.get("accuracy", 0.0) > best_val.get("accuracy", 0.0):
                best_val = val_results
                best_train = train_results
                best_epoch = epoch
                best_state = trainer.student.state_dict()
                epochs_without_improvement = 0
            else:
                epochs_without_improvement += 1

            if epochs_without_improvement >= max(1, int(settings.EARLY_STOPPING_PATIENCE)):
                logger.info(
                    "Early stopping triggered at epoch %s (patience=%s).",
                    epoch,
                    settings.EARLY_STOPPING_PATIENCE,
                )
                break

        if best_state is None or best_val is None or best_train is None:
            logger.warning("No valid training result produced. Skipping checkpoint save.")
            return {
                "status": "skipped",
                "reason": "no_valid_training_result",
            }

        trainer.student.load_state_dict(best_state)
        detailed_val = trainer.validate_detailed(val_loader)
        
        # 4. Save and Swap
        version = f"v_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        checkpoint_path = f"src/models/student/checkpoint_{version}.pth"
        class_mapping = stats.get("class_mapping", {}) or {}
        class_to_idx = {
            mapping.get("scientific_name", str(class_id)): int(class_id)
            for class_id, mapping in class_mapping.items()
        }
        idx_to_class = {
            str(class_id): mapping.get("scientific_name", "Unknown")
            for class_id, mapping in class_mapping.items()
        }
        trainer.save_checkpoint(
            checkpoint_path,
            extra_metadata={
                "class_mapping": class_mapping,
                "class_to_idx": class_to_idx,
                "idx_to_class": idx_to_class,
                "num_classes": settings.NUM_CLASSES,
                "trained_with_labels_path": settings.LABELS_PATH,
            },
        )
        
        ModelManager.deploy_new_model(checkpoint_path, version)
        
        # 5. Record Version
        new_version_doc = {
            "version": version,
            "model_path": settings.ACTIVE_MODEL_PATH,
            "val_accuracy": best_val['accuracy'],
            "val_loss": best_val['loss'],
            "is_active": True,
            "trained_at": datetime.utcnow()
        }
        internal_api.activate_model_version(new_version_doc)
        
        # 6. Mark data as used
        buffer.mark_data_as_used(stats['sample_ids'])
        
        logger.info(f"Training complete. New version: {version}")
        return {
            "status": "completed",
            "version": version,
            "model_path": settings.ACTIVE_MODEL_PATH,
            "best_epoch": best_epoch,
            "val_accuracy": best_val.get('accuracy'),
            "val_loss": best_val.get('loss'),
            "train_loss": best_train.get('loss'),
            "train_ce_loss": best_train.get('ce_loss'),
            "train_kl_loss": best_train.get('kl_loss'),
            "trained_at": datetime.utcnow().isoformat(),
            "class_counts": stats.get('class_counts', {}),
            "batch_size": stats.get('batch_size'),
            "validation": detailed_val,
        }
        
    except Exception as e:
        logger.error(f"Training failed: {str(e)}")
        return {
            "status": "failed",
            "reason": str(e),
        }
