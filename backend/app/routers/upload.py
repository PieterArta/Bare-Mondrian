from fastapi import APIRouter, Depends, UploadFile, File
from app.middleware.auth_middleware import require_admin
from app.services.upload_service import save_upload

router = APIRouter()

@router.post("/product-photo")
def upload_product_photo(file: UploadFile = File(...), _admin=Depends(require_admin)):
    """
    Upload a product photo to Cloudinary.
    Returns the URL of the uploaded image.
    Requires admin privileges.
    """
    url = save_upload(file, sub_folder="products")
    return {"url": url}
