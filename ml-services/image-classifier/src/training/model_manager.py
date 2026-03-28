import os
import shutil
import torch
from app.core.config import settings

class ModelManager:
    """
    Handles atomic model swapping and version management
    """
    
    @staticmethod
    def deploy_new_model(checkpoint_path: str, version: str):
        """
        Swaps the active model with a new one atomically
        """
        temp_path = f"{settings.ACTIVE_MODEL_PATH}.tmp"
        
        # Copy to temp
        shutil.copy2(checkpoint_path, temp_path)
        
        # Rename (atomic on Unix)
        os.replace(temp_path, settings.ACTIVE_MODEL_PATH)
        
        # Archive if needed
        archive_dir = os.path.dirname(settings.STUDENT_PATH)
        archive_path = os.path.join(archive_dir, f"model_{version}.pth")
        shutil.copy2(settings.ACTIVE_MODEL_PATH, archive_path)
        
        return archive_path

    @staticmethod
    def get_current_version() -> str:
        """Get info about the active model"""
        if os.path.exists(settings.ACTIVE_MODEL_PATH):
            # This could be more sophisticated, e.g. reading from a manifest
            file_info = os.stat(settings.ACTIVE_MODEL_PATH)
            return f"v_{int(file_info.st_mtime)}"
        return "initial"
