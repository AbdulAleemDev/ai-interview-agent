"""
LangGraph-based AI Interview Agent using Groq LLM.

Phases:
  1. initial_questions (AI asks 2 general/role-specific questions)
  2. request_cv (AI asks candidate to upload CV and provide GitHub/LinkedIn links)
  3. deep_questions (AI validates answers against CV/GitHub/LinkedIn, and asks targeted deep follow-ups)
  4. done (Final evaluation and score generation)
"""

import os
import json
import random
from typing import List, Optional
from datetime import datetime
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

# -------------------------------------------------------------------
# Groq LLM
# -------------------------------------------------------------------
def get_llm() -> ChatGroq:
    api_key = os.getenv("GROQ_API_KEY", "")
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        api_key=api_key,
        temperature=0.8,
        max_tokens=1500,
    )

def safe_llm_invoke(messages: list, fallback_text: str = "") -> str:
    try:
        llm = get_llm()
        response = llm.invoke(messages)
        return response.content.strip()
    except Exception as e:
        print(f"Error calling Groq API: {e}")
        return fallback_text



# -------------------------------------------------------------------
# Prompts
# -------------------------------------------------------------------
def build_base_prompt(config: dict, candidate: dict, phase: str, questions_asked: int) -> str:
    skills = config.get("required_skills") or []
    skills_str = ", ".join(skills) if skills else "general technical skills"
    num_q = config.get("num_questions", 5)

    tone_map = {
        "Professional": "professional and formal",
        "Strict": "strict and highly challenging — push the candidate to think very deeply",
        "Technical": "extremely technical and detail-oriented — probe edge cases",
        "Friendly": "warm and encouraging while being genuinely thorough",
    }
    tone_desc = tone_map.get(config.get("interviewer_tone", "Professional"), "professional and formal")

    prompt = f"""You are an expert AI interviewer conducting a {config.get('experience_level', 'mid')}-level interview for the role of {config.get('job_title', 'Software Engineer')} in the {config.get('domain', 'Technology')} domain.

Job Description: {config.get('job_description', '')}
Required Skills: {skills_str}

Interview Settings:
- Total technical questions to ask: {num_q}
- Language: {config.get('language', 'English')}
- Tone: Be {tone_desc}

Candidate Details:
- Name: {candidate.get('name', 'Candidate')}
- Email: {candidate.get('email')}

CRITICAL INSTRUCTIONS FOR ALL DIALOGUE:
1. Be extremely direct, concise, and talk directly to the point.
2. Avoid welcome messages or repetitive greetings (e.g. "Welcome back", "Hello again", "Nice to meet you").
3. Do NOT include conversational filler, fluff, or praise (e.g. "I am impressed", "That is correct", "Nice work!", "Excellent answer").
4. Do NOT evaluate or comment on whether the candidate's previous response was right or wrong in your chat message. Just ask the next question immediately.
5. Keep your response strictly under 2-3 sentences. Extra sentences or irrelevant explanations are strictly prohibited.
6. Ask EXACTLY ONE question per response. Never ask compound, double, or multi-part questions (e.g., do NOT ask them to explain X AND Y, or scenario Z AND scenario W).
7. Never ask the candidate to write, output, or construct code blocks or lines of code. Focus solely on conceptual, high-level design, and practical explanations.
"""

    if phase == "initial_questions":
        prompt += f"""
Current Phase: INITIAL QUESTIONS (You are asking initial questions 1 and 2 out of {num_q} total questions).
Your behavior rules for this phase:
1. Do NOT ask for resume, CV, GitHub, or LinkedIn yet.
2. Ask ONE conceptual or basic scenario-based question at a time.
3. Keep your messages concise (2-4 sentences max per response).
4. Do NOT reveal you are an AI or simulated.
"""
    elif phase == "request_cv":
        prompt += f"""
Current Phase: REQUEST CV AND SOCIAL PROFILES
Your behavior rules for this phase:
1. Explain to the candidate that to proceed to the deep technical phase, they need to upload their CV/Resume and share their LinkedIn and GitHub profile links.
2. Keep it brief, inviting, and professional.
"""
    elif phase == "deep_questions":
        resume = candidate.get("resume_text") or ""
        github = candidate.get("github_data") or ""
        linkedin = candidate.get("linkedin_url") or ""
        portfolio = candidate.get("portfolio_url") or ""

        prompt += f"""
Current Phase: DEEP TECHNICAL & BACKGROUND VALIDATION (Questions {questions_asked + 1} to {num_q})
Candidate Background Resources:
- Extracted CV/Resume Text: {resume if resume else "Not uploaded yet"}
- GitHub Data: {github if github else "Not provided"}
- LinkedIn URL: {linkedin if linkedin else "Not provided"}
- Portfolio URL: {portfolio if portfolio else "Not provided"}

Your behavior rules for this phase:
1. Validate the candidate's answers from the initial questions phase against their CV, GitHub repositories, and LinkedIn profile!
2. Look for discrepancies or alignments:
   - Does their CV support the claims they made in their initial answers?
   - Do their GitHub projects demonstrate practical experience with the technologies they mentioned?
   - If they claimed experience with a skill (e.g. Docker, Next.js) in initial answers, but their CV has no mention of it or their GitHub repos don't reflect it, challenge them professionally and ask them to explain or elaborate.
3. Ask deep, context-aware technical questions based on their CV projects and social profile info.
4. Improve Follow-up Question Generation:
   - Whenever the candidate mentions a project, framework, library, technology, or design decision, generate adaptive follow-up questions verifying real-world understanding (e.g., why they chose that technology, what problem it solved, the biggest implementation challenge, how they debugged it, limitations encountered, or what they would improve/consider differently today).
   - Avoid abstract theoretical questions. Prefer practical project-specific verification.
5. Consistency Verification:
   - Maintain context of all previous interview responses. Scan for inconsistencies (e.g., different technologies for the same project, conflicting timelines or details).
   - If inconsistencies are detected, ask a friendly clarification question about them rather than drawing immediate conclusions.
6. Handle Generic Answers:
   - If a candidate's answer is overly generic or theoretical, do NOT classify it as AI-generated. Instead, ask verification questions such as requesting an implementation example from their own projects, bugs encountered, solutions applied, or trade-offs considered.
7. When you have asked all {num_q} questions and evaluated the final response, say exactly this on a new line: INTERVIEW_COMPLETE
"""

    return prompt


