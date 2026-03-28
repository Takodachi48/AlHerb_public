from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

import joblib

from model.features import encode_record

ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
MODEL_PATH = ARTIFACT_DIR / "model.pkl"
META_PATH = ARTIFACT_DIR / "feature_meta.json"


def load_model_bundle():
    if not MODEL_PATH.exists() or not META_PATH.exists():
        return None
    models = joblib.load(MODEL_PATH)
    meta = json.loads(META_PATH.read_text(encoding="utf-8"))
    return {"models": models, "meta": meta}


def _score_effectiveness(label: str, score_map: Dict[str, float]) -> float:
    return float(score_map.get(str(label).strip().lower(), 0.0))


def score_candidates(candidates: List[dict], user_profile: dict, bundle: dict) -> List[dict]:
    models = bundle["models"]
    meta = bundle["meta"]
    feature_meta = meta["feature_meta"]
    score_map = feature_meta.get("effectiveness_score_map", {})

    ranked = []
    for candidate in candidates:
        row = {
            "age": user_profile.get("age"),
            "gender": user_profile.get("gender"),
            "severity": user_profile.get("severity"),
            "conditions": user_profile.get("conditions", []),
            "medications": user_profile.get("medications", []),
            "herb_symptoms": candidate.get("symptoms", []),
            "herb_properties": candidate.get("properties", []),
        }

        vector = encode_record(row, feature_meta)
        predicted_rating = float(models["regressor"].predict([vector])[0])
        pred_class = int(models["classifier"].predict([vector])[0])
        predicted_effectiveness = str(models["label_encoder"].inverse_transform([pred_class])[0])
        effectiveness_score = _score_effectiveness(predicted_effectiveness, score_map)
        # Rating is normalized to 0-1 so weighted score stays on a bounded scale.
        score = (0.7 * (predicted_rating / 5.0)) + (0.3 * effectiveness_score)

        ranked.append(
            {
                "herb_id": candidate["herb_id"],
                "predicted_rating": round(predicted_rating, 4),
                "predicted_effectiveness": predicted_effectiveness,
                "score": round(score, 6),
            }
        )

    ranked.sort(key=lambda item: item["score"], reverse=True)
    return ranked
