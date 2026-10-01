import traceback
from app.core.database import SessionLocal
from app.routers.orders import _enrich_order
from app.models.order import Order

db = SessionLocal()
orders = db.query(Order).all()
print(f'Found {len(orders)} orders')
failed = 0
for o in orders:
    try:
        _enrich_order(o)
    except Exception as e:
        print(f'Error for order {o.id}:')
        traceback.print_exc()
        failed += 1
print(f'Failed: {failed}')
