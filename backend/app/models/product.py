from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, DateTime, Float, Integer,
    String, Text
)
from sqlalchemy.types import JSON

from app.core.database import Base


def _utcnow():
    """Returns the current UTC time (timezone-aware)."""
    return datetime.now(timezone.utc)


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False)
    stock = Column(Integer, default=0, nullable=False)

    # Stored as JSON array, e.g. ["S", "M", "L", "XL"]
    sizes = Column(JSON, nullable=True, default=list)
    # Stored as JSON array, e.g. ["Black", "White", "Navy"]
    colors = Column(JSON, nullable=True, default=list)

    image_url = Column(String(512), nullable=True)
    category = Column(String(255), index=True, nullable=True)

    # ── Featured ─────────────────────────────────────────────────────────────
    is_featured = Column(Boolean, default=False, nullable=False)
    # Lower number = appears first in the featured list (NULL = unordered)
    featured_order = Column(Integer, nullable=True, index=True)

    # ── Product detail page fields ────────────────────────────────────────────
    # Free-text blocks for the detail page
    composition = Column(Text, nullable=True)
    care_instructions = Column(Text, nullable=True)
    shipping_info  = Column(Text, nullable=True)

    # Sizing chart stored as JSON, e.g.:
    # {
    #   "S/M":  {"Bust": "84–92", "Shoulder Width": "38", "Armhole": "19",
    #             "Length": "62", "Sleeve Length": "58", "Sleeve Width": "14"},
    #   "L/XL": {"Bust": "96–104", ...}
    # }
    sizing_chart = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self):
        return f"<Product id={self.id} title={self.title!r} price={self.price}>"
