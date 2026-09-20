from datetime import datetime, timezone

from sqlalchemy import (
    Column, DateTime, Float, ForeignKey,
    Integer, String, Text
)
from sqlalchemy.orm import relationship

from app.core.database import Base


def _utcnow():
    """Returns the current UTC time (timezone-aware)."""
    return datetime.now(timezone.utc)


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)

    # Status: pending | approved | rejected
    status = Column(String(50), default="pending", nullable=False, index=True)

    # Payment proof image URL (set after upload)
    payment_proof_url = Column(String(512), nullable=True)

    # ── Shipping information (denormalised for simplicity) ──────────────────
    recipient_name  = Column(String(255), nullable=False)
    recipient_phone = Column(String(50),  nullable=False)
    province        = Column(String(255), nullable=False)
    city            = Column(String(255), nullable=False)
    district        = Column(String(255), nullable=False)
    postal_code     = Column(String(20),  nullable=False)
    address         = Column(Text,        nullable=False)

    # RajaOngkir & Shipping Details
    province_id     = Column(String(50),  nullable=True)
    city_id         = Column(String(50),  nullable=True)
    courier         = Column(String(50),  nullable=True)
    shipping_cost   = Column(Float,       default=0.0, nullable=False)

    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    # Relationship to line items
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Order id={self.id} status={self.status!r}>"


class OrderItem(Base):
    __tablename__ = "order_items"

    id         = Column(Integer, primary_key=True, index=True)
    order_id   = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)
    quantity   = Column(Integer, nullable=False)
    size       = Column(String(50),  nullable=True)
    color      = Column(String(100), nullable=True)
    unit_price = Column(Float,       nullable=False, default=0.0)

    order = relationship("Order", back_populates="items")

    def __repr__(self):
        return f"<OrderItem id={self.id} order_id={self.order_id} product_id={self.product_id}>"
