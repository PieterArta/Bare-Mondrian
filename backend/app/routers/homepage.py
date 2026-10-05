from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.middleware.auth_middleware import require_admin
from app.models.product import Product
from app.models.site_settings import SiteSetting
from app.schemas.product_schema import ProductResponse

router = APIRouter()

# ── Setting keys ────────────────────────────────────────────────────────────
_KEY_HERO       = "homepage.hero_image_url"
_KEY_COLLECTION = "homepage.collection_image_url"

_DEFAULT_HERO       = "/hero_model.png"
_DEFAULT_COLLECTION = "/about-story.png"


def _get_setting(db: Session, key: str, default: Optional[str] = None) -> Optional[str]:
    row = db.query(SiteSetting).filter(SiteSetting.key == key).first()
    return row.value if row is not None else default


def _set_setting(db: Session, key: str, value: Optional[str]) -> None:
    row = db.query(SiteSetting).filter(SiteSetting.key == key).first()
    if row is None:
        row = SiteSetting(key=key, value=value)
        db.add(row)
    else:
        row.value = value
    db.commit()


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
            Product.featured_order.is_(None),
            Product.featured_order.asc(),
            Product.id.asc(),
        )
        .all()
    )


class HomepageSettingsUpdate(BaseModel):
    hero_image_url: Optional[str] = None
    collection_image_url: Optional[str] = None


# ---------------------------------------------------------------------------
# GET /api/homepage/settings
# ---------------------------------------------------------------------------
@router.get("/settings", summary="Get current homepage settings")
def get_homepage_settings(db: Session = Depends(get_db)):
    return {
        "hero_image_url":       _get_setting(db, _KEY_HERO,       _DEFAULT_HERO),
        "collection_image_url": _get_setting(db, _KEY_COLLECTION, _DEFAULT_COLLECTION),
    }


# ---------------------------------------------------------------------------
# PUT /api/homepage/settings  — admin only
# ---------------------------------------------------------------------------
@router.put("/settings", summary="Update homepage settings (admin only)")
def update_homepage_settings(
    payload: HomepageSettingsUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    if payload.hero_image_url is not None:
        _set_setting(db, _KEY_HERO, payload.hero_image_url)
    if payload.collection_image_url is not None:
        _set_setting(db, _KEY_COLLECTION, payload.collection_image_url)

    return {
        "hero_image_url":       _get_setting(db, _KEY_HERO,       _DEFAULT_HERO),
        "collection_image_url": _get_setting(db, _KEY_COLLECTION, _DEFAULT_COLLECTION),
    }
