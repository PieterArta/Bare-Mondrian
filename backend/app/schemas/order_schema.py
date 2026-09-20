from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict


# ---------------------------------------------------------------------------
# Cart item (individual line in an order)
# ---------------------------------------------------------------------------
class OrderItemCreate(BaseModel):
    product_id: int = Field(..., description="Product ID")
    quantity: int = Field(..., ge=1, description="Quantity ordered")
    size: Optional[str] = Field(None, max_length=50, description="Selected size")
    color: Optional[str] = Field(None, max_length=100, description="Selected color")


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    quantity: int
    size: Optional[str]
    color: Optional[str]
    unit_price: float


# ---------------------------------------------------------------------------
# Shipping information
# ---------------------------------------------------------------------------
class ShippingInfo(BaseModel):
    recipient_name: str = Field(..., max_length=255, description="Recipient's full name")
    recipient_phone: str = Field(..., max_length=50, description="Recipient's phone number")
    province: str = Field(..., max_length=255, description="Province")
    city: str = Field(..., max_length=255, description="City / Kabupaten")
    district: Optional[str] = Field(None, max_length=255, description="District / Kecamatan")
    postal_code: str = Field(..., max_length=20, description="Postal / ZIP code")
    address: str = Field(..., description="Full street address")
    province_id: Optional[str] = Field(None, description="RajaOngkir Province ID")
    city_id: Optional[str] = Field(None, description="RajaOngkir City ID")
    courier: Optional[str] = Field(None, description="Courier code e.g. jne, pos, tiki")
    shipping_cost: Optional[float] = Field(0.0, ge=0, description="Calculated shipping cost")


# ---------------------------------------------------------------------------
# Create order request body
# ---------------------------------------------------------------------------
class OrderCreate(BaseModel):
    shipping: ShippingInfo
    items: List[OrderItemCreate] = Field(..., min_length=1, description="At least one item required")


# ---------------------------------------------------------------------------
# Response
# ---------------------------------------------------------------------------
class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    payment_proof_url: Optional[str]

    # Shipping fields (flattened from DB columns)
    recipient_name: str
    recipient_phone: str
    province: str
    city: str
    district: Optional[str] = None
    postal_code: str
    address: str
    province_id: Optional[str]
    city_id: Optional[str]
    courier: Optional[str]
    shipping_cost: Optional[float]

    items: List[OrderItemResponse]
    created_at: datetime
    updated_at: datetime
