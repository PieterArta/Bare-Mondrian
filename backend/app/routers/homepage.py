import json
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.middleware.auth_middleware import require_admin
from app.models.product import Product
from app.schemas.product_schema import ProductResponse
from app.services.upload_service import save_upload, _UPLOAD_ROOT

router = APIRouter()

_SETTINGS_FILE = _UPLOAD_ROOT / "homepage_settings.json"


def _load_settings() -> dict:
    if _SETTINGS_FILE.exists():
        try:
            with open(_SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"hero_image_url": "/hero_model.png"}


def _save_settings(data: dict):
    _UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    with open(_SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


# ---------------------------------------------------------------------------
# GET /api/homepage/  — legacy health-check
# ---------------------------------------------------------------------------
@router.get("/", summary="Homepage status check")
def get_homepage():
    return {"message": "Homepage endpoint is active"}


# ---------------------------------------------------------------------------
# GET /api/homepage/featured-products
# ---------------------------------------------------------------------------
@router.get(
    "/featured-products",
    response_model=List[ProductResponse],
    summary="Get all featured products",
    description=(
        "Returns all products where is_featured=True, "
        "ordered by featured_order (nulls last) then by id."
    ),
)
def get_featured_products(db: Session = Depends(get_db)):
    return (
        db.query(Product)
        .filter(Product.is_featured == True)  # noqa: E712
        .order_by(
            Product.featured_order.is_(None),  # NULLs come after explicit order values
            Product.featured_order.asc(),
            Product.id.asc(),
        )
        .all()
    )


# ---------------------------------------------------------------------------
# GET /api/homepage/hero-image
# ---------------------------------------------------------------------------
@router.get(
    "/hero-image",
    summary="Get current hero image URL",
)
def get_hero_image():
    settings = _load_settings()
    return {"hero_image_url": settings.get("hero_image_url", "/hero_model.png")}


# ---------------------------------------------------------------------------
# POST /api/homepage/hero-image  — admin only
# ---------------------------------------------------------------------------
@router.post(
    "/hero-image",
    summary="Upload new hero image (admin only)",
)
def update_hero_image(
    file: UploadFile = File(...),
    _admin=Depends(require_admin),
):
    url = save_upload(file, sub_folder="hero")
    settings = _load_settings()
    settings["hero_image_url"] = url
    _save_settings(settings)
    return {"hero_image_url": url}
