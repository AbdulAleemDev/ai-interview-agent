import uuid
import os
import glob
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.database.database import get_db
from app.models.interview import InterviewSetup
from app.models.session import InterviewSession
from app.models.activity_log import ActivityLog as ActivityLogModel
from app.schemas.session import StartSessionRequest, MessageRequest, SessionOut, ResultOut
from app.utils.cv_parser import extract_text
from app.utils.github_client import fetch_github_profile_data
from app.utils.interview_agent import (
    run_initial_greeting,
    run_interview_step,
    run_cv_transition_question,
    run_final_evaluation,
)
from app.utils.integrity_engine import (
    calculate_baseline,
    analyze_answer_telemetry,
    verify_project_background,
    calculate_risk_score,
    analyze_consistency_and_understanding,
    extract_project_title,
    check_answer_patterns
)

router = APIRouter(prefix="/api/interview", tags=["Interview"])


def _config_dict(config: InterviewSetup) -> dict:
    return {
        "job_title": config.job_title,
        "domain": config.domain,
        "experience_level": config.experience_level,
        "job_description": config.job_description,
        "required_skills": config.required_skills or [],
        "num_questions": config.num_questions,
        "duration": config.duration,
        "language": config.language,
        "interviewer_tone": config.interviewer_tone,
    }


def _candidate_dict(session: InterviewSession) -> dict:
    return {
        "name": session.candidate_name,
        "email": session.candidate_email,
        "resume_text": session.resume_text,
        "github_url": session.github_url,
        "linkedin_url": session.linkedin_url,
        "portfolio_url": session.portfolio_url,
        "github_data": session.github_data,
    }


# -------------------------------------------------------------------
# GET /api/interview/config — public, returns active interview config
# -------------------------------------------------------------------
@router.get("/config")
def get_interview_config(db: Session = Depends(get_db)):
    config = db.query(InterviewSetup).first()
    if not config:
        raise HTTPException(
            status_code=404,
            detail="No interview configuration found. Please set one up in the admin dashboard."
        )
    return _config_dict(config)


# -------------------------------------------------------------------
# POST /api/interview/start — create session + return initial greeting
# -------------------------------------------------------------------
@router.post("/start", response_model=SessionOut)
def start_interview(payload: StartSessionRequest, db: Session = Depends(get_db)):
    config = db.query(InterviewSetup).first()
    if not config:
        raise HTTPException(status_code=404, detail="No interview configuration found.")

    # Friendly greeting asking the first calibration question
    ai_greeting = f"Welcome, {payload.candidate_name}! Before we begin the technical screening, let's start with a brief calibration phase to establish a baseline. Could you please tell me about yourself in 2–3 sentences?"

    # --- DUPLICATE CANDIDATE CHECK ---
    email_clean = payload.candidate_email.strip()
    duplicate_filters = [func.lower(InterviewSession.candidate_email) == func.lower(email_clean)]
    if payload.candidate_phone and payload.candidate_phone.strip():
        duplicate_filters.append(InterviewSession.candidate_phone == payload.candidate_phone.strip())
    
    existing = db.query(InterviewSession).filter(
        or_(*duplicate_filters)
    ).first()
    
    if existing:
        matched_field = "email" if existing.candidate_email.strip().lower() == email_clean.lower() else "phone number"
        raise HTTPException(
            status_code=409,
            detail=f"A candidate with this {matched_field} has already taken this interview. Each candidate is allowed only one attempt."
        )

    transcript = [{
        "role": "ai",
        "content": ai_greeting,
        "timestamp": datetime.utcnow().isoformat(),
    }]

    session_id = str(uuid.uuid4())
    session = InterviewSession(
        id=session_id,
        candidate_name=payload.candidate_name,
        candidate_email=payload.candidate_email.strip(),
        candidate_phone=payload.candidate_phone.strip() if payload.candidate_phone else None,
        status="active",
        phase="calibration",
        transcript=transcript,
        interview_questions_asked=0,  # 0 real technical questions asked
        follow_up_count=0,
        integrity_data={
            "calibration_responses": [],
            "observations": [],
            "behavioral_risk_score": "Low",
            "evidence": [],
            "project_title": "",
            "project_verification": {}
        }
    )
    db.add(session)
    
    db_log = ActivityLogModel(
        action="Candidate Started Interview",
        category="training",
        admin_name=payload.candidate_name,
        details=f"Candidate {payload.candidate_name} ({payload.candidate_email}) initiated their mock interview session."
    )
    db.add(db_log)
    db.commit()

    return SessionOut(session_id=session_id, status="active", phase="calibration", message=ai_greeting)


