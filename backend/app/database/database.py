import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Resolve dotenv file from parent path
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../../.env"))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ai_interview_agent"

# Replace postgresql:// with postgresql+psycopg2:// if required, but default postgresql works fine
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
