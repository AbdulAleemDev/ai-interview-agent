from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import datetime, timedelta
from app.database.database import get_db
from app.models.admin import Admin
from app.models.interview import InterviewSetup
from app.models.session import InterviewSession
from app.models.activity_log import ActivityLog as ActivityLogModel
from app.schemas.admin import AdminCreate, AdminOut, Token, TokenData, AdminUpdate
from app.schemas.interview import InterviewCreate, InterviewOut
from app.schemas.activity_log import ActivityLogCreate, ActivityLogOut
from app.utils.auth import verify_password, get_password_hash, create_access_token, SECRET_KEY, ALGORITHM
from app.utils.email_utils import generate_otp, send_otp_email

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login-oauth")

# In-memory OTP store: { email: { "otp": str, "expires_at": datetime } }
_otp_store: dict = {}

OTP_EXPIRY_MINUTES = 15

class LoginPayload(BaseModel):
    email: str
    password: str

class OTPVerifyPayload(BaseModel):
    email: str
    otp: str

async def get_current_admin(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Admin:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        print("RECEIVED TOKEN:", token)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        print("DECODED PAYLOAD:", payload)
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email, role=payload.get("role"))
    except JWTError as e:
        print("JWT ERROR:", e)
        raise credentials_exception
    
    admin = db.query(Admin).filter(Admin.email == token_data.email).first()
    if admin is None:
        print("ADMIN NOT FOUND IN DB:", token_data.email)
        raise credentials_exception
    return admin

@router.post("/login")
def login(payload: LoginPayload, db: Session = Depends(get_db)):
    """Step 1: Verify credentials, generate OTP and send via email."""
    admin = db.query(Admin).filter(Admin.email == payload.email).first()
    if not admin or not verify_password(payload.password, admin.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Generate OTP and store with expiry
    otp = generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)
    _otp_store[payload.email] = {"otp": otp, "expires_at": expires_at}
    
    # Send OTP email
    sent = send_otp_email(to_email=admin.email, otp=otp, admin_name=admin.name)
    if not sent:
        print("\n" + "="*60)
        print(f" [FALLBACK] SECURITY KEY: OTP FOR {admin.email} IS: {otp}")
        print("="*60 + "\n")
    
    return {"otp_sent": True, "email": admin.email, "message": f"OTP sent to {admin.email}"}

