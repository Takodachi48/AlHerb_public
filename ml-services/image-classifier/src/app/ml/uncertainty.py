import math
from typing import Dict, List

import torch


def compute_uncertainty(
    probabilities: torch.Tensor,
    low_confidence_threshold: float = 0.75,
    margin_threshold: float = 0.15,
    use_entropy: bool = False,
    entropy_threshold: float = 0.85,
) -> Dict:
    """
    Compute uncertainty signals from a single softmax probability vector.

    Rules:
    - uncertain if p_max < low_confidence_threshold
    - uncertain if (p_max - p_second) < margin_threshold
    - optional: uncertain if normalized entropy > entropy_threshold

    Args:
        probabilities: 1D tensor of class probabilities.
        low_confidence_threshold: minimum top-class confidence to be considered certain.
        margin_threshold: minimum gap between top-1 and top-2 probabilities.
        use_entropy: whether to apply entropy-based uncertainty.
        entropy_threshold: threshold on normalized entropy [0, 1].

    Returns:
        Dict with uncertainty diagnostics and final flag.
    """
    if probabilities.ndim != 1:
        raise ValueError("probabilities must be a 1D tensor.")
    if probabilities.numel() < 2:
        raise ValueError("probabilities must have at least 2 classes.")

    top_probs, _ = torch.topk(probabilities, k=2)
    p_max = float(top_probs[0].item())
    p_second = float(top_probs[1].item())
    margin = p_max - p_second

    reasons: List[str] = []
    if p_max < low_confidence_threshold:
        reasons.append("low_confidence")
    if margin < margin_threshold:
        reasons.append("low_margin")

    entropy = 0.0
    normalized_entropy = 0.0
    if use_entropy:
        eps = 1e-12
        p = torch.clamp(probabilities, min=eps)
        entropy = float((-p * torch.log(p)).sum().item())
        max_entropy = math.log(float(probabilities.numel()))
        normalized_entropy = float(entropy / max_entropy) if max_entropy > 0 else 0.0
        if normalized_entropy > entropy_threshold:
            reasons.append("high_entropy")

    return {
        "max_probability": round(p_max, 6),
        "second_probability": round(p_second, 6),
        "margin": round(margin, 6),
        "is_uncertain": len(reasons) > 0,
        "reasons": reasons,
        "thresholds": {
            "low_confidence": low_confidence_threshold,
            "margin": margin_threshold,
            "entropy": entropy_threshold if use_entropy else None,
        },
        "entropy": round(entropy, 6) if use_entropy else None,
        "entropy_normalized": round(normalized_entropy, 6) if use_entropy else None,
    }