# -------------------------------------------------------------------
# POST /api/interview/message — candidate sends a reply
# -------------------------------------------------------------------
@router.post("/message", response_model=SessionOut)
def send_message(payload: MessageRequest, db: Session = Depends(get_db)):
    session = db.query(InterviewSession).filter(
        InterviewSession.id == payload.session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.status == "completed":
        raise HTTPException(status_code=400, detail="This interview is already completed.")

    config = db.query(InterviewSetup).first()
    if not config:
        raise HTTPException(status_code=404, detail="No interview configuration found.")

    config_dict = _config_dict(config)
    candidate_dict = _candidate_dict(session)

    # Initialize integrity data if missing
    integrity = dict(session.integrity_data or {})
    if "calibration_responses" not in integrity:
        integrity["calibration_responses"] = []
    if "observations" not in integrity:
        integrity["observations"] = []
    if "behavioral_risk_score" not in integrity:
        integrity["behavioral_risk_score"] = "Low"
    if "evidence" not in integrity:
        integrity["evidence"] = []

    # Get incoming telemetry metrics
    metrics = payload.behavioral_metrics or {}
    if not metrics:
        # Fallback default values
        metrics = {
            "thinking_time": payload.response_time_seconds or 3.0,
            "typing_duration": 5.0,
            "average_typing_speed": 120.0,
            "number_of_pauses": 0,
            "average_pause_duration": 0.0,
            "backspace_count": 0,
            "edit_count": 0,
            "total_typed_characters": len(payload.message),
            "total_pasted_characters": 0,
            "number_of_paste_events": 0
        }

    # Add candidate message to transcript
    transcript = list(session.transcript or [])
    transcript.append({
        "role": "candidate",
        "content": payload.message,
        "response_time": payload.response_time_seconds,
        "timestamp": datetime.utcnow().isoformat(),
        "behavioral_metrics": metrics # Track in transcript too
    })

    # --- CALIBRATION PHASE HANDLER ---
    if session.phase == "calibration":
        cal_responses = list(integrity.get("calibration_responses") or [])
        cal_responses.append({
            "message": payload.message,
            "metrics": metrics,
            "timestamp": datetime.utcnow().isoformat()
        })
        integrity["calibration_responses"] = cal_responses

        if len(cal_responses) == 1:
            # Q1 answered. Ask Q2.
            ai_reply = "Great! Next, which technologies do you use most frequently?"
            transcript.append({
                "role": "ai",
                "content": ai_reply,
                "timestamp": datetime.utcnow().isoformat()
            })
            session.transcript = transcript
            session.integrity_data = integrity
            db.commit()
            return SessionOut(session_id=payload.session_id, status="active", phase="calibration", message=ai_reply)

        elif len(cal_responses) == 2:
            # Q2 answered. Ask Q3.
            ai_reply = "Excellent. What is the title of your best or most recent project?"
            transcript.append({
                "role": "ai",
                "content": ai_reply,
                "timestamp": datetime.utcnow().isoformat()
            })
            session.transcript = transcript
            session.integrity_data = integrity
            db.commit()
            return SessionOut(session_id=payload.session_id, status="active", phase="calibration", message=ai_reply)

        else:
            # Q3 answered. Complete calibration and transition to initial_questions!
            # Extract project title
            project_title = extract_project_title(payload.message)
            integrity["project_title"] = project_title
            
            # Compute typing baseline
            baseline = calculate_baseline(cal_responses)
            integrity["behavioral_baseline"] = baseline

            # Generate first technical question
            ai_greeting_q = run_initial_greeting(config_dict, candidate_dict)
            transcript.append({
                "role": "ai",
                "content": ai_greeting_q,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            session.transcript = transcript
            session.phase = "initial_questions"
            session.interview_questions_asked = 1
            session.integrity_data = integrity
            db.commit()
            return SessionOut(session_id=payload.session_id, status="active", phase="initial_questions", message=ai_greeting_q)

    # --- TECHNICAL / DEEP INTERVIEW PHASES ---
    # Accumulate total typed and pasted characters across all answers
    total_typed = integrity.get("accumulated_typed_chars", 0)
    total_pasted = integrity.get("accumulated_pasted_chars", 0)
    total_pastes = integrity.get("accumulated_paste_events", 0)

    if "behavioral_timeline" not in integrity:
        integrity["behavioral_timeline"] = []

    if metrics:
        total_typed += metrics.get("total_typed_characters", 0)
        total_pasted += metrics.get("total_pasted_characters", 0)
        total_pastes += metrics.get("number_of_paste_events", 0)

        # Record timeline events
        new_timeline_events = metrics.get("behavioral_timeline", [])
        if new_timeline_events:
            q_num = (session.interview_questions_asked or 0)
            formatted_events = []
            for event in new_timeline_events:
                event_name = event.get("event")
                timestamp = event.get("timestamp")
                formatted_events.append({
                    "event": f"[Question {q_num}] {event_name}",
                    "timestamp": timestamp
                })
            integrity["behavioral_timeline"].extend(formatted_events)

    integrity["accumulated_typed_chars"] = total_typed
    integrity["accumulated_pasted_chars"] = total_pasted
    integrity["accumulated_paste_events"] = total_pastes

    # Compute overall paste ratio/chance (expressed as percentage)
    pasted_content_chance = 0.0
    total_chars = total_typed + total_pasted
    if total_chars > 0:
        pasted_content_chance = (total_pasted / total_chars) * 100.0
    integrity["pasted_content_chance"] = round(pasted_content_chance, 1)

    # Run telemetry anomaly detection
    baseline = integrity.get("behavioral_baseline") or {}
    if baseline:
        anomalies = analyze_answer_telemetry(metrics, baseline)
        observations = list(integrity.get("observations") or [])
        
        for anomaly in anomalies:
            obs_type = "unknown"
            if "paste" in anomaly.lower():
                obs_type = "paste_large" if "large" in anomaly.lower() else "paste_multiple"
            elif "speed" in anomaly.lower():
                obs_type = "typing_speed_deviation"
            elif "thinking" in anomaly.lower():
                obs_type = "short_thinking_time"
            elif "instantaneous" in anomaly.lower():
                obs_type = "instant_submission"
                
            observations.append({
                "type": obs_type,
                "detail": anomaly,
                "timestamp": datetime.utcnow().isoformat()
            })
        
        # Run semantic checks for inconsistencies and technical understanding
        cv_text = session.resume_text or ""
        semantic_analysis = analyze_consistency_and_understanding(
            payload.message,
            transcript,
            cv_text
        )
        
        # Log semantic observations
        inc = semantic_analysis.get("inconsistency_detected")
        if inc:
            observations.append({
                "type": "inconsistency_detected",
                "detail": inc,
                "timestamp": datetime.utcnow().isoformat()
            })
            
        fv = semantic_analysis.get("failed_validation")
        if fv:
            observations.append({
                "type": "failed_validation",
                "detail": fv,
                "timestamp": datetime.utcnow().isoformat()
            })
            
        sv = semantic_analysis.get("successful_validation")
        if sv:
            observations.append({
                "type": "successful_validation",
                "detail": sv,
                "timestamp": datetime.utcnow().isoformat()
            })
            
        # Check combined behavioral patterns
        has_semantic_failure = any(obs.get("type") in ("failed_validation", "inconsistency_detected") for obs in observations)
        pattern_res = check_answer_patterns(metrics, has_semantic_failure)
        if pattern_res["confidence"]:
            conf = pattern_res["confidence"]
            obs_type = f"pattern_{conf.lower()}"
            observations.append({
                "type": obs_type,
                "detail": pattern_res["detail"],
                "timestamp": datetime.utcnow().isoformat()
            })
            if conf in ("Medium", "High"):
                integrity["generate_adaptive_verification"] = True

        integrity["observations"] = observations
        
        # Recalculate Risk Score
        risk_level, evidence = calculate_risk_score(observations)
        integrity["behavioral_risk_score"] = risk_level
        integrity["evidence"] = evidence
        
    session.integrity_data = integrity

    # Add project matching status to candidate_dict for the step generation
    project_title = integrity.get("project_title", "")
    project_verification = integrity.get("project_verification", {})
    project_missing = not project_verification.get("found", True) if project_verification else False
    candidate_dict["project_title"] = project_title
    candidate_dict["project_missing"] = project_missing
    candidate_dict["generate_adaptive_verification"] = integrity.get("generate_adaptive_verification", False)
    if "generate_adaptive_verification" in integrity:
        integrity["generate_adaptive_verification"] = False

    # Run evaluate and get next step
    result = run_interview_step(
        config=config_dict,
        candidate=candidate_dict,
        transcript=transcript,
        phase=session.phase,
        questions_asked=session.interview_questions_asked or 0,
        follow_up_count=session.follow_up_count or 0,
    )

    ai_reply = result["message"]
    new_phase = result["new_phase"]
    new_q_count = result["new_questions_asked"]
    new_follow_up = result["new_follow_up_count"]
    is_done = result["is_done"]

    # Append AI reply
    transcript.append({
        "role": "ai",
        "content": ai_reply,
        "timestamp": datetime.utcnow().isoformat(),
    })

    # If completed
    if is_done or new_phase == "done":
        eval_data = run_final_evaluation(config_dict, candidate_dict, transcript)
        session.status = "completed"
        
        db_log = ActivityLogModel(
            action="Candidate Completed Interview",
            category="training",
            admin_name=session.candidate_name,
            details=f"Candidate {session.candidate_name} ({session.candidate_email}) completed their mock interview session."
        )
        db.add(db_log)
        
        raw_score = float(eval_data.get("score", 55))
        
        # Calculate pattern-based penalty
        max_penalty_pct = 0.0
        highest_pattern_confidence = "None"
        final_has_semantic_failure = any(obs.get("type") in ("failed_validation", "inconsistency_detected") for obs in (integrity.get("observations") or []))
        
        for obs in (integrity.get("observations") or []):
            obs_type = obs.get("type")
            if obs_type == "pattern_low":
                if highest_pattern_confidence == "None":
                    highest_pattern_confidence = "Low"
            elif obs_type == "pattern_medium":
                max_penalty_pct = max(max_penalty_pct, 7.5)
                if highest_pattern_confidence in ("None", "Low"):
                    highest_pattern_confidence = "Medium"
            elif obs_type == "pattern_high":
                if final_has_semantic_failure:
                    max_penalty_pct = max(max_penalty_pct, 20.0)
                    highest_pattern_confidence = "High"
                else:
                    max_penalty_pct = max(max_penalty_pct, 7.5)
                    if highest_pattern_confidence in ("None", "Low"):
                        highest_pattern_confidence = "Medium"
        
        penalty_deduction = raw_score * (max_penalty_pct / 100.0)
        if max_penalty_pct > 0.0:
            integrity["score_penalty_applied"] = f"Deducted {round(penalty_deduction, 1)} points due to {highest_pattern_confidence} confidence behavioral pattern match ({max_penalty_pct}% penalty)."
            
        session.score = max(0.0, raw_score - penalty_deduction)
        session.strengths = eval_data.get("strengths", [])
        
        weaknesses = list(eval_data.get("weaknesses", []))
        if penalty_deduction > 0.0:
            weaknesses.append(f"Score reduced by {max_penalty_pct}% ({round(penalty_deduction, 1)} pts) due to detected {highest_pattern_confidence.lower()}-confidence suspicious behavioral copy-paste and window pattern.")
        session.weaknesses = weaknesses
        
        session.recommendation = eval_data.get("recommendation", "Neutral")
        session.completed_at = datetime.utcnow()
        session.transcript = transcript
        session.phase = "done"
        session.integrity_data = integrity
        db.commit()
        return SessionOut(session_id=payload.session_id, status="completed", phase="done", message=ai_reply)

    # Update session
    session.transcript = transcript
    session.phase = new_phase
    session.interview_questions_asked = new_q_count
    session.follow_up_count = new_follow_up
    db.commit()

    return SessionOut(session_id=payload.session_id, status="active", phase=new_phase, message=ai_reply)


# -------------------------------------------------------------------
# POST /api/interview/upload-cv/{session_id} — candidate uploads CV & links
# -------------------------------------------------------------------
@router.post("/upload-cv/{session_id}", response_model=SessionOut)
def upload_cv(
    session_id: str,
    file: UploadFile = File(...),
    github_url: Optional[str] = Form(None),
    linkedin_url: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    
    # Parse CV text and save original file
    try:
        file_bytes = file.file.read()
        cv_text = extract_text(file.filename, file_bytes)
        
        # Save to local uploads folder
        upload_dir = "uploads"
        if not os.path.exists(upload_dir):
            os.makedirs(upload_dir)
        
        safe_filename = "".join(c for c in file.filename if c.isalnum() or c in (".", "_", "-"))
        file_path = os.path.join(upload_dir, f"{session_id}_{safe_filename}")
        with open(file_path, "wb") as f:
            f.write(file_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process or save file: {str(e)}")

    # Fetch GitHub details if provided
    github_data = None
    if github_url:
        github_data = fetch_github_profile_data(github_url)

    # Update session
    session.resume_text = cv_text
    session.github_url = github_url
    session.linkedin_url = linkedin_url
    session.github_data = github_data
    session.phase = "deep_questions"

    integrity = dict(session.integrity_data or {})
    project_title = integrity.get("project_title", "")
    project_missing = False
    if project_title:
        verification = verify_project_background(project_title, cv_text, github_data)
        integrity["project_verification"] = verification
        
        observations = list(integrity.get("observations") or [])
        if not verification.get("found", True):
            project_missing = True
            observations.append({
                "type": "project_missing",
                "detail": project_title,
                "timestamp": datetime.utcnow().isoformat()
            })
        else:
            observations.append({
                "type": "successful_validation",
                "detail": f"Project '{project_title}' was successfully verified in Resume/GitHub.",
                "timestamp": datetime.utcnow().isoformat()
            })
        integrity["observations"] = observations
        
        risk_level, evidence = calculate_risk_score(observations)
        integrity["behavioral_risk_score"] = risk_level
        integrity["evidence"] = evidence
        
    session.integrity_data = integrity

    # Save to candidate dict
    config = db.query(InterviewSetup).first()
    config_dict = _config_dict(config)
    candidate_dict = _candidate_dict(session)
    candidate_dict["project_title"] = project_title
    candidate_dict["project_missing"] = project_missing

    # Generate transition technical question
    ai_reply = run_cv_transition_question(
        config_dict, candidate_dict, session.transcript, session.interview_questions_asked
    )

    # Update transcript and question count
    transcript = list(session.transcript or [])
    transcript.append({
        "role": "ai",
        "content": ai_reply,
        "timestamp": datetime.utcnow().isoformat()
    })
    session.transcript = transcript
    session.interview_questions_asked = (session.interview_questions_asked or 0) + 1
    db.commit()

    return SessionOut(
        session_id=session_id,
        status="active",
        phase="deep_questions",
        message=ai_reply
    )


# -------------------------------------------------------------------
# GET /api/interview/result/{session_id}
# -------------------------------------------------------------------
@router.get("/result/{session_id}", response_model=ResultOut)
def get_result(session_id: str, db: Session = Depends(get_db)):
    session = db.query(InterviewSession).filter(
        InterviewSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    return ResultOut(
        session_id=session.id,
        candidate_name=session.candidate_name,
        status=session.status,
        phase=session.phase,
        score=session.score,
        strengths=session.strengths,
        weaknesses=session.weaknesses,
        recommendation=session.recommendation,
        transcript=session.transcript,
        completed_at=session.completed_at,
        integrity_data=session.integrity_data,
    )

@router.get("/download-cv/{session_id}")
def download_cv(session_id: str):
    from fastapi.responses import FileResponse
    upload_dir = "uploads"
    if not os.path.exists(upload_dir):
        raise HTTPException(status_code=404, detail="No uploads directory found.")
    
    files = glob.glob(os.path.join(upload_dir, f"{session_id}_*"))
    if not files:
        raise HTTPException(status_code=404, detail="CV file not found for this candidate.")
    
    file_path = files[0]
    filename = os.path.basename(file_path).split("_", 1)[1]
    return FileResponse(path=file_path, filename=filename, media_type="application/octet-stream")