@router.post("/verify-otp", response_model=Token)
def verify_otp(payload: OTPVerifyPayload, db: Session = Depends(get_db)):
    """Step 2: Validate OTP and issue JWT access token."""
    record = _otp_store.get(payload.email)
    
    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No OTP found for this email. Please login again."
        )
    
    if datetime.utcnow() > record["expires_at"]:
        # Clean up expired OTP
        del _otp_store[payload.email]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please login again to receive a new OTP."
        )
    
    if payload.otp.strip() != record["otp"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP. Please check and try again."
        )
    
    # OTP is valid — remove it and issue JWT
    del _otp_store[payload.email]
    admin = db.query(Admin).filter(Admin.email == payload.email).first()
    if not admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found.")
    
    access_token = create_access_token(data={"sub": admin.email, "role": admin.role})
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login-oauth", response_model=Token)
def login_oauth(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    admin = db.query(Admin).filter(Admin.email == form_data.username).first()
    if not admin or not verify_password(form_data.password, admin.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": admin.email, "role": admin.role})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/create-admin", response_model=AdminOut)
def create_admin(
    new_admin: AdminCreate,
    current_user: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if current_user.role != "Super Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins can register new administrator accounts"
        )
    
    existing = db.query(Admin).filter(Admin.email == new_admin.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An administrator with this email already exists"
        )
    
    hashed = get_password_hash(new_admin.password)
    db_admin = Admin(
        name=new_admin.name,
        email=new_admin.email,
        hashed_password=hashed,
        role=new_admin.role
    )
    db.add(db_admin)
    db.commit()
    db.refresh(db_admin)
    return db_admin

@router.get("/me", response_model=AdminOut)
def read_admin_me(current_user: Admin = Depends(get_current_admin)):
    return current_user

@router.put("/update-me", response_model=AdminOut)
def update_me(
    payload: AdminUpdate,
    current_user: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if payload.email is not None and payload.email.strip() != "":
        if payload.email != current_user.email:
            existing = db.query(Admin).filter(Admin.email == payload.email).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="An administrator with this email already exists"
                )
            current_user.email = payload.email
            
    if payload.name is not None and payload.name.strip() != "":
        current_user.name = payload.name
        
    if payload.password is not None and payload.password.strip() != "":
        current_user.hashed_password = get_password_hash(payload.password)
        
    db.commit()
    db.refresh(current_user)
    return current_user

@router.get("/list", response_model=List[AdminOut])
def list_admins(
    current_user: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    return db.query(Admin).order_by(Admin.id.asc()).all()

@router.put("/update-admin/{admin_id}", response_model=AdminOut)
def update_admin(
    admin_id: int,
    payload: AdminUpdate,
    current_user: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if current_user.role != "Super Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins can update administrator accounts"
        )
    
    admin = db.query(Admin).filter(Admin.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found")
    
    if payload.email is not None and payload.email.strip() != "":
        if payload.email != admin.email:
            # Check if email is already taken
            existing = db.query(Admin).filter(Admin.email == payload.email).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="An administrator with this email already exists"
                )
            admin.email = payload.email
        
    if payload.name is not None and payload.name.strip() != "":
        admin.name = payload.name
        
    if payload.password is not None and payload.password.strip() != "":
        admin.hashed_password = get_password_hash(payload.password)
        
    if payload.role is not None and payload.role.strip() != "":
        admin.role = payload.role
        
    db.commit()
    db.refresh(admin)
    return admin

@router.delete("/delete-admin/{admin_id}")
def delete_admin(
    admin_id: int,
    current_user: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if current_user.role != "Super Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins can delete administrator accounts"
        )
        
    if current_user.id == admin_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own administrator account"
        )
        
    admin = db.query(Admin).filter(Admin.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found")
        
    if admin.email == "aleemman1234@gmail.com":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The seed administrator account (aleemman1234@gmail.com) cannot be deleted"
        )
        
    db.delete(admin)
    db.commit()
    return {"message": "Admin deleted successfully"}


@router.post("/train-interview", response_model=InterviewOut)
def train_interview(
    payload: InterviewCreate,
    current_user: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    # Delete all previous interview configurations, keep only current
    db.query(InterviewSetup).delete()

    db_setup = InterviewSetup(
        job_title=payload.job_title,
        domain=payload.domain,
        experience_level=payload.experience_level,
        job_description=payload.job_description,
        required_skills=payload.required_skills,
        num_questions=payload.num_questions,
        duration=payload.duration,
        language=payload.language,
        interviewer_tone=payload.interviewer_tone
    )
    db.add(db_setup)
    db.commit()
    db.refresh(db_setup)
    return db_setup

@router.get("/candidates")
def list_candidates(
    current_user: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    sessions = db.query(InterviewSession).order_by(InterviewSession.created_at.desc()).all()
    result = []
    
    # Get active setup to check job title
    setup = db.query(InterviewSetup).first()
    default_role = setup.job_title if setup else "Software Engineer"
    
    for s in sessions:
        result.append({
            "id": s.id,
            "name": s.candidate_name,
            "email": s.candidate_email,
            "phone": s.candidate_phone or "N/A",
            "score": s.score or 0.0,
            "role": default_role,
            "status": s.status,
            "phase": s.phase,
            "date": s.created_at.strftime("%Y-%m-%d") if s.created_at else "",
            "recommendation": s.recommendation or "Neutral",
            "strengths": s.strengths or [],
            "weaknesses": s.weaknesses or [],
            "transcript": s.transcript or [],
            "resumeData": {
                "summary": s.resume_text[:250] + "..." if s.resume_text and len(s.resume_text) > 250 else (s.resume_text or "No resume uploaded."),
                "experience": ["Candidate uploaded Resume / CV document."],
                "skills": [],
                "education": "N/A"
            },
            "integrity_data": s.integrity_data
        })
    return result

class DeleteCandidatesPayload(BaseModel):
    ids: List[str]

@router.post("/candidates/delete")
def delete_candidates(
    payload: DeleteCandidatesPayload,
    current_user: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if not payload.ids:
        raise HTTPException(status_code=400, detail="No candidate IDs provided for deletion")
    
    deleted_count = db.query(InterviewSession).filter(InterviewSession.id.in_(payload.ids)).delete(synchronize_session=False)
    db.commit()
    return {"message": f"Successfully deleted {deleted_count} candidate(s)"}

@router.get("/logs", response_model=List[ActivityLogOut])
def get_logs(
    current_user: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    return db.query(ActivityLogModel).order_by(ActivityLogModel.id.desc()).all()

@router.post("/logs", response_model=ActivityLogOut)
def create_log(
    payload: ActivityLogCreate,
    current_user: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    db_log = ActivityLogModel(
        action=payload.action,
        category=payload.category,
        admin_name=payload.admin_name,
        details=payload.details
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

@router.delete("/logs")
def clear_all_logs(
    current_user: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if current_user.email != "aleemman1234@gmail.com":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the seed administrator (aleemman1234@gmail.com) can clear activity logs"
        )
    db.query(ActivityLogModel).delete()
    db.commit()
    return {"message": "All activity logs cleared successfully"}

@router.delete("/logs/{log_id}")
def delete_log_by_id(
    log_id: int,
    current_user: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if current_user.email != "aleemman1234@gmail.com":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the seed administrator (aleemman1234@gmail.com) can delete activity logs"
        )
    log = db.query(ActivityLogModel).filter(ActivityLogModel.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log entry not found")
    db.delete(log)
    db.commit()
    return {"message": "Log entry deleted successfully"}

