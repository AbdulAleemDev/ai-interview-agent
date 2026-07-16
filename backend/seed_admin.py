import sys
import os

# Include current directory in Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.database import engine, SessionLocal
from app.database.base import Base
from app.models.admin import Admin
from app.utils.auth import get_password_hash
from sqlalchemy import text

def seed_administrators():
    # 1. Drop the singular 'admin' table to fulfill user's explicit request
    try:
        with engine.connect() as conn:
            conn.execute(text("DROP TABLE IF EXISTS admin CASCADE"))
            conn.commit()
            print("Dropped singular 'admin' table successfully.")
    except Exception as e:
        print(f"Notice: singular 'admin' table drop: {e}")

    # 2. Make sure the plural 'admins' table is created
    Base.metadata.create_all(bind=engine)
    print("Created plural 'admins' table.")

    db = SessionLocal()
    try:
        # Seed single Super Admin in 'admins' table
        admin_data = {
            "name": "Super Admin",
            "email": "aleemman1234@gmail.com",
            "password": "8YOh@iMQw-097ta/go",
            "role": "Super Admin"
        }
        
        existing = db.query(Admin).filter(Admin.email == admin_data["email"]).first()
        if not existing:
            hashed = get_password_hash(admin_data["password"])
            new_admin = Admin(
                name=admin_data["name"],
                email=admin_data["email"],
                hashed_password=hashed,
                role=admin_data["role"]
            )
            db.add(new_admin)
            print(f"Seeded Super Admin in 'admins' table: {admin_data['email']}")
        else:
            existing.hashed_password = get_password_hash(admin_data["password"])
            print(f"Updated password for existing administrator: {admin_data['email']}")
            
        db.commit()
        print("Seeding complete.")
    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_administrators()
