"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Briefcase, 
  Send, 
  Sparkles, 
  Sun, 
  Moon,
  Mic,
  RefreshCw,
  HelpCircle,
  Award,
  ChevronRight,
  Menu,
  X,
  MessageSquare,
  Lock,
  Play,
  Volume2,
  CheckCircle,
  AlertCircle,
  Star,
  TrendingUp,
  TrendingDown,
  User,
  Clock,
  Loader2,
  Upload,
  FileText,
  Code,
  Globe,
} from "lucide-react";

const API_BASE = "https://ai-interview-agent-production-93df.up.railway.app";

interface Message {
  id: string;
  sender: "ai" | "user";
  text: string;
  timestamp: string;
  responseTime?: number;
}

interface InterviewConfig {
  job_title: string;
  domain: string;
  experience_level: string;
  num_questions: number;
  duration: number;
  language: string;
  interviewer_tone: string;
}

interface EvaluationResult {
  score: number;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
  transcript: { role: string; content: string }[];
}

export default function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [speechSimulating, setSpeechSimulating] = useState(false);

  // Interview config from backend
  const [interviewConfig, setInterviewConfig] = useState<InterviewConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  // Session & Phase state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<"idle" | "active" | "completed">("idle");
  const [phase, setPhase] = useState<string>("initial_questions");
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);

  // User details state (Initial modal just Name/Email/Phone)
  const [showInstructions, setShowInstructions] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [clientInfo, setClientInfo] = useState<{ name: string; email: string; phone?: string } | null>(null);
  const [startingSession, setStartingSession] = useState(false);
  const [chatScrollTop, setChatScrollTop] = useState(0);

  // Phased CV and Social credentials inputs
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [githubInput, setGithubInput] = useState("");
  const [linkedinInput, setLinkedinInput] = useState("");
  const [isUploadingCv, setIsUploadingCv] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Response time tracking
  const questionShownAt = useRef<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Telemetry refs for keystroke logging
  const firstKeyTime = useRef<number | null>(null);
  const lastKeyTime = useRef<number | null>(null);
  const keystrokeTimestamps = useRef<number[]>([]);
  const backspaceCount = useRef<number>(0);
  const editCount = useRef<number>(0);
  const typedCharsCount = useRef<number>(0);
  const pastedCharsCount = useRef<number>(0);
  const pasteCount = useRef<number>(0);
  
  // Copy, Focus & Behavioral Timeline tracking refs
  const hasCopiedQuestion = useRef<boolean>(false);
  const tabLostFocusCount = useRef<number>(0);
  const tabLostFocusTotalDuration = useRef<number>(0);
  const lastBlurTime = useRef<number | null>(null);
  const behavioralTimeline = useRef<{ event: string; timestamp: string }[]>([]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!firstKeyTime.current) {
      firstKeyTime.current = Date.now();
    }
    lastKeyTime.current = Date.now();

    if (e.key === "Backspace") {
      backspaceCount.current += 1;
      editCount.current += 1;
    } else if (e.key === "Delete" || e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
      editCount.current += 1;
    } else if (e.key.length === 1) {
      typedCharsCount.current += 1;
      keystrokeTimestamps.current.push(Date.now());
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) {
        form.requestSubmit();
      }
    }
  };

  const handleInputPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (phase === "calibration") {
      e.preventDefault();
      alert("Pasting is disabled during the calibration phase. Please type your response.");
      return;
    }
    pasteCount.current += 1;
    const pastedText = e.clipboardData.getData("text") || "";
    pastedCharsCount.current += pastedText.length;
  };

  // Helper to compile previous questions and answers
  const getPreviousPairs = () => {
    const pairs: { id: string; question: string; answer: string }[] = [];
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].sender === "ai" && i + 1 < messages.length && messages[i+1].sender === "user") {
        pairs.push({
          id: `pair-${i}`,
          question: messages[i].text,
          answer: messages[i+1].text
        });
      }
    }
    return pairs;
  };

  // Helper to get current active (last AI) question
  const getCurrentQuestion = () => {
    const aiMsgs = messages.filter(m => m.sender === "ai");
    return aiMsgs.length > 0 ? aiMsgs[aiMsgs.length - 1] : null;
  };

  // Initialize theme
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  }, []);

  // Load interview config from backend on mount
  useEffect(() => {
    setConfigLoading(true);
    fetch(`${API_BASE}/api/interview/config`)
      .then(r => {
        if (!r.ok) throw new Error("No interview configured");
        return r.json();
      })
      .then(data => {
        setInterviewConfig(data);
        setConfigError(null);
      })
      .catch(err => {
        setConfigError("No interview is configured yet. Please ask the admin to set up an interview first.");
      })
      .finally(() => setConfigLoading(false));
  }, []);

  // Always show the instructions on page load
  useEffect(() => {
    setShowInstructions(true);
    setShowModal(false);
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Track when question is shown (for response time)
  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].sender === "ai") {
      questionShownAt.current = Date.now();
      // Reset telemetry metrics
      firstKeyTime.current = null;
      lastKeyTime.current = null;
      keystrokeTimestamps.current = [];
      backspaceCount.current = 0;
      editCount.current = 0;
      typedCharsCount.current = 0;
      pastedCharsCount.current = 0;
      pasteCount.current = 0;

      // Reset copy and tab tracking for the new question
      hasCopiedQuestion.current = false;
      tabLostFocusCount.current = 0;
      tabLostFocusTotalDuration.current = 0;
      lastBlurTime.current = null;
      behavioralTimeline.current = [
        { event: "Question displayed", timestamp: new Date().toISOString() }
      ];
    }
  }, [messages]);

  // Monitor copy, blur, and focus events during the active interview session
  useEffect(() => {
    if (sessionStatus !== "active") return;

    const handleGlobalCopy = () => {
      hasCopiedQuestion.current = true;
      behavioralTimeline.current.push({
        event: "Content copied from page",
        timestamp: new Date().toISOString()
      });
    };

    const handleGlobalBlur = () => {
      lastBlurTime.current = Date.now();
      behavioralTimeline.current.push({
        event: "Browser tab lost focus",
        timestamp: new Date().toISOString()
      });
    };

    const handleGlobalFocus = () => {
      if (lastBlurTime.current) {
        const blurDuration = (Date.now() - lastBlurTime.current) / 1000;
        tabLostFocusCount.current += 1;
        tabLostFocusTotalDuration.current += blurDuration;
        
        behavioralTimeline.current.push({
          event: `Browser tab regained focus (inactive for ${blurDuration.toFixed(1)}s)`,
          timestamp: new Date().toISOString()
        });
        
        lastBlurTime.current = null;
      }
    };

    window.addEventListener("copy", handleGlobalCopy);
    window.addEventListener("blur", handleGlobalBlur);
    window.addEventListener("focus", handleGlobalFocus);

    return () => {
      window.removeEventListener("copy", handleGlobalCopy);
      window.removeEventListener("blur", handleGlobalBlur);
      window.removeEventListener("focus", handleGlobalFocus);
    };
  }, [sessionStatus]);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  // Save user info and start session
  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim()) return;
    setModalError(null);
    setStartingSession(true);

    try {
      const res = await fetch(`${API_BASE}/api/interview/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_name: userName,
          candidate_email: userEmail,
          candidate_phone: userPhone || "",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        // Show error inside the modal (e.g. duplicate candidate)
        setModalError(err.detail || "Failed to start session. Please try again.");
        setStartingSession(false);
        return;
      }

      const data = await res.json();
      
      // Success — save info, close modal, set session state
      const info = { name: userName, email: userEmail, phone: userPhone };
      setClientInfo(info);
      setShowModal(false);
      setSessionId(data.session_id);
      setSessionStatus("active");
      setPhase(data.phase);

      // Show AI greeting
      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: data.message,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages([aiMsg]);
    } catch (err: any) {
      setModalError(err.message || "Network error. Please check your connection.");
    } finally {
      setStartingSession(false);
    }
  };

  // Start interview session with backend (used by restart / idle start buttons)
  const startSession = async (name: string, email: string, phone?: string) => {
    if (!interviewConfig) return;
    setStartingSession(true);
    setMessages([]);
    setEvaluation(null);
    setSessionStatus("idle");
    setPhase("initial_questions");

    try {
      const res = await fetch(`${API_BASE}/api/interview/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_name: name,
          candidate_email: email,
          candidate_phone: phone || "",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to start session");
      }

      const data = await res.json();
      setSessionId(data.session_id);
      setSessionStatus("active");
      setPhase(data.phase);

      // Show AI greeting
      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: data.message,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages([aiMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        sender: "ai",
        text: `⚠️ Could not start interview: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages([errorMsg]);
    } finally {
      setStartingSession(false);
    }
  };

  // Send message to backend
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputVal.trim() || !sessionId || sessionStatus !== "active") return;

    const responseTime = questionShownAt.current
      ? (Date.now() - questionShownAt.current) / 1000
      : null;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: inputVal,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      responseTime: responseTime ?? undefined,
    };

    setMessages(prev => [...prev, userMsg]);
    const sentText = inputVal;
    setInputVal("");
    setIsTyping(true);

    const typingDuration = lastKeyTime.current && firstKeyTime.current 
      ? (lastKeyTime.current - firstKeyTime.current) / 1000 
      : 0.0;
    const avgTypingSpeed = typingDuration > 0 
      ? (typedCharsCount.current * 60) / typingDuration 
      : 0.0;

    let numberOfPauses = 0;
    let totalPauseTime = 0;
    for (let i = 1; i < keystrokeTimestamps.current.length; i++) {
      const diff = keystrokeTimestamps.current[i] - keystrokeTimestamps.current[i-1];
      if (diff > 1500) {
        numberOfPauses += 1;
        totalPauseTime += diff / 1000;
      }
    }
    const avgPauseDuration = numberOfPauses > 0 ? totalPauseTime / numberOfPauses : 0.0;

    const telemetryMetrics = {
      question_shown_timestamp: questionShownAt.current ? new Date(questionShownAt.current).toISOString() : "",
      first_keystroke_timestamp: firstKeyTime.current ? new Date(firstKeyTime.current).toISOString() : null,
      last_keystroke_timestamp: lastKeyTime.current ? new Date(lastKeyTime.current).toISOString() : null,
      submit_timestamp: new Date().toISOString(),
      thinking_time: firstKeyTime.current && questionShownAt.current ? (firstKeyTime.current - questionShownAt.current) / 1000 : (responseTime || 0),
      typing_duration: typingDuration,
      average_typing_speed: avgTypingSpeed,
      number_of_pauses: numberOfPauses,
      average_pause_duration: avgPauseDuration,
      backspace_count: backspaceCount.current,
      edit_count: editCount.current,
      total_typed_characters: typedCharsCount.current,
      total_pasted_characters: pastedCharsCount.current,
      number_of_paste_events: pasteCount.current,
      has_copied_question: hasCopiedQuestion.current,
      tab_lost_focus_count: tabLostFocusCount.current,
      tab_lost_focus_duration: tabLostFocusTotalDuration.current,
      behavioral_timeline: behavioralTimeline.current
    };

    try {
      const res = await fetch(`${API_BASE}/api/interview/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          message: sentText,
          response_time_seconds: responseTime,
          behavioral_metrics: telemetryMetrics,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to send message");
      }

      const data = await res.json();
      const aiReply = data.message.replace("INTERVIEW_COMPLETE", "").trim();
      setPhase(data.phase);

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: aiReply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages(prev => [...prev, aiMsg]);

      if (data.status === "completed") {
        setSessionStatus("completed");
        // Fetch evaluation
        const resultRes = await fetch(`${API_BASE}/api/interview/result/${sessionId}`);
        if (resultRes.ok) {
          const result = await resultRes.json();
          setEvaluation({
            score: result.score,
            strengths: result.strengths || [],
            weaknesses: result.weaknesses || [],
            recommendation: result.recommendation,
            transcript: result.transcript || [],
          });
        }
      }
    } catch (err: any) {
      const errMsg: Message = {
        id: `err-${Date.now()}`,
        sender: "ai",
        text: `⚠️ ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleUploadCv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cvFile || !linkedinInput.trim() || !sessionId) {
      setUploadError("Please upload your CV and enter your LinkedIn profile URL.");
      return;
    }

    setIsUploadingCv(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", cvFile);
    if (githubInput) formData.append("github_url", githubInput);
    if (linkedinInput) formData.append("linkedin_url", linkedinInput);

    try {
      const res = await fetch(`${API_BASE}/api/interview/upload-cv/${sessionId}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to upload CV & links.");
      }

      const data = await res.json();
      setPhase(data.phase);

      // Add a nice local message showing upload confirmation
      const confirmationMsg: Message = {
        id: `user-upload-${Date.now()}`,
        sender: "user",
        text: `📂 CV uploaded successfully (${cvFile.name})${githubInput ? `\n🔗 GitHub: ${githubInput}` : ""}${linkedinInput ? `\n🔗 LinkedIn: ${linkedinInput}` : ""}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: data.message,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages(prev => [...prev, confirmationMsg, aiMsg]);
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setIsUploadingCv(false);
    }
  };

  // Restart interview
  const restartInterview = () => {
    setCvFile(null);
    setGithubInput("");
    setLinkedinInput("");
    setMessages([]);
    setEvaluation(null);
    setSessionStatus("idle");
    setSessionId(null);
    setUserName("");
    setUserEmail("");
    setUserPhone("");
    setModalError(null);
    setShowModal(true);
  };

  // Simulated Speech Input
  const startSpeechInput = () => {
    // Populate fake telemetry to simulate speaking/typing naturally
    firstKeyTime.current = Date.now() - 8000; // 8s ago
    lastKeyTime.current = Date.now() - 100;
    typedCharsCount.current = 145;
    backspaceCount.current = 2;
    editCount.current = 3;
    
    setSpeechSimulating(true);
    setInputVal("I would approach this by first analyzing the requirements and then implementing a solution that considers scalability, performance, and maintainability...");
    setTimeout(() => setSpeechSimulating(false), 1200);
  };

  // Score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-amber-500";
    return "text-red-500";
  };

  const getRecommendationColor = (rec: string) => {
    if (rec === "Strongly Recommend") return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
    if (rec === "Recommend") return "bg-cyan-500/10 text-cyan-600 border-cyan-500/30";
    if (rec === "Neutral") return "bg-amber-500/10 text-amber-600 border-amber-500/30";
    return "bg-red-500/10 text-red-600 border-red-500/30";
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground transition-colors duration-300 overflow-hidden">
      
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-6 h-16 shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 -ml-2 rounded-lg hover:bg-muted md:hidden cursor-pointer"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-lg shadow-md shadow-cyan-500/10">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              Intervue.AI
            </span>
          </div>

          {/* Live config badge */}
          {interviewConfig && (
            <div className="hidden md:flex items-center gap-2 ml-4 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {interviewConfig.job_title} · {interviewConfig.experience_level}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={toggleTheme}
            className="p-2.5 rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-1 relative overflow-hidden">
        
        {/* Sidebar */}
        <aside className={`
          absolute md:static top-0 bottom-0 left-0 w-80 bg-card border-r border-border p-6 flex flex-col justify-between transition-transform duration-300 z-20 overflow-y-auto h-full
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          md:w-72 lg:w-80
        `}>
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h2 className="font-bold text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-500" />
                Session Controls
              </h2>
              <button 
                onClick={() => setSidebarOpen(false)}
                className="p-1 rounded-lg hover:bg-muted md:hidden cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Interview Config Info */}
            {interviewConfig && (
              <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Active Interview
                </label>
                <div className="space-y-1 text-xs text-foreground">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Role</span>
                    <span className="font-medium">{interviewConfig.job_title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Level</span>
                    <span className="font-medium">{interviewConfig.experience_level}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Qs</span>
                    <span className="font-medium">{interviewConfig.num_questions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Language</span>
                    <span className="font-medium">{interviewConfig.language}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Phased flow progression tracker */}
            <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-2.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block border-b border-border pb-1">
                Interview Steps
              </label>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className={`h-4.5 w-4.5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    phase === "initial_questions" ? "bg-primary text-white" : "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30"
                  }`}>
                    {phase !== "initial_questions" ? "✓" : "1"}
                  </div>
                  <span className={phase === "initial_questions" ? "font-bold" : "text-muted-foreground"}>
                    Initial Screening Qs
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`h-4.5 w-4.5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    phase === "request_cv" ? "bg-primary text-white" : phase === "deep_questions" || phase === "done" ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30" : "bg-muted text-muted-foreground border border-border"
                  }`}>
                    {phase === "deep_questions" || phase === "done" ? "✓" : "2"}
                  </div>
                  <span className={phase === "request_cv" ? "font-bold" : "text-muted-foreground"}>
                    CV & Profile Verification
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`h-4.5 w-4.5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    phase === "deep_questions" ? "bg-primary text-white font-bold" : phase === "done" ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30" : "bg-muted text-muted-foreground border border-border"
                  }`}>
                    {phase === "done" ? "✓" : "3"}
                  </div>
                  <span className={phase === "deep_questions" ? "font-bold" : "text-muted-foreground"}>
                    Technical Deep Dive
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Candidate Info */}
          <div className="p-4 bg-muted/50 rounded-2xl border border-border">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center font-bold text-xs text-white">
                {clientInfo?.name?.[0]?.toUpperCase() || "?"}
              </div>
              <div>
                <h4 className="text-xs font-semibold">{clientInfo?.name || "Guest Candidate"}</h4>
                <p className="text-[10px] text-muted-foreground">{clientInfo?.email || "Not identified"}</p>
              </div>
            </div>
            {interviewConfig && (
              <div className="mt-3 pt-3 border-t border-border flex justify-between text-[10px] text-muted-foreground">
                <span>Duration: <strong>{interviewConfig.duration} min</strong></span>
                <span className={`font-medium capitalize ${sessionStatus === "active" ? "text-emerald-500" : sessionStatus === "completed" ? "text-blue-500" : "text-muted-foreground"}`}>
                  {sessionStatus === "active" ? "● Live" : sessionStatus === "completed" ? "✓ Completed" : "○ Idle"}
                </span>
              </div>
            )}
          </div>
        </aside>

        {/* Chat Interface */}
        <main className="flex-1 flex flex-col bg-background/50 relative bg-grid-pattern h-full overflow-hidden">
          
          {/* Chat Messages */}
          <div 
            onScroll={(e) => setChatScrollTop(e.currentTarget.scrollTop)}
            className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6 flex flex-col max-w-3xl mx-auto w-full relative z-10"
          >
            
            {/* Welcome Header */}
            <div className="border-b border-border bg-card/10 backdrop-blur-sm relative z-10 flex flex-col items-center justify-center text-center p-8 mb-4 rounded-3xl shrink-0">
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">
                Welcome, <span className="text-primary">{clientInfo?.name || "Candidate"}</span>!
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground max-w-lg">
                {configLoading
                  ? "Loading interview configuration..."
                  : configError
                  ? configError
                  : interviewConfig
                  ? `Phased technical screening for ${interviewConfig.job_title} · ${interviewConfig.num_questions} questions total`
                  : "Ready to begin your interview."}
              </p>
            </div>
            
            {/* Config error state */}
            {configError && !configLoading && (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                  <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground max-w-sm">{configError}</p>
                </div>
              </div>
            )}

            {/* Starting session indicator */}
            {startingSession && (
              <div className="flex gap-4">
                <div className="h-10 w-10 rounded-xl bg-slate-900 text-cyan-400 border border-slate-800 flex items-center justify-center text-xs font-bold shrink-0 shadow-md">
                  AI
                </div>
                <div className="p-4 bg-card border border-border rounded-2xl flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-500" />
                  Preparing your screening question...
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-4 ${msg.sender === "user" ? "flex-row-reverse" : ""}`}>
                {/* Avatar */}
                {msg.sender === "ai" ? (
                  <div className="h-10 w-10 rounded-xl bg-slate-900 text-cyan-400 border border-slate-800 flex items-center justify-center text-xs font-bold shrink-0 shadow-md">
                    AI
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-500 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-md">
                    {clientInfo?.name?.[0]?.toUpperCase() || "U"}
                  </div>
                )}

                <div className={`space-y-1.5 flex-1 ${msg.sender === "user" ? "items-end flex flex-col" : ""}`}>
                  <div className={`p-5 rounded-2xl shadow-sm text-sm leading-relaxed ${
                    msg.sender === "ai"
                      ? "bg-card border border-border text-foreground"
                      : "bg-primary text-white"
                  }`}>
                    <p className="whitespace-pre-line font-medium">{msg.text}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{msg.timestamp}</span>
                    {msg.sender === "user" && msg.responseTime && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />
                        {msg.responseTime.toFixed(1)}s
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* AI Typing Indicator */}
            {isTyping && (
              <div className="flex gap-4">
                <div className="h-10 w-10 rounded-xl bg-slate-900 text-cyan-400 border border-slate-800 flex items-center justify-center text-xs font-bold shrink-0 shadow-md">
                  AI
                </div>
                <div className="p-4 bg-card border border-border rounded-2xl flex items-center gap-1">
                  <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}

            {/* Final Evaluation Card */}
            {evaluation && sessionStatus === "completed" && (
              <div className="p-6 bg-card border border-border rounded-2xl w-full shadow-xl animate-fadeIn space-y-5">
                <div className="flex items-center gap-2 border-b border-border pb-4">
                  <Award className="h-5 w-5 text-cyan-500" />
                  <h4 className="font-bold text-base">Screening Evaluation Complete</h4>
                </div>

                {/* Score */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground font-medium">Overall Score</span>
                  <span className={`text-3xl font-extrabold ${getScoreColor(evaluation.score)}`}>
                    {evaluation.score}<span className="text-base text-muted-foreground">/100</span>
                  </span>
                </div>

                {/* Score bar */}
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      evaluation.score >= 80 ? "bg-emerald-500" : evaluation.score >= 60 ? "bg-amber-500" : "bg-red-500"
                    }`}
                    style={{ width: `${evaluation.score}%` }}
                  />
                </div>

                {/* Recommendation */}
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold ${getRecommendationColor(evaluation.recommendation)}`}>
                  <Star className="h-4 w-4" />
                  {evaluation.recommendation}
                </div>

                {/* Strengths & Areas to Improve */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wide">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Strengths
                    </div>
                    <ul className="space-y-1.5">
                      {evaluation.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wide">
                      <TrendingDown className="h-3.5 w-3.5" />
                      Areas to Improve
                    </div>
                    <ul className="space-y-1.5">
                      {evaluation.weaknesses.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                          <AlertCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-border bg-card/60 backdrop-blur-md">
            
            {/* Quick Actions */}
            {sessionStatus === "idle" && !startingSession && clientInfo && interviewConfig && (
              <div className="max-w-3xl mx-auto mb-3.5">
                <button
                  onClick={() => startSession(clientInfo.name, clientInfo.email, clientInfo.phone)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold text-sm transition-colors cursor-pointer shadow-lg shadow-primary/20"
                >
                  <Play className="h-4 w-4" />
                  Start Screening
                </button>
              </div>
            )}

            {/* Phase 1 & 3: Chat input form */}
            {sessionStatus === "active" && phase !== "request_cv" && (
              <form 
                onSubmit={handleSendMessage}
                className="max-w-3xl mx-auto flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={startSpeechInput}
                  className={`p-3 border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0
                    ${speechSimulating ? 'animate-pulse bg-cyan-500/10 border-cyan-500/30 text-cyan-500' : ''}
                  `}
                  title="Simulate Voice Input"
                >
                  <Mic className="h-5 w-5" />
                </button>

                <textarea
                  rows={2}
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  onPaste={handleInputPaste}
                  placeholder="Type your answer..."
                  className="flex-1 py-2.5 px-4 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-sm resize-none no-scrollbar"
                  disabled={isTyping}
                />

                <button
                  type="submit"
                  disabled={isTyping || !inputVal.trim()}
                  className="p-3 bg-primary hover:bg-primary/90 text-white rounded-xl shadow-md shadow-primary/20 transition-all flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {isTyping ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </button>
              </form>
            )}

            {/* Phase 2: Upload credentials form */}
            {sessionStatus === "active" && phase === "request_cv" && (
              <form 
                onSubmit={handleUploadCv}
                className="max-w-xl mx-auto p-5 bg-card/85 backdrop-blur-md border border-border rounded-2xl shadow-xl space-y-4 animate-fadeIn"
              >
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <Upload className="h-4.5 w-4.5 text-cyan-500" />
                  <h4 className="font-bold text-xs uppercase tracking-wide text-foreground">Upload screening credentials</h4>
                </div>

                {/* CV file input */}
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    CV / Resume File (PDF or DOCX) *
                  </label>
                  <input 
                    type="file"
                    required
                    accept=".pdf,.docx,.doc"
                    onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                  />
                </div>

                {/* GitHub & LinkedIn Side-by-Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <Code className="h-3.5 w-3.5" />
                      GitHub Profile URL
                    </label>
                    <input 
                      type="url"
                      placeholder="https://github.com/username"
                      value={githubInput}
                      onChange={(e) => setGithubInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <Globe className="h-3.5 w-3.5" />
                      LinkedIn Profile URL *
                    </label>
                    <input 
                      type="url"
                      required
                      placeholder="https://linkedin.com/in/username"
                      value={linkedinInput}
                      onChange={(e) => setLinkedinInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>

                {uploadError && (
                  <p className="text-[11px] text-red-500 font-medium">⚠️ {uploadError}</p>
                )}

                <button
                  type="submit"
                  disabled={isUploadingCv}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer disabled:opacity-75"
                >
                  {isUploadingCv ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Verifying details & parsing CV...
                    </>
                  ) : (
                    "Submit credentials & continue"
                  )}
                </button>
              </form>
            )}

            {/* Completed state */}
            {sessionStatus === "completed" && (
              <div className="max-w-3xl mx-auto text-center text-xs text-muted-foreground py-2">
                Interview completed. See your evaluation above.
              </div>
            )}
          </div>

        </main>
      </div>

      {/* Instructions Popup Modal */}
      {showInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-2xl relative animate-fadeIn space-y-6">
            
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-lg">
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Intervue.AI
              </span>
            </div>

            <div>
              <h2 className="text-xl font-bold tracking-tight mb-2">Technical Assessment Guidelines</h2>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Welcome to your automated AI technical screening. Please review the following instructions carefully before proceeding:
              </p>
            </div>

            <div className="space-y-4 text-xs text-foreground leading-relaxed">
              <div className="flex gap-3">
                <CheckCircle className="h-5 w-5 text-cyan-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-foreground">One Opportunity Only</h4>
                  <p className="text-muted-foreground mt-0.5">
                    You have exactly **one attempt** to complete this screening. Each candidate profile is restricted to a single submission.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-foreground">Do Not Refresh or Close</h4>
                  <p className="text-muted-foreground mt-0.5">
                    Refreshing, reloading, or navigating away from the page will immediately terminate the interview session and lock your attempt.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Sparkles className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-foreground">Integrity Monitoring</h4>
                  <p className="text-muted-foreground mt-0.5">
                    Our AI screening system actively logs behaviors like tab switching, browser window resizing, and copied text events to maintain assessment integrity.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <User className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-foreground">Provide Real Contact Details</h4>
                  <p className="text-muted-foreground mt-0.5">
                    You must submit your **authentic full name, email address, and phone number**. These details are utilized to schedule subsequent developer joining calls.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowInstructions(false);
                setShowModal(true);
              }}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 px-4 rounded-xl text-xs shadow hover:shadow-md transition-all cursor-pointer text-center block"
            >
              I Understood
            </button>
          </div>
        </div>
      )}

      {/* User Information Popup Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="w-full max-w-sm bg-card border border-border rounded-3xl p-8 shadow-2xl relative animate-fadeIn">
            
            <div className="flex items-center gap-2 mb-6">
              <div className="p-1.5 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-lg">
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Intervue.AI
              </span>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-bold tracking-tight mb-2">Begin Your Screening</h2>
              <p className="text-muted-foreground text-sm">
                Enter your basic details. The AI will ask screening questions and verify credentials dynamically.
              </p>
            </div>

            <form onSubmit={handleSaveInfo} className="space-y-4">
              {/* Error banner for duplicate candidates */}
              {modalError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5 animate-fadeIn">
                  <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium leading-relaxed">{modalError}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={userName}
                  onChange={(e) => { setUserName(e.target.value); setModalError(null); }}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="john@company.com"
                  value={userEmail}
                  onChange={(e) => { setUserEmail(e.target.value); setModalError(null); }}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+1 (555) 000-0000"
                  value={userPhone}
                  onChange={(e) => { setUserPhone(e.target.value); setModalError(null); }}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={startingSession}
                className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl transition-all duration-200 cursor-pointer text-sm mt-2 flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {startingSession ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Starting screening...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Start Screening
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
