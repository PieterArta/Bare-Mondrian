from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, ConfigDict


# ---------------------------------------------------------------------------
# Sizing chart type alias for clarity
# e.g. {"S/M": {"Bust": "84–92", "Shoulder Width": "38", ...}, "L/XL": {...}}
# ---------------------------------------------------------------------------
SizingChart = Optional[Dict[str, Dict[str, Any]]]


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------
class ProductBase(BaseModel):
    title: str = Field(..., max_length=255, description="Product title")
    description: Optional[str] = Field(None, description="Product description")
    price: float = Field(..., gt=0, description="Product price (must be > 0)")
    stock: int = Field(0, ge=0, description="Available stock quantity")
    sizes: Optional[List[str]] = Field(default_factory=list, description="Available sizes e.g. ['S','M','L']")
    colors: Optional[List[str]] = Field(default_factory=list, description="Available colors e.g. ['Black','White']")
    image_url: Optional[str] = Field(None, description="URL of the product image")
    category: Optional[str] = Field(None, max_length=255, description="Product category")

    # Featured
    is_featured: bool = Field(False, description="Whether the product is featured on the homepage")
    featured_order: Optional[int] = Field(None, description="Display order within the featured list (lower = first)")

    # Product detail page
    composition: Optional[str] = Field(None, description="Fabric composition (free text)")
    care_instructions: Optional[str] = Field(None, description="Care instructions (free text)")
    shipping_info: Optional[str] = Field(None, description="Shipping information (free text)")
    sizing_chart: SizingChart = Field(
        None,
        description=(
            "Sizing chart as JSON: keys are size groups (e.g. 'S/M', 'L/XL'), "
            "values are dicts of measurement name → value string."
        ),
    )


# ---------------------------------------------------------------------------
# Create  (inherits all required fields from Base)
# ---------------------------------------------------------------------------
class ProductCreate(ProductBase):
    pass


# ---------------------------------------------------------------------------
# Update  (all fields optional for partial PATCH-style updates via PUT)
# ---------------------------------------------------------------------------
class ProductUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    price: Optional[float] = Field(None, gt=0)
    stock: Optional[int] = Field(None, ge=0)
    sizes: Optional[List[str]] = None
    colors: Optional[List[str]] = None
    image_url: Optional[str] = None
    category: Optional[str] = Field(None, max_length=255)
    is_featured: Optional[bool] = None
    featured_order: Optional[int] = None
    composition: Optional[str] = None
    care_instructions: Optional[str] = None
    shipping_info: Optional[str] = None
    sizing_chart: SizingChart = None


# ---------------------------------------------------------------------------
# Featured toggle  (used by PATCH /api/products/{id}/featured)
# ---------------------------------------------------------------------------
class ProductFeaturedToggle(BaseModel):
    is_featured: bool = Field(..., description="Set to true to feature, false to unfeature")
    featured_order: Optional[int] = Field(None, description="Optional display order position")


# ---------------------------------------------------------------------------
# Response  (adds DB-generated fields; enables ORM mode)
# ---------------------------------------------------------------------------
class ProductResponse(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