# -------------------------------------------------------------------
# Greet / Ask first question
# -------------------------------------------------------------------
def run_initial_greeting(config: dict, candidate: dict) -> str:
    base_prompt = build_base_prompt(config, candidate, "initial_questions", 0)
    
    messages = [
        SystemMessage(content=base_prompt),
        HumanMessage(content="[SYSTEM] Ask the first technical or scenario question directly (Question 1 of 2 initial questions) immediately without any welcoming introduction, filler, or fluff. Do NOT ask for CV or profile links yet. Keep it strictly concise (max 2 sentences). Ask exactly ONE simple question. Do NOT ask them to write code.")
    ]
    fallback = "Could you please describe a challenging project you worked on recently and the technologies you used?"
    return safe_llm_invoke(messages, fallback)


# -------------------------------------------------------------------
# Continue Interview: handles message logic based on phase
# -------------------------------------------------------------------
def run_interview_step(
    config: dict,
    candidate: dict,
    transcript: list,
    phase: str,
    questions_asked: int,
    follow_up_count: int,
) -> dict:
    """
    Evaluates the last candidate answer and decides the next response/question.
    Returns: {message, new_phase, new_questions_asked, new_follow_up_count, is_done}
    """
    num_q = config.get("num_questions", 5)

    base_prompt = build_base_prompt(config, candidate, phase, questions_asked)
    lc_messages = [SystemMessage(content=base_prompt)]
    
    for msg in transcript:
        if msg["role"] == "ai":
            lc_messages.append(AIMessage(content=msg["content"]))
        else:
            lc_messages.append(HumanMessage(content=msg["content"]))

    # Determine state transition logic
    if phase == "initial_questions":
        if questions_asked < 2:
            # Ask the second initial question
            lc_messages.append(HumanMessage(content=f"[SYSTEM] Ask Question {questions_asked + 1} of 2 initial questions directly. Do NOT welcome, praise, or comment on their previous response. Do NOT evaluate or say whether it is right or wrong. Ask the question immediately in 1-2 sentences. Do NOT ask for CV yet. Ask exactly ONE simple question. Do NOT ask them to write code."))
            fallback_q2 = "Got it. Can you explain your experience working with relational or non-relational databases in your projects?"
            ai_reply = safe_llm_invoke(lc_messages, fallback_q2)
            return {
                "message": ai_reply,
                "new_phase": "initial_questions",
                "new_questions_asked": questions_asked + 1,
                "new_follow_up_count": 0,
                "is_done": False
            }
        else:
            # We finished 2 initial questions. Move to "request_cv" phase.
            message = "Thank you for your responses so far. To proceed to the deep technical and validation phase of the interview, please upload your CV and share your LinkedIn or GitHub profile links. You can upload files (PDF or DOCX) using the uploader below."
            return {
                "message": message,
                "new_phase": "request_cv",
                "new_questions_asked": questions_asked,
                "new_follow_up_count": 0,
                "is_done": False
            }

    elif phase == "request_cv":
        # Candidate replied in chat instead of uploading (or alongside uploading)
        # Let's prompt them to upload/input links
        message = "Please upload your CV using the upload button and enter your LinkedIn/GitHub links to continue the interview."
        return {
            "message": message,
            "new_phase": "request_cv",
            "new_questions_asked": questions_asked,
            "new_follow_up_count": 0,
            "is_done": False
        }

    elif phase == "deep_questions":
        if questions_asked >= num_q:
            # All questions asked. Wrap up.
            lc_messages.append(HumanMessage(content="[SYSTEM] The candidate has answered all technical questions. Thank them and wrap up. Say exactly 'INTERVIEW_COMPLETE' on a new line at the end."))
            fallback_done = "Thank you for completing all technical sections. We have recorded your responses and generated your assessment evaluation.\nINTERVIEW_COMPLETE"
            ai_reply = safe_llm_invoke(lc_messages, fallback_done)
            is_done = "INTERVIEW_COMPLETE" in ai_reply
            clean_reply = ai_reply.replace("INTERVIEW_COMPLETE", "").strip()
            return {
                "message": clean_reply,
                "new_phase": "done" if is_done else "deep_questions",
                "new_questions_asked": questions_asked,
                "new_follow_up_count": 0,
                "is_done": is_done
            }
        else:
            # Ask next deep question, comparing against CV / GitHub
            system_instruction = f"[SYSTEM] Ask Question {questions_asked + 1} of {num_q} (technical follow-up or validation question) directly. Do NOT welcome, praise, or comment on their previous answer. Do NOT evaluate or say whether it is right or wrong. Ask the next question immediately in 1-2 sentences. Ask exactly ONE simple question. Do NOT ask them to write code."
            if candidate.get("generate_adaptive_verification"):
                system_instruction += "\nCRITICAL: A suspicious behavioral pattern was detected (e.g. copy-pasting or off-tab activity). You must ask a highly specific, challenging technical follow-up question to verify if the candidate truly understands the exact details of their last answer. Test their practical understanding deeply. Do NOT mention any copy-paste or cheat detection software."
            lc_messages.append(HumanMessage(content=system_instruction))
            fallback_deep = "Thanks for the detail. Can you describe the system architecture of a major backend service or project you worked on recently?"
            ai_reply = safe_llm_invoke(lc_messages, fallback_deep)
            return {
                "message": ai_reply,
                "new_phase": "deep_questions",
                "new_questions_asked": questions_asked + 1,
                "new_follow_up_count": 0,
                "is_done": False
            }

    # Fallback
    return {
        "message": "Interview phase error.",
        "new_phase": phase,
        "new_questions_asked": questions_asked,
        "new_follow_up_count": 0,
        "is_done": False
    }


