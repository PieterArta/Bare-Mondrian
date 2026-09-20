from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.middleware.auth_middleware import require_admin
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.schemas.order_schema import OrderCreate, OrderResponse
from app.services.upload_service import save_upload

router = APIRouter()


# ---------------------------------------------------------------------------
# POST /api/orders/  — create a new order
# ---------------------------------------------------------------------------
@router.post(
    "/",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Place a new order",
)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    shipping = payload.shipping

    order = Order(
        status="pending",
        recipient_name=shipping.recipient_name,
        recipient_phone=shipping.recipient_phone,
        province=shipping.province,
        city=shipping.city,
        district=shipping.district,
        postal_code=shipping.postal_code,
        address=shipping.address,
        province_id=shipping.province_id,
        city_id=shipping.city_id,
        courier=shipping.courier,
        shipping_cost=shipping.shipping_cost or 0.0,
    )
    db.add(order)
    db.flush()  # Get order.id before committing

    for item_data in payload.items:
        # Look up product to snapshot the unit price
        product = db.query(Product).filter(Product.id == item_data.product_id).first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with id={item_data.product_id} not found.",
            )

        order_item = OrderItem(
            order_id=order.id,
            product_id=item_data.product_id,
            quantity=item_data.quantity,
            size=item_data.size,
            color=item_data.color,
            unit_price=product.price,
        )
        db.add(order_item)

    db.commit()
    db.refresh(order)
    return order


# ---------------------------------------------------------------------------
# GET /api/orders/  — list all orders (admin only)
# ---------------------------------------------------------------------------
@router.get(
    "/",
    response_model=List[OrderResponse],
    summary="List all orders (admin only)",
)
def list_orders(
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    return db.query(Order).order_by(Order.created_at.desc()).all()


# ---------------------------------------------------------------------------
# GET /api/orders/{order_id}  — get a single order
# ---------------------------------------------------------------------------
@router.get(
    "/{order_id}",
    response_model=OrderResponse,
    summary="Get a single order by ID",
)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id={order_id} not found.",
        )
    return order


# ---------------------------------------------------------------------------
# PATCH /api/orders/{order_id}/approve  — admin only
# ---------------------------------------------------------------------------
@router.patch(
    "/{order_id}/approve",
    response_model=OrderResponse,
    summary="Approve an order (admin only)",
)
def approve_order(
    order_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    order = _get_order_or_404(order_id, db)
    order.status = "approved"
    db.commit()
    db.refresh(order)
    return order


# ---------------------------------------------------------------------------
# PATCH /api/orders/{order_id}/reject  — admin only
# ---------------------------------------------------------------------------
@router.patch(
    "/{order_id}/reject",
    response_model=OrderResponse,
    summary="Reject an order (admin only)",
)
def reject_order(
    order_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    order = _get_order_or_404(order_id, db)
    order.status = "rejected"
    db.commit()
    db.refresh(order)
    return order


# ---------------------------------------------------------------------------
# POST /api/orders/{order_id}/payment-proof  — upload payment proof image
# ---------------------------------------------------------------------------
@router.post(
    "/{order_id}/payment-proof",
    response_model=OrderResponse,
    summary="Upload payment proof for an order",
)
def upload_payment_proof(
    order_id: int,
    file: UploadFile = File(..., description="Payment proof image (JPEG / PNG / WEBP)"),
    db: Session = Depends(get_db),
):
    order = _get_order_or_404(order_id, db)

    url = save_upload(file, sub_folder="payment_proofs")
    order.payment_proof_url = url

    db.commit()
    db.refresh(order)
    return order


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------
def _get_order_or_404(order_id: int, db: Session) -> Order:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id={order_id} not found.",
        )
    return order
