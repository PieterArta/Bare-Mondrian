import asyncio
from fastapi import UploadFile
from io import BytesIO
from app.services.upload_service import save_upload

async def main():
    try:
        # Create a dummy UploadFile
        dummy_file = UploadFile(filename="test.png", file=BytesIO(b"dummy image data"))
        dummy_file.content_type = "image/png"
        
        print("Starting upload...")
        url = save_upload(dummy_file, sub_folder="products")
        print("Upload successful:", url)
    except Exception as e:
        print("Upload failed:", type(e))
        print("Error details:", str(e))

if __name__ == "__main__":
    asyncio.run(main())
