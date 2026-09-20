from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import Base, engine

# Import all models here so SQLAlchemy registers them before create_all()
from app.models.user import User          # noqa: F401
from app.models.product import Product    # noqa: F401
from app.models.order import Order, OrderItem  # noqa: F401

# Create all registered tables
Base.metadata.create_all(bind=engine)


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API for BARE Mondrian E-Commerce Platform"
)

# CORS Middleware setup
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "https://bare-mondrian.netlify.app",  # Production Netlify domain
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.netlify\.app",  # Matches any Netlify production or preview subdomains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    """Health check root endpoint."""
    return {"status": "BARE Mondrian API is running"}


# Import and register routers
from app.routers import products, auth, orders, homepage, shipping

app.include_router(products.router, prefix="/api/products", tags=["Products"])
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(orders.router, prefix="/api/orders", tags=["Orders"])
app.include_router(homepage.router, prefix="/api/homepage", tags=["Homepage"])
app.include_router(shipping.router, prefix="/api/shipping", tags=["Shipping"])

# Serve uploaded files (payment proofs, etc.) as static assets
_uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
_uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")

