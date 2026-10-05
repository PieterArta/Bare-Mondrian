"""
migrate_settings_to_db.py
─────────────────────────
One-time migration: reads the existing homepage_settings.json and
about_us_settings.json files (if they exist) and upserts their values
into the new `site_settings` database table.

Run once after deploying the DB migration:
    cd backend
    python migrate_settings_to_db.py
"""

import json
import sys
from pathlib import Path

# Make sure the app package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.core.database import SessionLocal, engine, Base
from app.models.site_settings import SiteSetting  # noqa: F401 — registers table

# ── Ensure the table exists ─────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

_DATA_DIR = Path(__file__).resolve().parent / "data"


def upsert(db, key: str, value):
    if value is None:
        return
    row = db.query(SiteSetting).filter(SiteSetting.key == key).first()
    if row is None:
        db.add(SiteSetting(key=key, value=value))
        print(f"  INSERT  {key} = {value!r}")
    else:
        if row.value != value:
            row.value = value
            print(f"  UPDATE  {key} = {value!r}")
        else:
            print(f"  SKIP    {key} (unchanged)")


def main():
    db = SessionLocal()
    try:
        # ── Homepage settings ────────────────────────────────────────────────
        hp_file = _DATA_DIR / "homepage_settings.json"
        if hp_file.exists():
            print(f"\nReading {hp_file}")
            with open(hp_file, "r", encoding="utf-8") as f:
                hp = json.load(f)
            upsert(db, "homepage.hero_image_url",       hp.get("hero_image_url"))
            upsert(db, "homepage.collection_image_url", hp.get("collection_image_url"))
        else:
            print(f"\nNo file found: {hp_file} — skipping homepage settings.")

        # ── About Us settings ────────────────────────────────────────────────
        au_file = _DATA_DIR / "about_us_settings.json"
        if au_file.exists():
            print(f"\nReading {au_file}")
            with open(au_file, "r", encoding="utf-8") as f:
                au = json.load(f)
            upsert(db, "about.paragraph_1", au.get("paragraph_1"))
            upsert(db, "about.paragraph_2", au.get("paragraph_2"))
            upsert(db, "about.image_url",   au.get("image_url"))
        else:
            print(f"\nNo file found: {au_file} — skipping about us settings.")

        db.commit()
        print("\nDone. Migration complete.")

    except Exception as exc:
        db.rollback()
        print(f"\nERROR: Migration failed: {exc}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
