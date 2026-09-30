from sqlalchemy import text
from app.core.database import engine

def add_photos_column():
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE products ADD COLUMN photos JSONB DEFAULT '[]'::jsonb;"))
            print("Successfully added photos column")
        except Exception as e:
            print("Error or column already exists:", e)

if __name__ == "__main__":
    add_photos_column()
