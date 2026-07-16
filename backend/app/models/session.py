from sqlalchemy import Column, Integer, String, DateTime, Float, JSON
from sqlalchemy.sql import func
from app.database.base import Base

class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(String, primary_key=True, index=True)       # UUID string
    candidate_name = Column(String, nullable=False)
    candidate_email = Column(String, nullable=False)
    candidate_phone = Column(String, nullable=True)
    resume_text = Column(String, nullable=True)
    github_url = Column(String, nullable=True)
    linkedin_url = Column(String, nullable=True)
    portfolio_url = Column(String, nullable=True)
    github_data = Column(JSON, nullable=True)
    status = Column(String, default="active")               # active | completed
    phase = Column(String, default="intake")                # intake | interview | done
    transcript = Column(JSON, default=[])                   # [{role, content, response_time, timestamp}]
    interview_questions_asked = Column(Integer, default=0)  # only real Q count, no follow-ups
    follow_up_count = Column(Integer, default=0)            # follow-ups on current question
    score = Column(Float, nullable=True)
    strengths = Column(JSON, nullable=True)
    weaknesses = Column(JSON, nullable=True)
    recommendation = Column(String, nullable=True)
    integrity_data = Column(JSON, nullable=True)            # behavioral baseline, risk score, observations, etc.
    created_at = Column(DateTime, default=func.now())
    completed_at = Column(DateTime, nullable=True)
