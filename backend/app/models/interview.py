from sqlalchemy import Column, Integer, String, DateTime, JSON
from sqlalchemy.sql import func
from app.database.base import Base

class InterviewSetup(Base):
    __tablename__ = "interviews"

    id = Column(Integer, primary_key=True, index=True)
    job_title = Column(String, nullable=False)
    domain = Column(String, nullable=False)
    experience_level = Column(String, nullable=False)
    job_description = Column(String, nullable=False)
    required_skills = Column(JSON, nullable=False)
    num_questions = Column(Integer, nullable=False)
    duration = Column(Integer, nullable=False)
    language = Column(String, nullable=False, default="English")
    interviewer_tone = Column(String, nullable=False, default="Professional")
    created_at = Column(DateTime, default=func.now())