# -------------------------------------------------------------------
# Transition from request_cv to deep_questions
# -------------------------------------------------------------------
def run_cv_transition_question(config: dict, candidate: dict, transcript: list, questions_asked: int) -> str:
    """
    Once CV is uploaded, transition to Phase 3: deep_questions.
    It reviews the initial answers, compares them to CV, and starts technical verification.
    """
    base_prompt = build_base_prompt(config, candidate, "deep_questions", questions_asked)
    lc_messages = [SystemMessage(content=base_prompt)]

    for msg in transcript:
        if msg["role"] == "ai":
            lc_messages.append(AIMessage(content=msg["content"]))
        else:
            lc_messages.append(HumanMessage(content=msg["content"]))

    project_title = candidate.get("project_title", "")
    project_missing = candidate.get("project_missing", False)
    
    extra_instruction = ""
    if project_missing and project_title:
        extra_instruction = f"""
        NOTE: The candidate's stated main project "{project_title}" was NOT found in their Resume/CV text or GitHub repositories.
        Do NOT accuse them of cheating. Instead, ask a polite, friendly clarification question about this project, requesting a short explanation of what it does, what technologies were used, and their role in it."""

    transition_prompt = f"""[SYSTEM] The candidate has successfully uploaded their CV and social profile links.
1. Perform a validation: Compare their initial technical answers with their CV/GitHub background.{extra_instruction}
2. If you notice any inconsistencies (e.g. talking about Next.js but their CV or GitHub is purely Java/Python) or highlight standard CV projects, form a question about it.
3. Ask Question {questions_asked + 1} of {config.get('num_questions')} directly. Do NOT welcome, praise, or comment on their background or answers. Do NOT say whether they are right or wrong. Ask the question immediately in 1-2 sentences.
Keep it direct, professional, and challenging!"""

    lc_messages.append(HumanMessage(content=transition_prompt))
    fallback_trans = "Thank you for uploading your CV and profile details. Looking at your background, could you please tell me about the most complex technical challenge you solved in your recent experience?"
    return safe_llm_invoke(lc_messages, fallback_trans)


