from torch.utils.data import Dataset, DataLoader, random_split
from app.services.cloudinary_storage import CloudinaryStorage
from app.ml.preprocessing import get_transforms
from app.core.config import settings
from app.services import internal_api
import torch
from collections import defaultdict
import logging
from math import ceil
import io
import hashlib
import json
import random
from pathlib import Path
from typing import List, Tuple, Dict, Any

logger = logging.getLogger(__name__)

class HerbDataset(Dataset):
    """Custom dataset for loading images from Cloudinary URLs"""
    def __init__(self, data: List[Tuple[str, int]], transform=None):
        self.data = data # (url, label)
        self.transform = transform or get_transforms(settings.IMAGE_SIZE)
        self.cache_dir = Path(settings.TRAIN_IMAGE_CACHE_DIR)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._enforce_cache_limit()

    def _cache_file(self, url: str) -> Path:
        digest = hashlib.sha1(url.encode("utf-8")).hexdigest()
        return self.cache_dir / f"{digest}.img"

    def _load_image_bytes(self, url: str) -> bytes:
        cache_file = self._cache_file(url)
        if cache_file.exists():
            return cache_file.read_bytes()

        image_bytes = CloudinaryStorage.download_image(url)
        try:
            cache_file.write_bytes(image_bytes)
        except Exception:
            logger.warning("Failed to write image cache file: %s", cache_file)
        return image_bytes

    def _enforce_cache_limit(self) -> None:
        max_files = max(100, int(settings.TRAIN_IMAGE_CACHE_MAX_FILES))
        files = sorted(
            self.cache_dir.glob("*.img"),
            key=lambda p: p.stat().st_mtime,
        )
        overflow = len(files) - max_files
        if overflow <= 0:
            return
        for path in files[:overflow]:
            try:
                path.unlink(missing_ok=True)
            except Exception:
                logger.warning("Failed to prune cache file: %s", path)

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        url, label = self.data[idx]
        try:
            image_bytes = self._load_image_bytes(url)
            from PIL import Image
            image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
            if self.transform:
                image = self.transform(image)
            return image, torch.tensor(label, dtype=torch.long)
        except Exception as e:
            logger.warning("Failed to load training image %s: %s", url, e)
            return torch.zeros(3, settings.IMAGE_SIZE, settings.IMAGE_SIZE), torch.tensor(label, dtype=torch.long)

