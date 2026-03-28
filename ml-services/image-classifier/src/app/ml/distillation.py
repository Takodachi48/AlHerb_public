import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader
import logging
from pathlib import Path
from typing import Dict, Optional, Tuple
from contextlib import nullcontext
from app.ml.models import load_student, load_teacher
from app.core.config import settings

logger = logging.getLogger(__name__)

class DistillationLoss(nn.Module):
    """
    Combined loss for knowledge distillation
    Loss = α * CE(student, true_labels) + (1-α) * KL(student, teacher)
    """
    def __init__(self, alpha: float = 0.3, temperature: float = 4.0, class_weights: torch.Tensor | None = None):
        super().__init__()
        self.alpha = alpha
        self.temperature = temperature
        self.ce_loss = nn.CrossEntropyLoss(weight=class_weights)
    
    def forward(self, student_logits: torch.Tensor, teacher_logits: torch.Tensor, true_labels: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        ce_loss = self.ce_loss(student_logits, true_labels)
        
        # KL Divergence for soft targets
        student_soft = F.log_softmax(student_logits / self.temperature, dim=1)
        teacher_soft = F.softmax(teacher_logits / self.temperature, dim=1)
        
        kl_loss = F.kl_div(student_soft, teacher_soft, reduction='batchmean') * (self.temperature ** 2)
        
        total_loss = self.alpha * ce_loss + (1 - self.alpha) * kl_loss
        return total_loss, ce_loss, kl_loss

class KnowledgeDistillationTrainer:
    """
    Train student model using teacher guidance
    """
    def __init__(self, student_path: str, teacher_path: Optional[str] = None, device: str = "cpu"):
        self.device = torch.device(device)
        self.num_classes = settings.NUM_CLASSES
        self.use_mixed_precision = bool(settings.USE_MIXED_PRECISION and self.device.type == "cuda")
        self.grad_accum_steps = max(1, int(settings.GRADIENT_ACCUMULATION_STEPS))
        
        # Load models
        self.student = load_student(student_path, self.num_classes, device)
        self.teacher = load_teacher(teacher_path, self.num_classes, device)
        
        # Only setup training components if teacher is available
        if self.teacher is not None:
            self.criterion = DistillationLoss(settings.DISTILL_ALPHA, settings.DISTILL_TEMPERATURE)
            self.optimizer = torch.optim.Adam(filter(lambda p: p.requires_grad, self.student.parameters()), lr=settings.LEARNING_RATE)
            self.scaler = torch.cuda.amp.GradScaler(enabled=self.use_mixed_precision)
            self.training_enabled = True
            logger.info(
                "Knowledge distillation trainer initialized with teacher "
                "(mixed_precision=%s grad_accum_steps=%s lr=%s).",
                self.use_mixed_precision,
                self.grad_accum_steps,
                settings.LEARNING_RATE,
            )
        else:
            self.criterion = None
            self.optimizer = None
            self.scaler = None
            self.training_enabled = False
            logger.info("Knowledge distillation trainer initialized without teacher - training disabled")

    def set_class_weights(self, class_weights: torch.Tensor) -> None:
        if not self.training_enabled:
            return
        self.criterion = DistillationLoss(
            settings.DISTILL_ALPHA,
            settings.DISTILL_TEMPERATURE,
            class_weights=class_weights.to(self.device),
        )
        logger.info("Applied class-weighted CE loss for distillation.")
        
    def train_epoch(self, train_loader: DataLoader) -> Dict:
        if not self.training_enabled:
            raise RuntimeError("Training not available - no teacher model loaded")
            
        self.student.train()
        total_loss, total_ce, total_kl = 0.0, 0.0, 0.0
        self.optimizer.zero_grad(set_to_none=True)
        autocast_ctx = torch.cuda.amp.autocast if self.use_mixed_precision else nullcontext
        
        for step_idx, batch in enumerate(train_loader, start=1):
            images, labels = batch
            images, labels = images.to(self.device), labels.to(self.device)

            with autocast_ctx():
                with torch.no_grad():
                    teacher_logits = self.teacher(images)

                student_logits = self.student(images)
                loss, ce, kl = self.criterion(student_logits, teacher_logits, labels)

            scaled_loss = loss / self.grad_accum_steps
            self.scaler.scale(scaled_loss).backward()

            should_step = (step_idx % self.grad_accum_steps == 0) or (step_idx == len(train_loader))
            if should_step:
                self.scaler.step(self.optimizer)
                self.scaler.update()
                self.optimizer.zero_grad(set_to_none=True)
            
            total_loss += loss.item()
            total_ce += ce.item()
            total_kl += kl.item()
            
        num_batches = len(train_loader)
        return {
            "loss": total_loss / num_batches,
            "ce_loss": total_ce / num_batches,
            "kl_loss": total_kl / num_batches
        }

    def validate(self, val_loader: DataLoader) -> Dict:
        self.student.eval()
        correct = 0
        total = 0
        val_loss = 0.0
        autocast_ctx = torch.cuda.amp.autocast if self.use_mixed_precision else nullcontext
        
        with torch.no_grad():
            for batch in val_loader:
                images, labels = batch
                images, labels = images.to(self.device), labels.to(self.device)

                with autocast_ctx():
                    logits = self.student(images)
                    loss = F.cross_entropy(logits, labels)
                val_loss += loss.item()
                
                _, predicted = torch.max(logits.data, 1)
                total += labels.size(0)
                correct += (predicted == labels).sum().item()
                
        return {
            "accuracy": correct / total,
            "loss": val_loss / len(val_loader)
        }

    def validate_detailed(self, val_loader: DataLoader) -> Dict:
        """
        Detailed validation metrics for diagnostics:
        - confusion matrix
        - per-class accuracy
        - macro average accuracy
        """
        self.student.eval()
        num_classes = self.num_classes
        confusion = torch.zeros((num_classes, num_classes), dtype=torch.int64)

        with torch.no_grad():
            for batch in val_loader:
                images, labels = batch
                images, labels = images.to(self.device), labels.to(self.device)
                logits = self.student(images)
                preds = torch.argmax(logits, dim=1)
                for true_label, pred_label in zip(labels.view(-1), preds.view(-1)):
                    confusion[int(true_label.item()), int(pred_label.item())] += 1

        per_class = []
        per_class_acc_values = []
        for idx in range(num_classes):
            total_true = int(confusion[idx].sum().item())
            correct = int(confusion[idx, idx].item())
            acc = (correct / total_true) if total_true > 0 else 0.0
            per_class_acc_values.append(acc)
            per_class.append({
                "class_id": idx,
                "total": total_true,
                "correct": correct,
                "accuracy": round(acc, 4),
            })

        macro_acc = sum(per_class_acc_values) / len(per_class_acc_values) if per_class_acc_values else 0.0
        return {
            "macro_accuracy": round(macro_acc, 4),
            "per_class": per_class,
            "confusion_matrix": confusion.tolist(),
        }

    def save_checkpoint(self, path: str, extra_metadata: Optional[Dict] = None):
        checkpoint = {
            'model_state_dict': self.student.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
        }
        if extra_metadata and isinstance(extra_metadata, dict):
            checkpoint.update(extra_metadata)

        output_path = Path(path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        torch.save(checkpoint, str(output_path))
