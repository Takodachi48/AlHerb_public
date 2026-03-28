import torch
import torch.nn.functional as F
from typing import Dict, List, Optional
import time
import os
import uuid
import json
import logging
from app.ml.models import load_student
from app.ml.preprocessing import preprocess_image
from app.ml.uncertainty import compute_uncertainty
from app.core.config import settings

logger = logging.getLogger(__name__)

class InferenceService:
    """
    Runtime classification service using MobileNetV3 student
    """
    
    def __init__(self, model_path: Optional[str] = None, device: str = "cpu"):
        self.device = torch.device(device)
        self.num_classes = settings.NUM_CLASSES

        if os.path.exists(settings.ACTIVE_MODEL_PATH):
            logger.info("Active model checkpoint found at %s", settings.ACTIVE_MODEL_PATH)
        else:
            logger.warning("Active model checkpoint not found at %s", settings.ACTIVE_MODEL_PATH)
        
        # Determine model path
        actual_model_path = model_path or settings.STUDENT_PATH
        self.model_path = actual_model_path
        model_role = "active" if actual_model_path == settings.ACTIVE_MODEL_PATH else "student"
            
        # Load inference model
        self.model = load_student(actual_model_path, self.num_classes, device, model_role=model_role)
        self.model.eval()
        
        # Load Herb ID mapping from external source
        self.idx_to_herb = self._load_herb_mapping(self.model_path)
        
        # Warm up
        self._warmup()
    
    def _warmup(self):
        """Warm up model"""
        dummy = torch.randn(1, 3, settings.IMAGE_SIZE, settings.IMAGE_SIZE).to(self.device)
        with torch.no_grad():
            _ = self.model(dummy)
    
    @torch.no_grad()
    def predict(self, image_bytes: bytes, top_k: int = 5, temperature: float = None) -> Dict:
        """
        Classify herb image bytes
        """
        # Use configured temperature if not provided
        if temperature is None:
            temperature = settings.INFERENCE_TEMPERATURE
            
        start_time = time.time()
        
        # Preprocess
        image_tensor = preprocess_image(image_bytes, settings.IMAGE_SIZE)
        image_tensor = image_tensor.unsqueeze(0).to(self.device)
        
        # Forward pass
        logits = self.model(image_tensor)
        
        # Apply temperature scaling to reduce overconfidence
        scaled_logits = logits / temperature
        probabilities = torch.softmax(scaled_logits, dim=1)[0]
        
        # Ensure top_k doesn't exceed number of classes
        actual_top_k = min(top_k, self.num_classes)
        
        # Get top-k
        top_probs, top_indices = torch.topk(probabilities, actual_top_k)
        uncertainty = compute_uncertainty(
            probabilities=probabilities,
            low_confidence_threshold=settings.INFERENCE_UNCERTAINTY_LOW_CONFIDENCE_THRESHOLD,
            margin_threshold=settings.INFERENCE_UNCERTAINTY_MARGIN_THRESHOLD,
            use_entropy=settings.INFERENCE_UNCERTAINTY_USE_ENTROPY,
            entropy_threshold=settings.INFERENCE_UNCERTAINTY_ENTROPY_THRESHOLD,
        )
        
        inference_time = (time.time() - start_time) * 1000
        
        # Format results
        top_k_results = []
        for prob, idx in zip(top_probs, top_indices):
            herb_id = idx.item()
            # Handle string keys from JSON
            herb_info = self.idx_to_herb.get(str(herb_id), 
                           self.idx_to_herb.get(herb_id, 
                               {"herb_name": "Unknown", "scientific_name": "Unknown"}))
            
            prediction = {
                'herb_id': herb_id,
                'herb_name': herb_info['herb_name'],
                'scientific_name': herb_info['scientific_name'],
                'confidence': round(prob.item(), 4)
            }
            top_k_results.append(prediction)
        
        return {
            'prediction_id': str(uuid.uuid4()),
            'herb_id': top_k_results[0]['herb_id'],
            'herb_name': top_k_results[0]['herb_name'],
            'scientific_name': top_k_results[0]['scientific_name'],
            'confidence': top_k_results[0]['confidence'],
            'top_k': top_k_results,
            'uncertainty': uncertainty,
            'inference_time_ms': round(inference_time, 2)
        }
    
    def _load_checkpoint_mapping(self, model_path: str) -> Dict:
        try:
            if not os.path.exists(model_path):
                return {}
            checkpoint = torch.load(model_path, map_location="cpu")
            if not isinstance(checkpoint, dict):
                return {}

            class_mapping = checkpoint.get("class_mapping")
            if isinstance(class_mapping, dict) and class_mapping:
                normalized = {}
                for key, value in class_mapping.items():
                    if not isinstance(value, dict):
                        continue
                    normalized[str(key)] = {
                        "herb_name": str(value.get("herb_name", "Unknown")),
                        "scientific_name": str(value.get("scientific_name", "Unknown")),
                    }
                if normalized:
                    logger.info("Loaded class mapping from checkpoint metadata (%s)", model_path)
                    return normalized
            return {}
        except Exception as e:
            logger.warning("Could not load class mapping from checkpoint %s: %s", model_path, e)
            return {}

    def _load_herb_mapping(self, model_path: str) -> Dict:
        """Load Herb Classes Mapping from JSON file"""
        try:
            checkpoint_mapping = self._load_checkpoint_mapping(model_path)
            if checkpoint_mapping:
                return checkpoint_mapping

            if os.path.exists(settings.LABELS_PATH):
                with open(settings.LABELS_PATH, 'r') as f:
                    return json.load(f)
            else:
                # Fallback to empty mapping if file not found
                logger.warning("Label file not found at %s", settings.LABELS_PATH)
                return {}
        except Exception as e:
            logger.error("Error loading labels: %s", e)
            return {}
