from pydantic import BaseModel
from typing import List
from datetime import datetime

class InterviewCreate(BaseModel):
    job_title: str
    domain: str
    experience_level: str
    job_description: str
    required_skills: List[str]
    num_questions: int
    duration: int
    language: str
    interviewer_tone: str

class InterviewOut(BaseModel):
    id: int
    job_title: str
    domain: str
    experience_level: str
    job_description: str
    required_skills: List[str]
    num_questions: int
    duration: int
    language: str
    interviewer_tone: str
    created_at: datetime

    class Config:
        from_attributes = True
