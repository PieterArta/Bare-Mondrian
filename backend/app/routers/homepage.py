import json
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.middleware.auth_middleware import require_admin
from app.models.product import Product
from app.schemas.product_schema import ProductResponse
from app.services.upload_service import save_upload

router = APIRouter()

_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
_SETTINGS_FILE = _DATA_DIR / "homepage_settings.json"


def _load_settings() -> dict:
    if _SETTINGS_FILE.exists():
        try:
            with open(_SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"hero_image_url": "/hero_model.png"}


def _save_settings(data: dict):
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
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


from pydantic import BaseModel
from typing import Optional

class HomepageSettingsUpdate(BaseModel):
    hero_image_url: Optional[str] = None
    collection_image_url: Optional[str] = None

# ---------------------------------------------------------------------------
# GET /api/homepage/settings
# ---------------------------------------------------------------------------
@router.get(
    "/settings",
    summary="Get current homepage settings",
)
def get_homepage_settings():
    settings = _load_settings()
    return {
        "hero_image_url": settings.get("hero_image_url", "/hero_model.png"),
        "collection_image_url": settings.get("collection_image_url", "/about-story.png")
    }


# ---------------------------------------------------------------------------
# PUT /api/homepage/settings  — admin only
# ---------------------------------------------------------------------------
@router.put(
    "/settings",
    summary="Update homepage settings (admin only)",
)
def update_homepage_settings(
    payload: HomepageSettingsUpdate,
    _admin=Depends(require_admin),
):
    settings = _load_settings()
    if payload.hero_image_url is not None:
        settings["hero_image_url"] = payload.hero_image_url
    if payload.collection_image_url is not None:
        settings["collection_image_url"] = payload.collection_image_url
    
    _save_settings(settings)
    return settings