class DataBuffer:
    """Manages 80/20 data split for continuous learning using internal API"""
    def __init__(self):
        pass
    
    @staticmethod
    def _required_class_ids() -> List[int]:
        return list(range(settings.NUM_CLASSES))

    @staticmethod
    def _group_by_class(items: List[Dict[str, Any]]) -> Dict[int, List[Dict[str, Any]]]:
        grouped: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
        for item in items:
            herb_id = item.get("herb_id")
            if herb_id is None:
                continue
            try:
                class_id = int(herb_id)
            except (TypeError, ValueError):
                continue
            grouped[class_id].append(item)
        return grouped

    @staticmethod
    def _class_counts(items: List[Dict[str, Any]]) -> Dict[int, int]:
        grouped = DataBuffer._group_by_class(items)
        return {class_id: len(records) for class_id, records in grouped.items()}

    @staticmethod
    def _balanced_take(
        items: List[Dict[str, Any]],
        required_class_ids: List[int],
        per_class_limit: int | None = None,
    ) -> List[Dict[str, Any]]:
        grouped = DataBuffer._group_by_class(items)
        if not grouped:
            return []

        if per_class_limit is None:
            per_class_limit = min(len(grouped.get(class_id, [])) for class_id in required_class_ids)
        if per_class_limit <= 0:
            return []

        selected: List[Dict[str, Any]] = []
        for class_id in required_class_ids:
            class_items = grouped.get(class_id, [])
            selected.extend(class_items[:per_class_limit])
        return selected

    @staticmethod
    def _resolve_batch_size(override_batch_size: int | None = None) -> int:
        if override_batch_size and override_batch_size > 0:
            return override_batch_size
        if settings.TRAIN_BATCH_SIZE > 0:
            return settings.TRAIN_BATCH_SIZE

        is_cuda = torch.cuda.is_available()
        if settings.NUM_CLASSES >= 20:
            return settings.TRAIN_BATCH_SIZE_CUDA_40_CLASS if is_cuda else settings.TRAIN_BATCH_SIZE_CPU_40_CLASS
        return settings.TRAIN_BATCH_SIZE_CUDA_10_CLASS if is_cuda else settings.TRAIN_BATCH_SIZE_CPU_10_CLASS

    @staticmethod
    def _load_label_mapping_from_file() -> Dict[str, Dict[str, str]]:
        try:
            labels_path = Path(settings.LABELS_PATH)
            if not labels_path.exists():
                return {}
            raw = json.loads(labels_path.read_text(encoding="utf-8"))
            if not isinstance(raw, dict):
                return {}
            normalized: Dict[str, Dict[str, str]] = {}
            for key, value in raw.items():
                if not isinstance(value, dict):
                    continue
                normalized[str(key)] = {
                    "herb_name": str(value.get("herb_name", "Unknown")),
                    "scientific_name": str(value.get("scientific_name", "Unknown")),
                }
            return normalized
        except Exception:
            logger.warning("Failed to read labels mapping from %s", settings.LABELS_PATH)
            return {}

    @staticmethod
    def _build_class_mapping(items: List[Dict[str, Any]], required_class_ids: List[int]) -> Dict[str, Dict[str, str]]:
        mapping: Dict[str, Dict[str, str]] = {}
        for item in items:
            try:
                class_id = int(item.get("herb_id"))
            except (TypeError, ValueError):
                continue
            key = str(class_id)
            if key in mapping:
                continue
            mapping[key] = {
                "herb_name": str(item.get("herb_name") or "Unknown"),
                "scientific_name": str(item.get("scientific_name") or "Unknown"),
            }

        # Fill any missing classes using labels file snapshot.
        file_mapping = DataBuffer._load_label_mapping_from_file()
        for class_id in required_class_ids:
            key = str(class_id)
            if key not in mapping:
                mapping[key] = file_mapping.get(
                    key,
                    {"herb_name": "Unknown", "scientific_name": "Unknown"},
                )
        return mapping

    def prepare_loaders(self, batch_size: int = 0) -> Tuple[DataLoader, DataLoader, Dict]:
        resolved_batch_size = self._resolve_batch_size(batch_size if batch_size > 0 else None)
        required_class_ids = self._required_class_ids()

        # 1. Fetch new data
        new_data = internal_api.fetch_training_data(is_new=True, limit=50000)
        
        # 2. Fetch old data
        old_data = internal_api.fetch_training_data(is_new=False, limit=50000)
        
        if not new_data and not old_data:
            return None, None, {}

        new_counts = self._class_counts(new_data)
        old_counts = self._class_counts(old_data)
        logger.info("Training pool class counts (new): %s", new_counts)
        logger.info("Training pool class counts (old): %s", old_counts)

        # Build balanced new-data batch with a fixed per-training cap.
        target_new_total = max(settings.MIN_NEW_SAMPLES, settings.MAX_NEW_SAMPLES_PER_TRAINING)
        target_new_per_class = max(1, ceil(target_new_total / len(required_class_ids)))
        balanced_new = self._balanced_take(new_data, required_class_ids, per_class_limit=target_new_per_class)
        if not balanced_new:
            logger.warning("Insufficient class coverage in new data; cannot build balanced training batch.")
            return None, None, {}

        # Match configured old/new ratio while keeping old data class-balanced.
        ratio_new = max(settings.TRAIN_NEW_DATA_RATIO, 0.0)
        ratio_old = max(settings.TRAIN_OLD_DATA_RATIO, 0.0)

        balanced_old: List[Dict[str, Any]] = []
        if ratio_new > 0 and ratio_old > 0 and old_data:
            target_old_total = int(len(balanced_new) * (ratio_old / ratio_new))
            target_old_per_class = max(1, ceil(target_old_total / len(required_class_ids)))
            balanced_old = self._balanced_take(old_data, required_class_ids, per_class_limit=target_old_per_class)

        if not balanced_old and old_data and settings.TRAIN_OLD_DATA_RATIO > 0:
            logger.warning("Could not satisfy balanced old-data ratio; proceeding with balanced new data only.")

        selected_items = balanced_new + balanced_old

        # Combine and format
        combined = []
        sample_ids = []
        for d in selected_items:
            combined.append((d["image_url"], d["herb_id"]))
            if d.get("id"):
                sample_ids.append(d["id"])

        dataset = HerbDataset(combined)
        
        # Stratified split into train/val so every class is represented when possible.
        if len(dataset) < 2:
             return None, None, {}

        indices_by_class: Dict[int, List[int]] = defaultdict(list)
        for idx, (_, label) in enumerate(combined):
            indices_by_class[int(label)].append(idx)

        val_indices: List[int] = []
        train_indices: List[int] = []
        rng = random.Random(42)
        for class_id, class_indices in indices_by_class.items():
            rng.shuffle(class_indices)
            if len(class_indices) < 2:
                train_indices.extend(class_indices)
                continue
            per_class_val = max(1, int(len(class_indices) * 0.1))
            val_indices.extend(class_indices[:per_class_val])
            train_indices.extend(class_indices[per_class_val:])

        if not val_indices or not train_indices:
            val_size = max(1, int(len(dataset) * 0.1))
            train_size = len(dataset) - val_size
            train_ds, val_ds = random_split(dataset, [train_size, val_size])
        else:
            from torch.utils.data import Subset
            train_ds = Subset(dataset, train_indices)
            val_ds = Subset(dataset, val_indices)

        train_size = len(train_ds)
        val_size = len(val_ds)
        
        train_loader = DataLoader(train_ds, batch_size=resolved_batch_size, shuffle=True)
        val_loader = DataLoader(val_ds, batch_size=resolved_batch_size)

        selected_counts = self._class_counts(selected_items)
        class_mapping = self._build_class_mapping(selected_items, required_class_ids)
        logger.info(
            "Prepared balanced training dataset: total=%s train=%s val=%s class_counts=%s "
            "(target_new_total=%s target_new_per_class=%s)",
            len(dataset),
            train_size,
            val_size,
            selected_counts,
            target_new_total,
            target_new_per_class,
        )
        
        return train_loader, val_loader, {
            "sample_ids": sample_ids,
            "class_counts": selected_counts,
            "class_mapping": class_mapping,
            "batch_size": resolved_batch_size,
        }

    def mark_data_as_used(self, sample_ids: List):
        """Mark new samples as old and update timestamps"""
        if not sample_ids:
            return
        internal_api.mark_training_data_as_used(sample_ids)
