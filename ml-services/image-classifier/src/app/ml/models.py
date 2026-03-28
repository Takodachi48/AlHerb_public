import torch
import torch.nn as nn
import timm
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def _load_state_dict_forgiving(model: nn.Module, state_dict: dict) -> tuple[int, int]:
    """
    Load only compatible keys so architecture upgrades (e.g. hidden dim changes)
    do not hard-fail older checkpoints.
    """
    model_state = model.state_dict()
    compatible = {}
    skipped = 0
    for key, value in state_dict.items():
        if key in model_state and model_state[key].shape == value.shape:
            compatible[key] = value
        else:
            skipped += 1
    loaded = len(compatible)
    if loaded == 0:
        raise ValueError("No compatible tensors found in checkpoint state_dict.")
    model.load_state_dict(compatible, strict=False)
    if skipped > 0:
        logger.warning("Skipped %s incompatible checkpoint tensor(s) during load.", skipped)
    return loaded, skipped


def _extract_state_dict_from_checkpoint(
    checkpoint: object,
    preferred_keys: tuple[str, ...] = ("model_state_dict", "state_dict"),
) -> tuple[dict | None, str]:
    """
    Support multiple checkpoint formats:
    1) Wrapped dict with a known state-dict key.
    2) Raw state_dict (tensor map).
    """
    if not isinstance(checkpoint, dict):
        return None, "unknown"

    for key in preferred_keys:
        value = checkpoint.get(key)
        if isinstance(value, dict):
            return value, key

    # Raw state_dict format: every value is tensor-like.
    if checkpoint and all(torch.is_tensor(value) for value in checkpoint.values()):
        return checkpoint, "raw_state_dict"

    return None, "unknown"

class StudentModel(nn.Module):
    """MobileNetV3-Small student for runtime inference"""
    
    def __init__(self, num_classes: int = 40, pretrained: bool = True, hidden_dim: int | None = None):
        super().__init__()
        
        # MobileNetV3-Small backbone
        self.backbone = timm.create_model(
            'mobilenetv3_small_100',
            pretrained=pretrained,
            num_classes=0  # Remove classifier
        )
        
        # Get feature dimension
        self.feature_dim = self.backbone.num_features  # 1024
        
        # Scale classifier capacity for higher class counts while preserving
        # compatibility with existing 3/10-class checkpoints.
        hidden_dim = hidden_dim or (768 if num_classes >= 20 else 512)
        dropout_p = 0.3 if num_classes >= 20 else 0.2
        self.hidden_dim = hidden_dim
        self.classifier = nn.Sequential(
            nn.Dropout(p=dropout_p),               # classifier.0
            nn.Linear(self.feature_dim, hidden_dim),  # classifier.1
            nn.BatchNorm1d(hidden_dim),            # classifier.2
            nn.ReLU(inplace=True),                 # classifier.3
            nn.Dropout(p=dropout_p),               # classifier.4
            nn.Linear(hidden_dim, num_classes)     # classifier.5
        )
        
        # Freeze backbone by default
        self.freeze_backbone()
    
    def forward(self, x):
        features = self.backbone(x)
        logits = self.classifier(features)
        return logits
    
    def freeze_backbone(self):
        """Freeze backbone for efficient training"""
        for param in self.backbone.parameters():
            param.requires_grad = False
    
    def unfreeze_last_block(self):
        """Optionally unfreeze last block for fine-tuning"""
        # Unfreeze last inverted residual block
        if hasattr(self.backbone, 'blocks') and len(self.backbone.blocks) > 0:
            for param in self.backbone.blocks[-1].parameters():
                param.requires_grad = True

class TeacherModel(nn.Module):
    """EfficientNet-B0 teacher for knowledge distillation"""
    
    def __init__(self, num_classes: int = 40):
        super().__init__()
        
        # EfficientNet-B0 (always frozen)
        self.model = timm.create_model(
            'efficientnet_b0',
            pretrained=False,
            num_classes=num_classes
        )
        
        # Freeze all parameters
        for param in self.model.parameters():
            param.requires_grad = False
        
        # Always in eval mode
        self.model.eval()
    
    def forward(self, x):
        with torch.no_grad():
            return self.model(x)


def _normalize_student_state_dict(state_dict: dict, source_key: str | None) -> dict:
    """
    Normalize older student checkpoint layouts to the current classifier index layout.
    """
    if source_key != "student_model_state_dict":
        return state_dict

    corrected_state_dict = {}
    for key, value in state_dict.items():
        if key.startswith('classifier.'):
            if key == 'classifier.2.weight':
                corrected_state_dict['classifier.1.weight'] = value
            elif key == 'classifier.2.bias':
                corrected_state_dict['classifier.1.bias'] = value
            elif key == 'classifier.3.weight':
                corrected_state_dict['classifier.2.weight'] = value
            elif key == 'classifier.3.bias':
                corrected_state_dict['classifier.2.bias'] = value
            elif key == 'classifier.3.running_mean':
                corrected_state_dict['classifier.2.running_mean'] = value
            elif key == 'classifier.3.running_var':
                corrected_state_dict['classifier.2.running_var'] = value
            elif key == 'classifier.3.num_batches_tracked':
                corrected_state_dict['classifier.2.num_batches_tracked'] = value
            elif key == 'classifier.6.weight':
                corrected_state_dict['classifier.5.weight'] = value
            elif key == 'classifier.6.bias':
                corrected_state_dict['classifier.5.bias'] = value
            else:
                corrected_state_dict[key] = value
        else:
            corrected_state_dict[key] = value
    return corrected_state_dict


