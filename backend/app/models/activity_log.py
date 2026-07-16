from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from app.database.base import Base

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String, nullable=False)
    category = Column(String, nullable=False) # "security", "training", "settings"
    admin_name = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    details = Column(String, nullable=True)
