from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.middleware.auth_middleware import require_admin
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.schemas.order_schema import OrderCreate, OrderItemResponse, OrderResponse
from app.services.upload_service import save_upload

router = APIRouter()


# ---------------------------------------------------------------------------
# Helper: enrich order items with product image_url from the joined product
# ---------------------------------------------------------------------------
def _enrich_order(order: Order) -> OrderResponse:
    """Convert an ORM Order to an OrderResponse, filling product_image_url."""
    # Build item responses manually so we can pull image_url from the
    # joined Product row (which may be None if the product was deleted).
    items_out = []
    for item in order.items:
        prod = item.product  # loaded via lazy="joined"
        items_out.append(
            OrderItemResponse(
                id=item.id,
                product_id=item.product_id,
                quantity=item.quantity,
                size=item.size,
                color=item.color,
                unit_price=item.unit_price,
                product_name=item.product_name or (prod.title if prod else None),
                product_image_url=prod.image_url if prod else None,
            )
        )

    return OrderResponse(
        id=order.id,
        status=order.status,
        payment_method=order.payment_method,
        payment_proof_url=order.payment_proof_url,
        recipient_name=order.recipient_name,
        recipient_phone=order.recipient_phone,
        province=order.province,
        city=order.city,
        district=order.district,
        postal_code=order.postal_code,
        address=order.address,
        province_id=order.province_id,
        city_id=order.city_id,
        courier=order.courier,
        shipping_cost=order.shipping_cost,
        items=items_out,
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


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
        payment_method=payload.payment_method,
        recipient_name=shipping.recipient_name,
        recipient_phone=shipping.recipient_phone,
        province=shipping.province,
        city=shipping.city,
        district=shipping.district or "",
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
        # Look up product to snapshot the unit price and name
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
            product_name=product.title or "",
        )
        db.add(order_item)

    db.commit()
    db.refresh(order)
    return _enrich_order(order)


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
    orders = db.query(Order).order_by(Order.created_at.desc()).all()
    return [_enrich_order(o) for o in orders]


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
    return _enrich_order(order)


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
    return _enrich_order(order)


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
    return _enrich_order(order)


# ---------------------------------------------------------------------------
# POST /api/orders/{order_id}/payment-proof  — upload payment proof & set method
# ---------------------------------------------------------------------------
from fastapi import Form
from typing import Optional

@router.post(
    "/{order_id}/payment-proof",
    response_model=OrderResponse,
    summary="Upload payment proof and set payment method",
)
def upload_payment_proof(
    order_id: int,
    payment_method: str = Form("qris", description="Selected payment method (e.g. qris, bank_transfer, cod)"),
    file: Optional[UploadFile] = File(None, description="Payment proof image (JPEG / PNG / WEBP)"),
    db: Session = Depends(get_db),
):
    order = _get_order_or_404(order_id, db)

    order.payment_method = payment_method

    if file:
        url = save_upload(file, sub_folder="payment_proofs")
        order.payment_proof_url = url
    elif payment_method != "cod" and not order.payment_proof_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A payment proof file is required for non-COD payment methods."
        )

    db.commit()
    db.refresh(order)
    return _enrich_order(order)


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
