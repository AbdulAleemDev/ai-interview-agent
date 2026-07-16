"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Mail, 
  Lock, 
  ArrowRight, 
  Sun, 
  Moon, 
  Briefcase, 
  CheckCircle,
  MessageSquare,
  Sparkles,
  Eye,
  EyeOff,
  ShieldCheck,
  RefreshCw,
  ChevronLeft,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function LoginPage() {
  const router = useRouter();

  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(900);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  }, []);

  const startTimer = useCallback(() => {
    setSecondsLeft(900);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(timerRef.current!); return 0; }
        return s - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Incorrect email or password.");
      }
      setStep("otp");
      setOtp(["", "", "", "", "", ""]);
      setOtpError("");
      startTimer();
      setTimeout(() => otpInputsRef.current[0]?.focus(), 100);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to connect to server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    const otpValue = otp.join("");
    if (otpValue.length < 6) { setOtpError("Please enter the complete 6-digit OTP."); return; }
    if (secondsLeft === 0) { setOtpError("OTP has expired. Please go back and login again."); return; }
    setIsVerifying(true);
    setOtpError("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otpValue }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Invalid OTP.");
      }
      const data = await res.json();
      sessionStorage.setItem("adminToken", data.access_token);
      if (timerRef.current) clearInterval(timerRef.current);
      router.push("/admin-portal-secure/dashboard");
    } catch (err: any) {
      setOtpError(err.message || "OTP verification failed.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setOtpError("");
    setResendSuccess(false);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error("Failed to resend OTP.");
      setOtp(["", "", "", "", "", ""]);
      startTimer();
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 4000);
      setTimeout(() => otpInputsRef.current[0]?.focus(), 100);
    } catch (err: any) {
      setOtpError(err.message || "Could not resend OTP.");
    } finally {
      setIsResending(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) otpInputsRef.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) otpInputsRef.current[index - 1]?.focus();
    if (e.key === "Enter") handleVerifyOtp();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newOtp = [...otp];
    pasted.split("").forEach((char, i) => { newOtp[i] = char; });
    setOtp(newOtp);
    otpInputsRef.current[Math.min(pasted.length, 5)]?.focus();
  };

  const maskedEmail = email
    ? email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + "*".repeat(Math.max(1, b.length)) + c)
    : "";

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground transition-colors duration-300">
      <button onClick={toggleTheme} className="absolute top-6 right-6 p-2.5 rounded-full border border-border bg-card text-foreground hover:bg-muted transition-all duration-200 z-50 cursor-pointer shadow-sm" aria-label="Toggle theme">
        {theme === "dark" ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-slate-700" />}
      </button>

      {/* Left side branding */}
      <div className="hidden md:flex md:w-1/2 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex-col justify-between p-12 relative overflow-hidden border-r border-slate-200 dark:border-slate-900 transition-colors duration-300">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:30px_30px]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/5 dark:bg-blue-600/10 rounded-full blur-3xl" />
        <div className="relative z-10 flex items-center gap-2">
          <div className="p-2 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/20">
            <Briefcase className="h-6 w-6 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">Intervue.AI</span>
        </div>
        <div className="relative z-10 my-auto max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/20 dark:border-cyan-500/30 bg-cyan-500/5 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 text-xs font-medium mb-6 backdrop-blur-md">
            <Sparkles className="h-3 w-3" /> AI-Powered Mock Practice
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6 leading-tight">
            Perfect your interviews, <br />
            <span className="bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">secure the dream job.</span>
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg mb-8 leading-relaxed">Practice realistic mock interviews with specialized AI feedback custom-tailored to your industry and role requirements.</p>
          <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 backdrop-blur-md shadow-xl dark:shadow-2xl relative">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">AI Recruiter Feedback</h4>
                  <p className="text-xs text-slate-500">System Architect Role</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                <CheckCircle className="h-3.5 w-3.5" /> 88% Score
              </div>
            </div>
            <div className="space-y-3.5 text-sm">
              <div className="p-3 bg-slate-50/60 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-800/50">
                <span className="text-cyan-600 dark:text-cyan-400 font-semibold text-xs block mb-1">Key Strength</span>
                <p className="text-slate-700 dark:text-slate-300 text-xs">Strong explanation of microservices design patterns and scalability tradeoffs.</p>
              </div>
              <div className="p-3 bg-slate-50/60 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-800/50">
                <span className="text-amber-600 dark:text-amber-400 font-semibold text-xs block mb-1">Improvement Area</span>
                <p className="text-slate-700 dark:text-slate-300 text-xs">Consider providing concrete performance metrics for past project achievements.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
          <span>© 2026 Intervue.AI. All rights reserved.</span>
          <div className="flex gap-4">
            <a href="#" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>

      {/* Right side: Form Panel */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 lg:p-16 relative bg-grid-pattern">
        <div className="absolute inset-0 bg-radial-gradient pointer-events-none" />
        <div className="w-full max-w-md bg-card border border-border p-8 rounded-3xl shadow-xl backdrop-blur-sm transition-all duration-300 relative z-10">
          <div className="flex md:hidden items-center gap-2 mb-8">
            <div className="p-1.5 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-lg shadow-md">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">Intervue.AI</span>
          </div>

          {/* STEP 1: Credentials */}
          {step === "credentials" && (
            <>
              <div className="mb-8">
                <h2 className="text-3.5xl lg:text-4xl font-extrabold tracking-tight mb-2.5">
                  <span className="text-slate-950 dark:text-white">Admin </span>
                  <span className="text-primary">Portal</span>
                </h2>
                <p className="text-muted-foreground text-sm">Sign in with your admin credentials to access the dashboard.</p>
              </div>
              {errorMsg && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-xl text-center">{errorMsg}</div>
              )}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground"><Mail className="h-4.5 w-4.5" /></div>
                    <input type="email" id="email" required placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200 text-sm" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</label>
                    <a href="#" className="text-xs font-semibold text-primary hover:underline">Forgot password?</a>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground"><Lock className="h-4.5 w-4.5" /></div>
                    <input type={showPassword ? "text" : "password"} id="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-11 pr-11 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200 text-sm" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer" tabIndex={-1}>
                      {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between py-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="rounded border-border text-primary focus:ring-primary h-4 w-4 bg-background transition-colors" />
                    <span className="text-xs text-muted-foreground font-medium">Keep me signed in</span>
                  </label>
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed text-sm">
                  {isSubmitting ? <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><span>Continue</span><ArrowRight className="h-4 w-4" /></>}
                </button>
              </form>
              <div className="mt-8 text-center text-sm text-muted-foreground">
                Not an administrator?{" "}<Link href="/" className="text-primary font-semibold hover:underline">Return to Chatbot</Link>
              </div>
            </>
          )}

          {/* STEP 2: OTP Verification */}
          {step === "otp" && (
            <>
              <button onClick={() => { setStep("credentials"); setOtpError(""); if (timerRef.current) clearInterval(timerRef.current); }} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6 cursor-pointer">
                <ChevronLeft className="h-4 w-4" /> Back to login
              </button>
              <div className="flex flex-col items-center text-center mb-8">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 ring-4 ring-primary/20">
                  <ShieldCheck className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-extrabold tracking-tight mb-1">
                  <span className="text-slate-950 dark:text-white">Verify </span>
                  <span className="text-primary">Identity</span>
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">We sent a 6-digit code to<br /><span className="font-semibold text-foreground">{maskedEmail}</span></p>
              </div>
              <div className={`flex items-center justify-center gap-2 mb-6 text-sm font-semibold ${secondsLeft <= 60 ? "text-red-500" : "text-muted-foreground"}`}>
                <div className={`h-2 w-2 rounded-full animate-pulse ${secondsLeft <= 60 ? "bg-red-500" : "bg-primary"}`} />
                {secondsLeft > 0 ? <>OTP expires in <span className="font-mono tabular-nums">{formatTime(secondsLeft)}</span></> : <span className="text-red-500">OTP has expired</span>}
              </div>
              <div className="flex justify-center gap-3 mb-6">
                {otp.map((digit, i) => (
                  <input key={i} ref={(el) => { otpInputsRef.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    onPaste={i === 0 ? handleOtpPaste : undefined}
                    className={`h-14 w-12 text-center text-xl font-bold rounded-xl border-2 bg-background focus:outline-none transition-all duration-200 ${digit ? "border-primary text-primary" : "border-border text-foreground"} focus:border-primary focus:ring-2 focus:ring-primary/20`}
                  />
                ))}
              </div>
              {resendSuccess && (
                <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs rounded-xl text-center flex items-center justify-center gap-2">
                  <CheckCircle className="h-4 w-4" /> New OTP sent to your email!
                </div>
              )}
              {otpError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-xl text-center">{otpError}</div>
              )}
              <button onClick={handleVerifyOtp} disabled={isVerifying || otp.join("").length < 6 || secondsLeft === 0} className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed text-sm mb-4">
                {isVerifying ? <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><ShieldCheck className="h-4 w-4" /><span>Verify &amp; Sign In</span></>}
              </button>
              <div className="text-center">
                <span className="text-xs text-muted-foreground">Did not receive the code? </span>
                <button onClick={handleResend} disabled={isResending} className="text-xs text-primary font-semibold hover:underline cursor-pointer disabled:opacity-50 inline-flex items-center gap-1">
                  {isResending ? <><RefreshCw className="h-3 w-3 animate-spin" /> Sending...</> : <><RefreshCw className="h-3 w-3" /> Resend OTP</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
