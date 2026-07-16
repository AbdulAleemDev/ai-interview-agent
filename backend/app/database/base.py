from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Import all models to register them on Base.metadata
from app.models.admin import Admin
from app.models.interview import InterviewSetup
from app.models.session import InterviewSession
from app.models.activity_log import ActivityLog
