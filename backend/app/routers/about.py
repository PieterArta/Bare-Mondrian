import json
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.middleware.auth_middleware import require_admin
from app.services.upload_service import _UPLOAD_ROOT

router = APIRouter()

_ABOUT_SETTINGS_FILE = _UPLOAD_ROOT / "about_us_settings.json"

DEFAULT_ABOUT_CONTENT = {
    "paragraph_1": "Bare Mondrian is a minimalist lifestyle brand that represents balance between form and simplicity. Bare Mondrian serves as a reminder to strip away the unnecessary and return to what truly matters in everyday living.",
    "paragraph_2": "By embracing clean lines and quiet confidence, Bare Mondrian encourages you to explore the beauty of essentials, inviting you to see clarity not as emptiness, but as space for what's meaningful to grow."
}


class AboutUsUpdate(BaseModel):
    paragraph_1: str
    paragraph_2: str


def _load_about_settings() -> dict:
    if _ABOUT_SETTINGS_FILE.exists():
        try:
            with open(_ABOUT_SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return {
                    "paragraph_1": data.get("paragraph_1", DEFAULT_ABOUT_CONTENT["paragraph_1"]),
                    "paragraph_2": data.get("paragraph_2", DEFAULT_ABOUT_CONTENT["paragraph_2"])
                }
        except Exception:
            pass
    return DEFAULT_ABOUT_CONTENT.copy()


def _save_about_settings(data: dict):
    _UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    with open(_ABOUT_SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


@router.get("", summary="Get About Us page content")
@router.get("/", summary="Get About Us page content")
def get_about_us():
    return _load_about_settings()


@router.put("", summary="Update About Us page content (admin only)")
@router.put("/", summary="Update About Us page content (admin only)")
def update_about_us(body: AboutUsUpdate, _admin=Depends(require_admin)):
    data = {
        "paragraph_1": body.paragraph_1.strip(),
        "paragraph_2": body.paragraph_2.strip()
    }
    _save_about_settings(data)
    return data
