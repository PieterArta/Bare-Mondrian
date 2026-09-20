from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.middleware.auth_middleware import require_admin
from app.models.product import Product
from app.schemas.product_schema import ProductCreate, ProductFeaturedToggle, ProductResponse, ProductUpdate

router = APIRouter()


# ---------------------------------------------------------------------------
# GET /api/products/
# ---------------------------------------------------------------------------
@router.get(
    "/",
    response_model=List[ProductResponse],
    summary="List all products",
    description="Returns a paginated list of products. Supports filtering by category and featured status.",
)
def get_products(
    category: Optional[str] = Query(None, description="Filter by category"),
    is_featured: Optional[bool] = Query(None, description="Filter featured products"),
    skip: int = Query(0, ge=0, description="Number of records to skip (offset)"),
    limit: int = Query(20, ge=1, le=100, description="Max number of records to return"),
    db: Session = Depends(get_db),
):
    query = db.query(Product)
    if category is not None:
        query = query.filter(Product.category == category)
    if is_featured is not None:
        query = query.filter(Product.is_featured == is_featured)
    return query.offset(skip).limit(limit).all()


# ---------------------------------------------------------------------------
# GET /api/products/{product_id}
# ---------------------------------------------------------------------------
@router.get(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Get a product by ID",
)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id={product_id} not found.",
        )
    return product


# ---------------------------------------------------------------------------
# POST /api/products/
# ---------------------------------------------------------------------------
@router.post(
    "/",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new product",
)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    product = Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


# ---------------------------------------------------------------------------
# PUT /api/products/{product_id}
# ---------------------------------------------------------------------------
@router.put(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Update a product (partial update supported)",
)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id={product_id} not found.",
        )

    # Only update fields that were explicitly provided
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return product


# ---------------------------------------------------------------------------
# DELETE /api/products/{product_id}
# ---------------------------------------------------------------------------
@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a product",
)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id={product_id} not found.",
        )
    db.delete(product)
    db.commit()


# ---------------------------------------------------------------------------
# PATCH /api/products/{product_id}/featured  — admin only
# ---------------------------------------------------------------------------
@router.patch(
    "/{product_id}/featured",
    response_model=ProductResponse,
    summary="Toggle featured status of a product (admin only)",
)
def toggle_featured(
    product_id: int,
    payload: ProductFeaturedToggle,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id={product_id} not found.",
        )

    product.is_featured = payload.is_featured
    if payload.featured_order is not None:
        product.featured_order = payload.featured_order
    elif not payload.is_featured:
        # Clear the order when un-featuring
        product.featured_order = None

    db.commit()
    db.refresh(product)
    return product
