from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import make_scorer, mean_squared_error
from sklearn.model_selection import KFold, cross_val_score
from sklearn.preprocessing import LabelEncoder

from client.mongo_client import fetch_training_data
from client.recommendation_db import save_training_run
from model.features import build_feature_meta, build_feature_names, build_training_matrices

LOGGER = logging.getLogger("recommendation-engine.trainer")
ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
MODEL_PATH = ARTIFACT_DIR / "model.pkl"
META_PATH = ARTIFACT_DIR / "feature_meta.json"


def _load_previous_meta() -> Dict:
    if META_PATH.exists():
        return json.loads(META_PATH.read_text(encoding="utf-8"))
    return {}


def _rmse(y_true, y_pred):
    return mean_squared_error(y_true, y_pred) ** 0.5


def train_models(limit: int = 5000) -> Dict:
    run_started_at = datetime.now(timezone.utc)
    records = fetch_training_data(limit=limit)
    if len(records) < 10:
        raise RuntimeError("Not enough feedback records to train recommendation model.")

    feature_meta = build_feature_meta(records)
    x, y_rating, y_effectiveness = build_training_matrices(records, feature_meta)

    label_encoder = LabelEncoder()
    y_effectiveness_encoded = label_encoder.fit_transform(y_effectiveness)

    regressor = RandomForestRegressor(
        n_estimators=300,
        max_depth=None,
        min_samples_leaf=1,
        random_state=42,
        n_jobs=-1,
    )
    classifier = RandomForestClassifier(
        n_estimators=300,
        max_depth=None,
        min_samples_leaf=1,
        random_state=42,
        n_jobs=-1,
    )

    cv = KFold(n_splits=5, shuffle=True, random_state=42)
    rmse_scores = -cross_val_score(
        regressor,
        x,
        y_rating,
        scoring=make_scorer(_rmse, greater_is_better=False),
        cv=cv,
        n_jobs=-1,
    )
    accuracy_scores = cross_val_score(
        classifier,
        x,
        y_effectiveness_encoded,
        scoring="accuracy",
        cv=cv,
        n_jobs=-1,
    )

    cv_rmse_mean = float(np.mean(rmse_scores))
    cv_accuracy_mean = float(np.mean(accuracy_scores))

    regressor.fit(x, y_rating)
    classifier.fit(x, y_effectiveness_encoded)

    previous_meta = _load_previous_meta()
    previous_rmse = previous_meta.get("cv_scores", {}).get("rmse_mean")
    if previous_rmse is not None and cv_rmse_mean > float(previous_rmse):
        LOGGER.warning(
            "Training completed but model not saved because RMSE worsened (new=%.4f, old=%.4f)",
            cv_rmse_mean,
            float(previous_rmse),
        )
        result = {
            "saved": False,
            "record_count": len(records),
            "cv_scores": {"rmse_mean": cv_rmse_mean, "accuracy_mean": cv_accuracy_mean},
            "model_version": previous_meta.get("model_version", "unknown"),
            "trained_at": datetime.now(timezone.utc).isoformat(),
        }
        save_training_run({
            **result,
            "run_started_at": run_started_at,
            "reason": "rmse_worse_than_previous",
        })
        return result

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    model_version = f"rf-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    joblib.dump(
        {
            "regressor": regressor,
            "classifier": classifier,
            "label_encoder": label_encoder,
        },
        MODEL_PATH,
    )

    meta_payload = {
        "model_version": model_version,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "record_count": len(records),
        "cv_scores": {"rmse_mean": cv_rmse_mean, "accuracy_mean": cv_accuracy_mean},
        "feature_names": build_feature_names(feature_meta),
        "feature_meta": feature_meta,
        "effectiveness_classes": list(label_encoder.classes_),
    }
    META_PATH.write_text(json.dumps(meta_payload, indent=2), encoding="utf-8")

    LOGGER.info(
        "Model saved: version=%s records=%d rmse=%.4f accuracy=%.4f",
        model_version,
        len(records),
        cv_rmse_mean,
        cv_accuracy_mean,
    )
    result = {"saved": True, **meta_payload}
    save_training_run({
        **result,
        "run_started_at": run_started_at,
    })
    return result
