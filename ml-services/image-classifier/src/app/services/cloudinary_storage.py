import cloudinary
import cloudinary.uploader
import cloudinary.api
import requests
import io
from PIL import Image
from app.core.config import settings
import uuid

# Configure Cloudinary
if settings.CLOUDINARY_CLOUD_NAME:
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True
    )

class CloudinaryStorage:
    """Service for Cloudinary integration"""
    
    @staticmethod
    def download_image(image_url: str) -> bytes:
        """Download image from URL and return bytes"""
        response = requests.get(image_url, timeout=10)
        response.raise_for_status()
        return response.content

    @staticmethod
    def upload_prediction(image_bytes: bytes, prediction_id: str = None) -> dict:
        """Upload classified image to Cloudinary for record keeping"""
        if not prediction_id:
            prediction_id = str(uuid.uuid4())
            
        # Upload to a 'predictions' folder
        result = cloudinary.uploader.upload(
            image_bytes,
            folder="herb_ml/predictions",
            public_id=prediction_id,
            overwrite=True,
            resource_type="image"
        )
        return {
            "url": result.get("secure_url"),
            "public_id": result.get("public_id")
        }

    @staticmethod
    def get_image_from_url(image_url: str) -> Image.Image:
        """Fetch image and return PIL Image object"""
        image_bytes = CloudinaryStorage.download_image(image_url)
        return Image.open(io.BytesIO(image_bytes)).convert('RGB')
