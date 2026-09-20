import os
import uuid
import shutil
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

# ── Configuration ────────────────────────────────────────────────────────────
# Files are saved under  backend/uploads/<sub_folder>/  and served via a
# static route that must be mounted in main.py if you want direct URL access.
_UPLOAD_ROOT = Path(__file__).resolve().parent.parent.parent / "uploads"
_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def save_upload(file: UploadFile, sub_folder: str = "general") -> str:
    """
    Validate and persist an uploaded file.

    Parameters
    ----------
    file       : FastAPI UploadFile object from the request.
    sub_folder : Subdirectory inside the uploads root (e.g. "payment_proofs").

    Returns
    -------
    str
        Relative URL path that can be stored in the database and served to the
        client, e.g.  ``/uploads/payment_proofs/<uuid>.<ext>``
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

    # ── Determine extension ──────────────────────────────────────────────────
    original_ext = Path(file.filename or "file").suffix.lower()
    # Fallback to content-type-based extension if filename has none
    _ct_ext_map = {
        "image/jpeg": ".jpg",
        "image/png":  ".png",
        "image/webp": ".webp",
        "image/gif":  ".gif",
    }
    ext = original_ext if original_ext in {".jpg", ".jpeg", ".png", ".webp", ".gif"} else _ct_ext_map[file.content_type]

    # ── Build unique filename and ensure directory exists ────────────────────
    unique_name = f"{uuid.uuid4().hex}{ext}"
    dest_dir = _UPLOAD_ROOT / sub_folder
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / unique_name

    # ── Write file to disk ───────────────────────────────────────────────────
    with open(dest_path, "wb") as f:
        f.write(file_bytes)

    # Return relative URL path
    return f"/uploads/{sub_folder}/{unique_name}"
