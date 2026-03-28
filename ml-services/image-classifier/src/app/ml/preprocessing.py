import torch
from torchvision import transforms
from PIL import Image
import io

def get_transforms(image_size: int = 224):
    """Standard transformations for ImageNet models"""
    return transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        )
    ])

def preprocess_image(image_bytes: bytes, image_size: int = 224) -> torch.Tensor:
    """Convert bytes to preprocessed tensor"""
    image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    transform = get_transforms(image_size)
    return transform(image)