# -------------------------------------------------------------------
# Evaluation
# -------------------------------------------------------------------
def run_final_evaluation(config: dict, candidate: dict, transcript: list) -> dict:
    llm = get_llm()
    skills_str = ", ".join(config.get("required_skills") or [])
    job_title = config.get("job_title", "the role")
    level = config.get("experience_level", "mid")

    conversation = "\n".join([
        f"{msg['role'].upper()}: {msg['content']}"
        for msg in transcript
        if msg["role"] in ("ai", "candidate")
    ])

    eval_prompt = f"""You are a senior technical hiring expert. Review the candidate's answers and their background (CV and social links) to generate an evaluation.

Required Skills: {skills_str}
Candidate: {candidate.get('name')}
CV Text: {candidate.get('resume_text', '')}
GitHub Data: {candidate.get('github_data', '')}

Interview Exchange:
{conversation}

Provide your evaluation as valid JSON only (no markdown, no extra text):
{{
  "score": <integer 0-100>,
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "weaknesses": ["<area to improve 1>", "<area to improve 2>", "<area to improve 3>"],
  "recommendation": "<Strongly Recommend | Recommend | Neutral | Do Not Recommend>",
  "summary": "<2-3 sentence summary of the candidate's technical skills and CV verification>"
}}"""

    try:
        response = llm.invoke([HumanMessage(content=eval_prompt)])
        raw = response.content.strip()
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
        print(f"Error parsing final evaluation JSON: {e}")
        return {
            "score": 60,
            "strengths": ["Completed the interview flow", "Shared social profiles and CV"],
            "weaknesses": ["Some answers lacked validation depth"],
            "recommendation": "Neutral",
            "summary": "Completed session. Review transcript manually for CV and social validation."
        }
