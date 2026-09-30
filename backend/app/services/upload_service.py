import os
import uuid
import cloudinary
import cloudinary.uploader
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from app.core.config import settings

# ── Configuration ────────────────────────────────────────────────────────────
_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB

# Initialize Cloudinary
cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True
)


def save_upload(file: UploadFile, sub_folder: str = "general") -> str:
    """
    Validate and upload a file to Cloudinary.

    Parameters
    ----------
    file       : FastAPI UploadFile object from the request.
    sub_folder : Subdirectory inside the cloudinary root (e.g. "products").

    Returns
    -------
    str
        Secure URL of the uploaded image on Cloudinary.
    """
    # ── Content-type validation ──────────────────────────────────────────────
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Unsupported file type '{file.content_type}'. "
                f"Allowed: {', '.join(sorted(_ALLOWED_CONTENT_TYPES))}"
            ),
        )

    # ── Read file bytes and check size ───────────────────────────────────────
    file_bytes = file.file.read()
    if len(file_bytes) > _MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the maximum allowed size of {_MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB.",
        )

    # ── Upload to Cloudinary ─────────────────────────────────────────────────
    try:
        response = cloudinary.uploader.upload(
            file_bytes,
            folder=f"bare_mondrian/{sub_folder}",
            resource_type="image"
        )
        return response.get("secure_url")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload image to Cloudinary: {str(e)}"
        )
