from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ActivityLogCreate(BaseModel):
    action: str
    category: str
    admin_name: str
    details: Optional[str] = None

class ActivityLogOut(BaseModel):
    id: int
    action: str
    category: str
    admin_name: str
    timestamp: datetime
    details: Optional[str] = None

    class Config:
        from_attributes = True
