import os
import json
from typing import List, Dict, Any, Tuple
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage

def get_llm() -> ChatGroq:
    api_key = os.getenv("GROQ_API_KEY", "")
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        api_key=api_key,
        temperature=0.2, # Lower temperature for analytical queries
        max_tokens=800,
    )

def extract_project_title(msg: str) -> str:
    """
    Extracts the main project title from the candidate response.
    """
    if not msg:
        return "Unknown Project"
    llm = get_llm()
    prompt = f"""Extract the main project title/name from the following candidate message. Respond with the project name/title ONLY (e.g. "E-commerce platform"). Do not include any extra text.
          
Candidate message: "{msg}"
Project Title:"""
    try:
        response = llm.invoke([HumanMessage(content=prompt)])
        return response.content.strip().strip('"')
    except Exception:
        # Fallback to first few words
        words = msg.split()
        return " ".join(words[:4])

def calculate_baseline(calibration_responses: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes candidate's typing and thinking baseline from the calibration phase responses.
    """
    if not calibration_responses:
        return {}

    total_speed = 0.0
    speed_counts = 0
    total_thinking_time = 0.0
    total_pause_duration = 0.0
    pause_counts = 0
    total_pauses = 0
    total_backspaces = 0
    total_edits = 0
    total_typed_chars = 0

    for resp in calibration_responses:
        metrics = resp.get("metrics") or {}
        
        speed = metrics.get("average_typing_speed", 0.0)
        if speed and speed > 0:
            total_speed += speed
            speed_counts += 1

        total_thinking_time += metrics.get("thinking_time", 0.0)
        total_pause_duration += metrics.get("average_pause_duration", 0.0)
        
        if metrics.get("average_pause_duration", 0.0) > 0:
            pause_counts += 1
            
        total_pauses += metrics.get("number_of_pauses", 0)
        total_backspaces += metrics.get("backspace_count", 0)
        total_edits += metrics.get("edit_count", 0)
        total_typed_chars += metrics.get("total_typed_characters", 0)

    num_responses = len(calibration_responses)
    
    baseline = {
        "baseline_typing_speed": (total_speed / speed_counts) if speed_counts > 0 else 120.0, # char/min
        "baseline_thinking_time": total_thinking_time / num_responses,
        "baseline_pause_duration": (total_pause_duration / pause_counts) if pause_counts > 0 else 0.0,
        "baseline_pauses_per_char": (total_pauses / total_typed_chars) if total_typed_chars > 0 else 0.0,
        "baseline_backspace_rate": (total_backspaces / total_typed_chars) if total_typed_chars > 0 else 0.0,
        "baseline_edit_rate": (total_edits / total_typed_chars) if total_typed_chars > 0 else 0.0,
    }
    
    return baseline

def analyze_answer_telemetry(metrics: Dict[str, Any], baseline: Dict[str, Any]) -> List[str]:
    """
    Compares telemetry of a single answer to baseline to detect anomalies.
    Returns a list of evidence warning strings.
    """
    if not metrics or not baseline:
        return []

    warnings = []
    
    # 1. Paste detection
    paste_events = metrics.get("number_of_paste_events", 0)
    pasted_chars = metrics.get("total_pasted_characters", 0)
    total_typed = metrics.get("total_typed_characters", 0)
    
    if paste_events > 0:
        if pasted_chars > 150:
            warnings.append(f"Large paste event detected: {pasted_chars} characters pasted in a single event.")
        elif paste_events > 2:
            warnings.append(f"Multiple paste events ({paste_events}) detected within a single response.")
        else:
            warnings.append(f"Paste event detected: candidate pasted {pasted_chars} characters.")

    # 2. Typing speed deviation
    speed = metrics.get("average_typing_speed", 0.0)
    baseline_speed = baseline.get("baseline_typing_speed", 120.0)
    
    if speed > 0 and baseline_speed > 0:
        # If speed is more than 3x baseline and they didn't just paste everything
        if speed > (baseline_speed * 3.5) and paste_events == 0:
            warnings.append(f"Typing speed spike: candidate typing speed ({int(speed)} cpm) is {round(speed / baseline_speed, 1)}x their established baseline ({int(baseline_speed)} cpm).")

    # 3. Thinking time vs response length
    thinking_time = metrics.get("thinking_time", 0.0)
    baseline_thinking = baseline.get("baseline_thinking_time", 5.0)
    total_len = total_typed + pasted_chars

    if total_len > 100 and thinking_time < 0.8:
        warnings.append(f"Extremely fast response submission: candidate started typing/submitting a detailed answer ({total_len} chars) in {round(thinking_time, 2)} seconds (baseline thinking time is {round(baseline_thinking, 2)}s).")

    # 4. Long inactive periods followed by instant submission
    typing_duration = metrics.get("typing_duration", 0.0)
    if total_len > 100 and typing_duration < 1.0 and paste_events > 0:
        warnings.append(f"Instantaneous response submission: candidate submitted a long response ({total_len} chars) with less than 1 second of typing activity.")

    return warnings

def verify_project_background(project_title: str, resume_text: str, github_data: Any) -> Dict[str, Any]:
    """
    Uses the Groq LLM to verify if the project_title is present or semantically supported in the candidate's CV/GitHub.
    """
    if not project_title:
        return {"found": True, "evidence": "No project title provided for verification."}

    llm = get_llm()
    
    github_str = ""
    if isinstance(github_data, dict):
        github_str = json.dumps(github_data, indent=2)
    elif isinstance(github_data, list):
        github_str = json.dumps(github_data, indent=2)
    else:
        github_str = str(github_data or "")

    prompt = f"""You are a professional background screening specialist. Check if the project title provided by a candidate is semantically mentioned or supported in their Resume/CV text or GitHub repositories.
    
Candidate's Project Title: "{project_title}"

Resume / CV Text:
---
{resume_text or "No resume uploaded."}
---

GitHub Profile & Repositories:
---
{github_str or "No GitHub data."}
---

Analyze if this project (or a clearly similar project under a slightly different name, e.g. "shopping app" matching "e-commerce webstore") is present in their CV or GitHub.
Respond with a JSON object only. Do not include markdown code block formatting (like ```json ... ```) or any preamble/postamble.

JSON format:
{{
  "found": true/false,
  "evidence": "Detailed explanation of why it was found or why it is missing, citing specific repository names or resume lines."
}}"""

    try:
        response = llm.invoke([HumanMessage(content=prompt)])
        raw = response.content.strip()
        
        # Clean up any potential markdown wraps
        if "```" in raw:
            parts = raw.split("```")
            for part in parts:
                part = part.strip()
                if part.startswith("json"):
                    part = part[4:].strip()
                try:
                    return json.loads(part)
                except Exception:
                    continue
        return json.loads(raw)
    except Exception as e:
        print(f"Error in project background verification: {e}")
        # Substring matching fallback
        proj_lower = project_title.lower()
        cv_lower = (resume_text or "").lower()
        git_lower = github_str.lower()
        
        keywords = [w for w in proj_lower.split() if len(w) > 3]
        found = False
        if keywords:
            found = any(k in cv_lower or k in git_lower for k in keywords)
        else:
            found = proj_lower in cv_lower or proj_lower in git_lower
            
        evidence = f"Fallback keyword search checked project terms. Match status: {found}."
        return {"found": found, "evidence": evidence}

def calculate_risk_score(observations: List[Dict[str, Any]]) -> Tuple[str, List[str]]:
    """
    Calculates the cumulative Behavioral Risk Score (Low, Medium, High) based on points.
    Technical validation carries more weight than behavioral signals.
    """
    points = 0
    evidence_list = []

    for obs in observations:
        obs_type = obs.get("type")
        detail = obs.get("detail", "")
        
        if obs_type == "paste_large":
            points += 2
            evidence_list.append(f"Behavioral: {detail}")
        elif obs_type == "paste_multiple":
            points += 2
            evidence_list.append(f"Behavioral: {detail}")
        elif obs_type == "typing_speed_deviation":
            points += 2
            evidence_list.append(f"Behavioral: {detail}")
        elif obs_type == "short_thinking_time":
            points += 2
            evidence_list.append(f"Behavioral: {detail}")
        elif obs_type == "instant_submission":
            points += 2
            evidence_list.append(f"Behavioral: {detail}")
        elif obs_type == "pattern_low":
            points += 1
            evidence_list.append(f"Integrity Pattern (Low): {detail}")
        elif obs_type == "pattern_medium":
            points += 2
            evidence_list.append(f"Integrity Pattern (Medium): {detail}")
        elif obs_type == "pattern_high":
            points += 3
            evidence_list.append(f"Integrity Pattern (High): {detail}")
        elif obs_type == "project_missing":
            points += 1  # Weak signal
            evidence_list.append(f"Consistency: Stated project '{detail}' was not found in Resume/GitHub background.")
        elif obs_type == "inconsistency_detected":
            points += 1  # Weak signal
            evidence_list.append(f"Consistency: {detail}")
        elif obs_type == "failed_validation":
            points += 3  # Strong signal: failed technical explanation
            evidence_list.append(f"Technical: {detail}")
        elif obs_type == "successful_validation":
            points -= 2  # Redemption
            evidence_list.append(f"Verification: {detail}")

    # Risk level threshold
    if points <= 2:
        risk_level = "Low"
    elif points <= 5:
        risk_level = "Medium"
    else:
        risk_level = "High"

    # Limit to unique evidence strings
    unique_evidence = list(dict.fromkeys(evidence_list))
    
    return risk_level, unique_evidence

def analyze_consistency_and_understanding(
    last_answer: str,
    transcript: List[Dict[str, Any]],
    resume_text: str
) -> Dict[str, Any]:
    """
    Invokes the LLM to inspect the candidate's last answer against prior transcript answers and resume
    to identify contradictions, generic/theoretical answers, failed explanations, or successful technical validations.
    """
    if not last_answer or len(transcript) < 2:
        return {
            "inconsistency_detected": None,
            "failed_validation": None,
            "generic_answer": False,
            "successful_validation": None
        }

    llm = get_llm()
    
    # Format the chat history up to the last answer
    chat_history_str = ""
    for msg in transcript[:-1]:
        role = msg.get("role", "").upper()
        content = msg.get("content", "")
        chat_history_str += f"{role}: {content}\n"

    prompt = f"""You are an expert technical interviewer and integrity auditor. Analyze the candidate's latest response in the context of the prior interview transcript and their Resume.

Prior Interview Transcript:
{chat_history_str}

Candidate's Latest Response:
CANDIDATE: {last_answer}

Resume / CV Text:
{resume_text or "No resume uploaded."}

Perform three assessments:
1. Inconsistency Check: Does the latest response contradict previous statements or claimed resume experience (e.g. claiming different tech for the same project, conflicting timelines)?
2. Technical Understanding Check: Does the response show a clear failure to explain or understand the technical details of their claimed skills/projects (e.g. failing a follow-up verification question)? Or does it show successful, strong technical validation of their experience?
3. Generic Check: Is the response purely copy-pasted theoretical textbook text, or does it lack any personal project/practical detail?

Respond with a JSON object only. Do not include markdown code block formatting (like ```json ... ```) or any preamble/postamble.

JSON format:
{{
  "inconsistency_detected": "Brief description of the contradiction, or null if none",
  "failed_validation": "Brief description of why they failed to explain the concept/technology in follow-ups, or null if they succeeded",
  "generic_answer": true/false,
  "successful_validation": "Brief description of how they successfully validated/explained their practical experience, or null if they did not show high depth"
}}"""

    try:
        response = llm.invoke([HumanMessage(content=prompt)])
        raw = response.content.strip()
        
        # Clean up any potential markdown wraps
        if "```" in raw:
            parts = raw.split("```")
            for part in parts:
                part = part.strip()
                if part.startswith("json"):
                    part = part[4:].strip()
                try:
                    return json.loads(part)
                except Exception:
                    continue
        return json.loads(raw)
    except Exception as e:
        print(f"Error in analyze_consistency_and_understanding: {e}")
        return {
            "inconsistency_detected": None,
            "failed_validation": None,
            "generic_answer": False,
            "successful_validation": None
        }

def check_answer_patterns(metrics: Dict[str, Any], has_semantic_failure: bool) -> Dict[str, Any]:
    """
    Evaluates a single answer's telemetry metrics to detect suspicious combinations.
    Returns a dict with: {confidence: str or None, detail: str, penalty_pct: float}
    """
    if not metrics:
        return {"confidence": None, "detail": "", "penalty_pct": 0.0}

    copied = metrics.get("has_copied_question", False)
    blur_count = metrics.get("tab_lost_focus_count", 0)
    blur_duration = metrics.get("tab_lost_focus_duration", 0.0)
    pasted_chars = metrics.get("total_pasted_characters", 0)
    typed_chars = metrics.get("total_typed_characters", 0)

    # Flag definitions
    flag_copied = copied
    flag_blur = blur_count > 0 and blur_duration > 5.0
    flag_paste = pasted_chars > 150
    flag_low_typing = typed_chars < 50 and pasted_chars > 0

    flags = [flag_copied, flag_blur, flag_paste, flag_low_typing]
    flag_count = sum(1 for f in flags if f)

    # Pattern High: Copied + Blur (>5s) + Paste (>150) + Low typing (<50)
    if flag_copied and flag_blur and flag_paste and flag_low_typing:
        if has_semantic_failure:
            return {
                "confidence": "High",
                "detail": f"High confidence suspicious pattern: question copied from page, browser tab focus lost for {round(blur_duration, 1)}s, a large text segment of {pasted_chars} characters was pasted, and very little typing ({typed_chars} chars) was performed. Technical follow-up also confirmed failed technical validation or inconsistent details.",
                "penalty_pct": 20.0
            }
        else:
            # Downgrade to Medium penalty if they haven't failed validation yet
            return {
                "confidence": "Medium",
                "detail": f"Medium confidence suspicious pattern: question copied from page, browser tab focus lost for {round(blur_duration, 1)}s, and a large text segment of {pasted_chars} characters was pasted with minimal typing ({typed_chars} chars).",
                "penalty_pct": 7.5
            }

    # Pattern Medium: Copied + Blur (>5s) + Paste (>150)
    elif flag_copied and flag_blur and flag_paste:
        return {
            "confidence": "Medium",
            "detail": f"Medium confidence suspicious pattern: question copied from page, browser tab focus lost for {round(blur_duration, 1)}s, and {pasted_chars} characters were pasted.",
            "penalty_pct": 7.5
        }

    # Pattern Low: At least 2 indicators, e.g. Blur (>5s) + Paste (>150)
    elif flag_count >= 2:
        reasons = []
        if flag_copied: reasons.append("question copied")
        if flag_blur: reasons.append(f"tab focus lost for {round(blur_duration, 1)}s")
        if flag_paste: reasons.append(f"pasted {pasted_chars} characters")
        if flag_low_typing: reasons.append("minimal typing activity")
        
        return {
            "confidence": "Low",
            "detail": f"Low confidence suspicious pattern: combined anomalies ({', '.join(reasons)}).",
            "penalty_pct": 0.0
        }

    return {"confidence": None, "detail": "", "penalty_pct": 0.0}


