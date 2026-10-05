from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.middleware.auth_middleware import require_admin
from app.models.site_settings import SiteSetting

router = APIRouter()

# ── Setting keys ────────────────────────────────────────────────────────────
_KEY_P1        = "about.paragraph_1"
_KEY_P2        = "about.paragraph_2"
_KEY_IMAGE_URL = "about.image_url"

_DEFAULT_P1 = (
    "Bare Mondrian is a minimalist lifestyle brand that represents balance between "
    "form and simplicity. Bare Mondrian serves as a reminder to strip away the "
    "unnecessary and return to what truly matters in everyday living."
)
_DEFAULT_P2 = (
    "By embracing clean lines and quiet confidence, Bare Mondrian encourages you to "
    "explore the beauty of essentials, inviting you to see clarity not as emptiness, "
    "but as space for what\u2019s meaningful to grow."
)


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


class AboutUsUpdate(BaseModel):
    paragraph_1: str
    paragraph_2: str
    image_url: Optional[str] = None


@router.get("", summary="Get About Us page content")
@router.get("/", summary="Get About Us page content")
def get_about_us(db: Session = Depends(get_db)):
    return {
        "paragraph_1": _get_setting(db, _KEY_P1, _DEFAULT_P1),
        "paragraph_2": _get_setting(db, _KEY_P2, _DEFAULT_P2),
        "image_url":   _get_setting(db, _KEY_IMAGE_URL, None),
    }


@router.put("", summary="Update About Us page content (admin only)")
@router.put("/", summary="Update About Us page content (admin only)")
def update_about_us(
    body: AboutUsUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    _set_setting(db, _KEY_P1, body.paragraph_1.strip())
    _set_setting(db, _KEY_P2, body.paragraph_2.strip())
    _set_setting(
        db, _KEY_IMAGE_URL,
        body.image_url.strip() if body.image_url and body.image_url.strip() else None
    )

    return {
        "paragraph_1": _get_setting(db, _KEY_P1),
        "paragraph_2": _get_setting(db, _KEY_P2),
        "image_url":   _get_setting(db, _KEY_IMAGE_URL),
    }
