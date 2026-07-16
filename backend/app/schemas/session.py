from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class StartSessionRequest(BaseModel):
    candidate_name: str
    candidate_email: str
    candidate_phone: Optional[str] = None
    resume_text: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None

class MessageRequest(BaseModel):
    session_id: str
    message: str
    response_time_seconds: Optional[float] = None
    behavioral_metrics: Optional[Dict[str, Any]] = None

class TranscriptEntry(BaseModel):
    role: str        # "ai" or "candidate"
    content: str
    response_time: Optional[float] = None
    timestamp: str

class SessionOut(BaseModel):
    session_id: str
    status: str
    phase: str
    message: str   # AI's response message to display

class ResultOut(BaseModel):
    session_id: str
    candidate_name: str
    status: str
    score: Optional[float]
    strengths: Optional[List[str]]
    weaknesses: Optional[List[str]]
    recommendation: Optional[str]
    transcript: Optional[List[Dict[str, Any]]]
    completed_at: Optional[datetime]
    integrity_data: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True
