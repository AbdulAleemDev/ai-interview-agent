import os
from dotenv import load_dotenv, find_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database.database import engine, SessionLocal
from app.database.base import Base
from app.api.auth import router as auth_router
from app.api.interview import router as interview_router
from app.models.admin import Admin
from app.utils.auth import get_password_hash

load_dotenv(find_dotenv())

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Intervue.AI Backend API", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(interview_router)

@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        admin_exists = db.query(Admin).filter(Admin.email == "aleemman1234@gmail.com").first()
        if not admin_exists:
            hashed_pwd = get_password_hash("8YOh@iMQw-097ta/go")
            default_admin = Admin(
                name="Super Admin",
                email="aleemman1234@gmail.com",
                hashed_password=hashed_pwd,
                role="Super Admin"
            )
            db.add(default_admin)
            db.commit()
            print("Default administrator seeded successfully: aleemman1234@gmail.com")
    except Exception as e:
        print(f"Error seeding default admin: {e}")
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Welcome to Intervue.AI Backend API Service"}
