"""
auralis/src/services/image_processor.py
───────────────────────────────────────
Service for uploading images to Cloudinary and extracting text via Tesseract OCR.
"""

import base64
import io
import logging
import os

import cloudinary
import cloudinary.uploader
import pytesseract
from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
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
            resource_type="image",
        )

        # Generate an optimized URL (f_auto, q_auto)
        url = cloudinary.CloudinaryImage(response["public_id"]).build_url(
            format=response.get("format", "jpg"),
            fetch_format="auto",
            quality="auto",
            secure=True,
        )
        return url
    except Exception as e:
        logger.exception("Cloudinary upload failed for %s", filename)
        raise RuntimeError("Failed to upload image to Cloudinary") from e


def _extract_text_tesseract(image_bytes: bytes) -> str:
    """
    Extract text from an image using Tesseract OCR.
    """
    if len(image_bytes) > 8 * 1024 * 1024:
        raise RuntimeError("Image too large — max 8MB")

    try:
        image = Image.open(io.BytesIO(image_bytes))

        image.thumbnail((2000, 2000), Image.LANCZOS)

        # Ensure image is in a mode compatible with Tesseract
        if image.mode not in ("L", "RGB"):
            image = image.convert("RGB")

        text = pytesseract.image_to_string(image)
        return text.strip()
    except Exception as e:
        logger.exception("OCR extraction failed")
        raise RuntimeError("Failed to extract text from image") from e


def _extract_text_gemini(image_bytes: bytes) -> str:
    """
    Extract text from an image using Gemini (for production).
    """
    if len(image_bytes) > 8 * 1024 * 1024:
        raise RuntimeError("Image too large — max 8MB")

    try:
        image = Image.open(io.BytesIO(image_bytes))
        image_format = image.format or "JPEG"
        mime_type = f"image/{image_format.lower()}"

        image.thumbnail((2000, 2000), Image.LANCZOS)

        buffer = io.BytesIO()
        image.save(buffer, format=image_format)
        encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")

        message = HumanMessage(
            content=[
                {
                    "type": "text",
                    "text": "Transcribe all visible text in this image exactly as it appears. Return only the transcribed text, no commentary.",
                },
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime_type};base64,{encoded}"},
                },
            ]
        )

        llm = ChatGoogleGenerativeAI(
            model=os.environ.get("GEMINI_OCR_MODEL", "gemini-2.5-flash-lite"),
            google_api_key=os.getenv("GEMINI_API_KEY"),
        )
        response = llm.invoke([message])

        # handle different return types safely
        if hasattr(response, "content") and isinstance(response.content, str):
            return response.content.strip()
        return str(response).strip()
    except Exception as e:
        logger.exception("Gemini OCR extraction failed")
        raise RuntimeError("Failed to extract text from image") from e


def extract_text_from_image(image_bytes: bytes) -> str:
    """
    Extract text from an image. Uses Gemini in production, Tesseract locally.
    """
    if os.getenv("ENVIRONMENT", "development") == "production":
        return _extract_text_gemini(image_bytes)
    return _extract_text_tesseract(image_bytes)
