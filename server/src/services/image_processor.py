"""
auralis/src/services/image_processor.py
───────────────────────────────────────
Service for uploading images to Cloudinary and extracting text via Tesseract OCR.
"""

import io
import logging
import os

import cloudinary
import cloudinary.uploader
import pytesseract
from PIL import Image

logger = logging.getLogger("auralis.image_processor")

def init_cloudinary() -> None:
    """Initialize Cloudinary configuration from environment variables."""
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
        api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    )

def upload_image_to_cloudinary(image_bytes: bytes, filename: str) -> str:
    """
    Upload an image to Cloudinary and return the optimized secure URL.
    """
    init_cloudinary()
    try:
        # We can extract the name without extension for the public_id
        base_name = os.path.splitext(filename)[0]
        
        # Upload the image
        response = cloudinary.uploader.upload(
            image_bytes,
            folder="auralis_kb_images",
            public_id=base_name,
            resource_type="image"
        )
        
        # Generate an optimized URL (f_auto, q_auto)
        url = cloudinary.CloudinaryImage(response["public_id"]).build_url(
            format=response.get("format", "jpg"),
            fetch_format="auto",
            quality="auto",
            secure=True
        )
        return url
    except Exception as e:
        logger.exception("Cloudinary upload failed for %s", filename)
        raise RuntimeError("Failed to upload image to Cloudinary") from e

def extract_text_from_image(image_bytes: bytes) -> str:
    """
    Extract text from an image using Tesseract OCR.
    """
    try:
        image = Image.open(io.BytesIO(image_bytes))
        
        # Ensure image is in a mode compatible with Tesseract
        if image.mode not in ("L", "RGB"):
            image = image.convert("RGB")
            
        text = pytesseract.image_to_string(image)
        return text.strip()
    except Exception as e:
        logger.exception("OCR extraction failed")
        raise RuntimeError("Failed to extract text from image") from e