def _infer_hidden_dim_from_student_state_dict(state_dict: dict, fallback_hidden_dim: int) -> int:
    linear1 = state_dict.get("classifier.1.weight")
    if torch.is_tensor(linear1) and len(linear1.shape) == 2:
        return int(linear1.shape[0])

    linear2 = state_dict.get("classifier.5.weight")
    if torch.is_tensor(linear2) and len(linear2.shape) == 2:
        return int(linear2.shape[1])

    return fallback_hidden_dim

def load_student(
    checkpoint_path: str,
    num_classes: int,
    device: str = "cpu",
    model_role: str = "student",
):
    """Load student model from checkpoint or initialize new one"""
    default_hidden_dim = 768 if num_classes >= 20 else 512
    inferred_hidden_dim = default_hidden_dim
    normalized_state_dict = None
    state_source = None

    if os.path.exists(checkpoint_path):
        checkpoint = torch.load(checkpoint_path, map_location=device)
        if isinstance(checkpoint, dict):
            if isinstance(checkpoint.get("student_model_state_dict"), dict):
                state_source = "student_model_state_dict"
                normalized_state_dict = _normalize_student_state_dict(checkpoint["student_model_state_dict"], state_source)
            elif isinstance(checkpoint.get("model_state_dict"), dict):
                state_source = "model_state_dict"
                normalized_state_dict = checkpoint["model_state_dict"]
            elif checkpoint and all(torch.is_tensor(v) for v in checkpoint.values()):
                state_source = "raw_state_dict"
                normalized_state_dict = checkpoint
        if normalized_state_dict is not None:
            inferred_hidden_dim = _infer_hidden_dim_from_student_state_dict(
                normalized_state_dict,
                default_hidden_dim,
            )

    # Avoid runtime network downloads on constrained hosts (e.g. HF Spaces).
    model = StudentModel(num_classes=num_classes, pretrained=False, hidden_dim=inferred_hidden_dim)
    
    if os.path.exists(checkpoint_path):
        try:
            if normalized_state_dict is None:
                raise ValueError("No valid student state_dict found in checkpoint.")

            head_weight = normalized_state_dict.get("classifier.5.weight")
            if torch.is_tensor(head_weight) and len(head_weight.shape) == 2:
                checkpoint_classes = int(head_weight.shape[0])
                if checkpoint_classes != num_classes:
                    logger.warning(
                        "%s checkpoint class count (%s) does not match configured NUM_CLASSES (%s). "
                        "Classifier head may be partially loaded.",
                        model_role,
                        checkpoint_classes,
                        num_classes,
                    )

            _load_state_dict_forgiving(model, normalized_state_dict)
            logger.info(
                "%s model loaded from %s (source=%s hidden_dim=%s)",
                model_role,
                checkpoint_path,
                state_source or "unknown",
                inferred_hidden_dim,
            )
        except Exception:
            logger.exception("Failed to load %s model from %s", model_role, checkpoint_path)
            raise
    else:
        logger.warning(
            "%s model checkpoint not found at %s, using randomly initialized backbone.",
            model_role,
            checkpoint_path,
        )
    
    model.to(device)
    model.eval()
    return model

def load_teacher(checkpoint_path: Optional[str], num_classes: int, device: str = "cpu"):
    """Load teacher model (usually from timm weights directly for b0)"""
    if not checkpoint_path:
        logger.warning("Teacher model path not provided - training disabled")
        return None

    if not os.path.exists(checkpoint_path):
        logger.warning("Teacher model checkpoint not found at %s - training disabled", checkpoint_path)
        return None
        
    model = TeacherModel(num_classes=num_classes)
    
    if os.path.exists(checkpoint_path):
        checkpoint = torch.load(checkpoint_path, map_location=device)
        if isinstance(checkpoint, dict) and "student_model_state_dict" in checkpoint:
            raise ValueError(
                "Teacher checkpoint appears to be a student checkpoint "
                "(found key 'student_model_state_dict'). Please point TEACHER_PATH "
                "to EfficientNet-B0 teacher weights."
            )
        state_dict, source = _extract_state_dict_from_checkpoint(
            checkpoint,
            preferred_keys=("model_state_dict", "teacher_model_state_dict", "state_dict"),
        )
        if state_dict is None:
            found_keys = list(checkpoint.keys())[:20] if isinstance(checkpoint, dict) else []
            raise KeyError(
                "No teacher state_dict found in checkpoint. Expected one of: "
                "model_state_dict, teacher_model_state_dict, state_dict, or raw state_dict. "
                f"Found keys: {found_keys}"
            )
        _load_state_dict_forgiving(model.model, state_dict)
        logger.info("Teacher model loaded from %s (source=%s)", checkpoint_path, source)
    
    model.to(device)
    model.eval()
    return model
