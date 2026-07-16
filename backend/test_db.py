from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

try:
    engine = create_engine(DATABASE_URL)

    with engine.connect() as connection:
        result = connection.execute(text("SELECT version();"))
        print("✅ Database connected successfully!")
        print(result.fetchone()[0])

except Exception as e:
    print("❌ Database connection failed!")
    print(e)