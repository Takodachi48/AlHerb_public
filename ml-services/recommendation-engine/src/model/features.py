from __future__ import annotations

from typing import Dict, Iterable, List, Tuple

import numpy as np

GENDER_CLASSES = ["male", "female", "other"]
SEVERITY_ORDER = {"mild": 0, "moderate": 1, "severe": 2}
EFFECTIVENESS_SCORE = {
    "very_poor": 0.0,
    "poor": 0.25,
    "neutral": 0.5,
    "good": 0.75,
    "excellent": 1.0,
}


def _normalize_token(value: str) -> str:
    return str(value or "").strip().lower()


def _sorted_vocab(records: Iterable[dict], key: str) -> List[str]:
    values = set()
    for record in records:
        for item in record.get(key, []) or []:
            token = _normalize_token(item)
            if token:
                values.add(token)
    return sorted(values)


def build_feature_meta(records: List[dict]) -> Dict:
    return {
        "age": {"min": 0, "max": 120},
        "gender_classes": GENDER_CLASSES,
        "severity_map": SEVERITY_ORDER,
        "conditions_vocab": _sorted_vocab(records, "conditions"),
        "medications_vocab": _sorted_vocab(records, "medications"),
        "herb_symptoms_vocab": _sorted_vocab(records, "herb_symptoms"),
        "herb_properties_vocab": _sorted_vocab(records, "herb_properties"),
        "effectiveness_score_map": EFFECTIVENESS_SCORE,
    }


def _multi_hot(values: Iterable[str], vocab: List[str]) -> List[float]:
    lookup = {item: idx for idx, item in enumerate(vocab)}
    output = [0.0] * len(vocab)
    for value in values or []:
        token = _normalize_token(value)
        idx = lookup.get(token)
        if idx is not None:
            output[idx] = 1.0
    return output


def build_feature_names(meta: Dict) -> List[str]:
    names = ["age_norm"]
    names.extend([f"gender:{v}" for v in meta["gender_classes"]])
    names.append("severity_ordinal")
    names.extend([f"condition:{v}" for v in meta["conditions_vocab"]])
    names.extend([f"medication:{v}" for v in meta["medications_vocab"]])
    names.extend([f"herb_symptom:{v}" for v in meta["herb_symptoms_vocab"]])
    names.extend([f"herb_property:{v}" for v in meta["herb_properties_vocab"]])
    return names


def encode_record(record: dict, meta: Dict) -> List[float]:
    age_cfg = meta["age"]
    age_min = age_cfg["min"]
    age_max = age_cfg["max"]
    age_value = max(age_min, min(age_max, int(record.get("age", 0) or 0)))
    age_norm = (age_value - age_min) / (age_max - age_min) if age_max > age_min else 0.0

    gender_token = _normalize_token(record.get("gender", "other"))
    gender_vector = [1.0 if gender_token == g else 0.0 for g in meta["gender_classes"]]
    if sum(gender_vector) == 0:
        gender_vector[-1] = 1.0

    severity_token = _normalize_token(record.get("severity", "moderate"))
    severity_value = float(meta["severity_map"].get(severity_token, 1))

    features = [age_norm, *gender_vector, severity_value]
    features.extend(_multi_hot(record.get("conditions", []), meta["conditions_vocab"]))
    features.extend(_multi_hot(record.get("medications", []), meta["medications_vocab"]))
    features.extend(_multi_hot(record.get("herb_symptoms", []), meta["herb_symptoms_vocab"]))
    features.extend(_multi_hot(record.get("herb_properties", []), meta["herb_properties_vocab"]))
    return features


def build_training_matrices(records: List[dict], meta: Dict) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    x_rows = [encode_record(record, meta) for record in records]
    y_rating = [float(record["rating"]) for record in records]
    y_effectiveness = [_normalize_token(record.get("effectiveness", "neutral")) for record in records]
    return np.array(x_rows, dtype=float), np.array(y_rating, dtype=float), np.array(y_effectiveness)
