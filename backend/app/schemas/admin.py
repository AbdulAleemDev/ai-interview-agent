from pydantic import BaseModel, EmailStr
from typing import Optional

class AdminCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Optional[str] = "Interview Coach"

class AdminOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

class AdminUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None

