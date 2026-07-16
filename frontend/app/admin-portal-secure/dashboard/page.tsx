"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Briefcase, 
  Users, 
  Search, 
  FileText, 
  Award, 
  Sun, 
  Moon, 
  LogOut, 
  X, 
  ZoomIn, 
  ZoomOut, 
  Download, 
  CheckCircle, 
  AlertCircle,
  Sparkles,
  Settings,
  Brain,
  Clock,
  HelpCircle,
  FileCheck,
  Eye,
  EyeOff,
  AlertTriangle,
  AlertOctagon,
  Trash2,
  Edit2,
  MoreVertical
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface ActivityLog {
  id: string;
  action: string;
  category: "security" | "training" | "settings";
  adminName: string;
  timestamp: string;
  details: string;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  score: number;
  role: string;
  date: string;
  resumeData: {
    summary: string;
    experience: string[];
    skills: string[];
    education: string;
  };
  recommendation?: string;
  strengths?: string[];
  weaknesses?: string[];
  transcript?: any[];
  integrity_data?: any;
}

const MOCK_CANDIDATES: Candidate[] = [];

const getIntegrityData = (cand: Candidate) => {
  if (cand.integrity_data) return cand.integrity_data;
  
  // Return realistic mock integrity data based on candidate score
  const isHighRisk = cand.score < 60;
  const isMedRisk = cand.score >= 60 && cand.score < 80;
  
  return {
    behavioral_risk_score: isHighRisk ? "High" : isMedRisk ? "Medium" : "Low",
    behavioral_baseline: {
      baseline_thinking_time: isHighRisk ? 1.2 : isMedRisk ? 3.5 : 4.8,
      baseline_typing_speed: isHighRisk ? 290.0 : isMedRisk ? 140.0 : 125.0,
      baseline_pauses_per_char: isHighRisk ? 0.01 : 0.05,
      baseline_backspace_rate: 0.04,
      baseline_edit_rate: 0.06
    },
    observations: isHighRisk 
      ? [
          { type: "paste_large", detail: "Large paste event detected: 850 characters pasted in a single response.", timestamp: "2026-07-15T05:00:00Z" },
          { type: "short_thinking_time", detail: "Extremely fast response submission: candidate started typing/submitting detailed answer in 0.4s.", timestamp: "2026-07-15T05:05:00Z" },
          { type: "project_missing", detail: "Stated project 'ApexAI User Validation' was not found in Resume/GitHub background.", timestamp: "2026-07-15T05:10:00Z" },
          { type: "failed_validation", detail: "Candidate was unable to explain structural performance trade-offs of Node.js cluster module in follow-up.", timestamp: "2026-07-15T05:12:00Z" }
        ]
      : isMedRisk
      ? [
          { type: "paste_multiple", detail: "Multiple paste events (3) detected within a single response.", timestamp: "2026-07-15T05:00:00Z" },
          { type: "inconsistency_detected", detail: "Inconsistency: Candidate mentioned using Docker containers for the microservices, but their resume only lists React frontend projects.", timestamp: "2026-07-15T05:08:00Z" },
          { type: "successful_validation", detail: "Candidate successfully explained the caching strategy using Redis when prompted.", timestamp: "2026-07-15T05:15:00Z" }
        ]
      : [
          { type: "successful_validation", detail: "Project 'TechSoft Next.js Migration' successfully matched and verified in Resume & GitHub.", timestamp: "2026-07-15T05:00:00Z" },
          { type: "successful_validation", detail: "Candidate successfully explained custom React hook optimizations with detailed code architecture.", timestamp: "2026-07-15T05:05:00Z" }
        ],
    evidence: isHighRisk
      ? [
          "Behavioral: One large paste event detected.",
          "Behavioral: Extremely fast response submission.",
          "Consistency: Stated project was not found in Resume/GitHub background.",
          "Technical: Candidate was unable to explain performance trade-offs in follow-up."
        ]
      : isMedRisk
      ? [
          "Behavioral: Multiple paste events (3) detected.",
          "Consistency: Candidate mentioned Docker microservices, but resume only lists React frontend.",
          "Verification: Candidate successfully explained Redis caching strategy when prompted."
        ]
      : [
          "Verification: Project successfully verified in Resume & GitHub.",
          "Verification: Candidate successfully explained React optimizations with detailed code."
        ]
  };
};

const getTranscript = (cand: Candidate) => {
  if (cand.transcript && cand.transcript.length > 0) return cand.transcript;
  
  // Return realistic mock transcript based on candidate score
  return [
    { role: "ai", content: `Welcome, ${cand.name}! Tell me about yourself in 2-3 sentences.`, timestamp: "10:00:00 AM" },
    { role: "candidate", content: cand.resumeData.summary, timestamp: "10:01:15 AM" },
    { role: "ai", content: `Excellent. Can you tell me more about your recent project: ${cand.resumeData.experience[0]?.split(" at ")[0] || "Software Architect"}?`, timestamp: "10:01:45 AM" },
    { role: "candidate", content: `Yes, in that project I worked on designing and implementing a clean code architecture. I resolved scalability bottlenecks by optimizing databases and implementing caching layers.`, timestamp: "10:03:00 AM" },
    { role: "ai", content: `Great. What specific performance limitations did you encounter and how did you resolve them?`, timestamp: "10:03:30 AM" },
    { role: "candidate", content: cand.score < 60 
        ? `We just restarted the server whenever it crashed under load. It was a simple workaround.`
        : `We encountered database lock contentions under heavy write loads. We resolved this by decoupling our ingestion pipeline with Kafka and caching hot metadata in Redis, reducing direct database hits by 60%.`, 
      timestamp: "10:05:00 AM" }
  ];
};

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"candidates" | "train" | "settings" | "logs">("candidates");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [theme, setTheme] = useState("dark");
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [modalTab, setModalTab] = useState<"resume" | "integrity">("resume");
  const [zoomLevel, setZoomLevel] = useState(100);

  // Train AI Form states
  const [jobTitle, setJobTitle] = useState("");
  const [domain, setDomain] = useState("AI/ML");
  const [domainsList, setDomainsList] = useState(["AI/ML", "Frontend", "Backend", "DevOps", "Data Science", "Product"]);
  const [showCustomDomainModal, setShowCustomDomainModal] = useState(false);
  const [customDomainInput, setCustomDomainInput] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("Junior");
  const [jobDescription, setJobDescription] = useState("");
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [numQuestions, setNumQuestions] = useState(10);
  const [duration, setDuration] = useState(30);
  const [language, setLanguage] = useState("English");
  const [interviewerTone, setInterviewerTone] = useState("Professional");
  const [isTraining, setIsTraining] = useState(false);
  const [trainSuccess, setTrainSuccess] = useState(false);

  // Settings Form states
  const [profileName, setProfileName] = useState("Admin Panel");
  const [profileEmail, setProfileEmail] = useState("admin@intervue.ai");
  const [profileRole, setProfileRole] = useState("Interview Coach");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  // Show/Hide password toggle states
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Admin list state
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);

  // Add new admin states
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminRole, setNewAdminRole] = useState("Interview Coach");
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [showNewAdminPassword, setShowNewAdminPassword] = useState(false);

  // Edit admin modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [editAdminName, setEditAdminName] = useState("");
  const [editAdminEmail, setEditAdminEmail] = useState("");
  const [editAdminPassword, setEditAdminPassword] = useState("");
  const [editAdminRole, setEditAdminRole] = useState("Interview Coach");
  const [isSavingEditAdmin, setIsSavingEditAdmin] = useState(false);
  const [showEditAdminPassword, setShowEditAdminPassword] = useState(false);

  // Dropdown states for admin rows
  const [activeDropdownAdminId, setActiveDropdownAdminId] = useState<string | null>(null);

  // Activity Log state
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [logCategoryFilter, setLogCategoryFilter] = useState<"all" | "security" | "training" | "settings">("all");

  const fetchLogs = async () => {
    const token = sessionStorage.getItem("adminToken");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/auth/logs`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        const list = data.map((d: any) => ({
          id: String(d.id),
          action: d.action,
          category: d.category,
          adminName: d.admin_name,
          timestamp: new Date(d.timestamp).toLocaleString(),
          details: d.details || ""
        }));
        setLogs(list);
      }
    } catch (err) {
      console.error("Failed to load activity logs:", err);
    }
  };

  const addLogEntry = async (action: string, category: "security" | "training" | "settings", details: string) => {
    const token = sessionStorage.getItem("adminToken");
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/auth/logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          action,
          category,
          admin_name: profileName,
          details
        })
      });
      fetchLogs();
    } catch (err) {
      console.error("Failed to create log entry:", err);
    }
  };

  const handleClearLogs = async () => {
    const token = sessionStorage.getItem("adminToken");
    if (!token) return;
    if (confirm("Are you sure you want to clear all activity logs?")) {
      try {
        const res = await fetch(`${API_BASE}/api/auth/logs`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (res.ok) {
          setLogs([]);
          setSettingsSuccess("All activity logs cleared successfully.");
          setTimeout(() => setSettingsSuccess(null), 4000);
        } else {
          const errData = await res.json().catch(() => ({}));
          alert(errData.detail || "Failed to clear activity logs.");
        }
      } catch (err: any) {
        alert(err.message || "An error occurred while clearing logs.");
      }
    }
  };

  const handleDeleteLog = async (logId: string) => {
    const token = sessionStorage.getItem("adminToken");
    if (!token) return;
    if (confirm("Are you sure you want to delete this activity log?")) {
      try {
        const res = await fetch(`${API_BASE}/api/auth/logs/${logId}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (res.ok) {
          setLogs(prev => prev.filter(l => l.id !== logId));
        } else {
          const errData = await res.json().catch(() => ({}));
          alert(errData.detail || "Failed to delete log entry.");
        }
      } catch (err: any) {
        alert(err.message || "An error occurred while deleting the log entry.");
      }
    }
  };

  // Reusable function to load active administrators from DB
  const fetchAdmins = async () => {
    const token = sessionStorage.getItem("adminToken");
    if (!token) {
      router.push("/admin-portal-secure");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/auth/list`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.status === 401) {
        sessionStorage.removeItem("adminToken");
        router.push("/admin-portal-secure");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        // Map to local AdminUser objects
        const list = data.map((d: any) => ({
          id: String(d.id),
          name: d.name,
          email: d.email,
          role: d.role
        }));
        setAdminUsers(list);
      }
    } catch (err) {
      console.error("Failed to load admin list:", err);
    }
  };

  const handleDeleteAdmin = async (adminId: string, adminName: string) => {
    const token = sessionStorage.getItem("adminToken");
    if (!token) return;
    
    if (confirm(`Are you sure you want to delete administrator "${adminName}"?`)) {
      try {
        const res = await fetch(`${API_BASE}/api/auth/delete-admin/${adminId}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "Failed to delete administrator.");
        }
        
        setSettingsSuccess(`Admin "${adminName}" deleted successfully.`);
        addLogEntry("Deleted Admin Account", "security", `Deleted administrator account for "${adminName}".`);
        fetchAdmins();
        setTimeout(() => setSettingsSuccess(null), 4000);
      } catch (err: any) {
        alert(err.message || "An error occurred while deleting the administrator.");
      }
    }
  };

  const handleEditClick = (admin: AdminUser) => {
    setEditingAdmin(admin);
    setEditAdminName(admin.name);
    setEditAdminEmail(admin.email);
    setEditAdminRole(admin.role);
    setEditAdminPassword("");
    setShowEditAdminPassword(false);
    setShowEditModal(true);
  };

  const handleSaveEditAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    if (!editAdminName.trim() || !editAdminEmail.trim()) return;
    
    setIsSavingEditAdmin(true);
    try {
      const token = sessionStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE}/api/auth/update-admin/${editingAdmin.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editAdminName,
          email: editAdminEmail,
          password: editAdminPassword.trim() ? editAdminPassword : undefined,
          role: editAdminRole
        })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to update administrator account.");
      }
      
      setSettingsSuccess(`Admin "${editAdminName}" updated successfully.`);
      addLogEntry("Updated Admin Account", "security", `Updated administrator details for "${editAdminName}".`);
      setShowEditModal(false);
      fetchAdmins();
      setTimeout(() => setSettingsSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || "An error occurred while saving the changes.");
    } finally {
      setIsSavingEditAdmin(false);
    }
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    } else {
      document.documentElement.classList.add("dark");
    }

    // Initial load of administrators
    fetchAdmins();
    fetchLogs();
    
    // Load current authenticated admin profile details from /me
    const fetchMe = async () => {
      const token = sessionStorage.getItem("adminToken");
      if (!token) {
        router.push("/admin-portal-secure");
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (res.status === 401) {
          sessionStorage.removeItem("adminToken");
          router.push("/admin-portal-secure");
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setProfileName(data.name);
          setProfileEmail(data.email);
          setProfileRole(data.role);
        }
      } catch (err) {
        console.error("Failed to load profile details:", err);
      }
    };

    // Load candidates from database
    const fetchCandidates = async () => {
      const token = sessionStorage.getItem("adminToken");
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/api/auth/candidates`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (res.ok) {
          const dbCandidates = await res.json();
          // Map DB candidates to Candidate interface
          const mappedList = dbCandidates.map((c: any) => ({
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone || "+1 (555) 019-9011",
            score: Math.round(c.score),
            role: c.role || "Software Engineer",
            date: c.date || new Date().toISOString().split("T")[0],
            resumeData: c.resumeData,
            recommendation: c.recommendation,
            strengths: c.strengths,
            weaknesses: c.weaknesses,
            transcript: c.transcript,
            integrity_data: c.integrity_data
          }));
          // Set DB candidates
          setCandidates(mappedList);
        }
      } catch (err) {
        console.error("Failed to fetch candidates:", err);
      }
    };

    fetchAdmins();
    fetchMe();
    fetchCandidates();
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const handleSelectCandidate = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const filteredIds = filteredCandidates.map(c => c.id);
    const allSelected = filteredIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedIds(prev => {
        const newSelection = [...prev];
        filteredIds.forEach(id => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to permanently delete the ${selectedIds.length} selected candidate(s)?`)) return;

    try {
      const token = sessionStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE}/api/auth/candidates/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ ids: selectedIds })
      });

      if (!res.ok) {
        throw new Error("Failed to delete candidates");
      }

      // Remove from states
      setCandidates(prev => prev.filter(c => !selectedIds.includes(c.id)));
      addLogEntry("Deleted Candidates", "settings", `Permanently deleted ${selectedIds.length} candidate record(s) from database.`);
      setSelectedIds([]);
    } catch (err: any) {
      alert(err.message || "An error occurred while deleting candidate(s)");
    }
  };

  const handleAddSkill = (e: React.KeyboardEvent | React.MouseEvent) => {
    if (e.type === "keydown" && (e as React.KeyboardEvent).key !== "Enter") return;
    if (e.type === "keydown") e.preventDefault(); // Prevent accidental form submission
    
    const trimmed = skillInput.trim();
    if (trimmed && !requiredSkills.includes(trimmed)) {
      setRequiredSkills([...requiredSkills, trimmed]);
      setSkillInput("");
    }
  };

  const handleRemoveSkill = (indexToRemove: number) => {
    setRequiredSkills(requiredSkills.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim() || !profileEmail.trim()) return;
    setIsSavingProfile(true);
    setSettingsSuccess(null);
    try {
      const token = sessionStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE}/api/auth/update-me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: profileName,
          email: profileEmail
        })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to update profile details.");
      }
      
      const updated = await res.json();
      setProfileName(updated.name);
      setProfileEmail(updated.email);
      setProfileRole(updated.role);
      
      setSettingsSuccess("Profile details updated successfully!");
      addLogEntry("Updated Profile Details", "settings", `Changed profile name to "${profileName}" and email to "${profileEmail}".`);
      fetchAdmins();
      setTimeout(() => setSettingsSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || "An error occurred while saving profile details.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) return;
    if (newPassword !== confirmPassword) {
      alert("New passwords do not match!");
      return;
    }
    
    setIsUpdatingPassword(true);
    setSettingsSuccess(null);
    try {
      const token = sessionStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE}/api/auth/update-me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          password: newPassword
        })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to update security credentials.");
      }
      
      setSettingsSuccess("Password changed successfully!");
      addLogEntry("Updated Admin Password", "security", "Successfully updated authorization password credentials.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setSettingsSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || "An error occurred while changing password.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleAddAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminName.trim() || !newAdminEmail.trim() || !newAdminPassword.trim()) return;
    setIsAddingAdmin(true);
    setSettingsSuccess(null);
    try {
      const token = sessionStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE}/api/auth/create-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newAdminName,
          email: newAdminEmail,
          password: newAdminPassword,
          role: newAdminRole
        })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to create administrator account.");
      }
      
      const createdAdmin = await res.json();
      
      // Update state list
      const newUser: AdminUser = {
        id: String(createdAdmin.id),
        name: createdAdmin.name,
        email: createdAdmin.email,
        role: createdAdmin.role
      };
      setAdminUsers(prev => [...prev, newUser]);
      setSettingsSuccess(`New Admin "${newAdminName}" created successfully!`);
      addLogEntry("Created New Admin Account", "security", `Registered new administrative user "${newAdminName}" with role "${newAdminRole}".`);
      
      // Reset inputs
      setNewAdminName("");
      setNewAdminEmail("");
      setNewAdminPassword("");
      setNewAdminRole("Interview Coach");
    } catch (err: any) {
      alert(err.message || "An error occurred while creating the admin.");
    } finally {
      setIsAddingAdmin(false);
    }
  };

  const handleTrainSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requiredSkills.length === 0) {
      alert("Please add at least one required skill!");
      return;
    }
    setIsTraining(true);
    setTrainSuccess(false);

    try {
      if (!domain.trim()) {
        alert("Please enter or select a domain!");
        setIsTraining(false);
        return;
      }

      const token = sessionStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE}/api/auth/train-interview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          job_title: jobTitle,
          domain,
          experience_level: experienceLevel,
          job_description: jobDescription,
          required_skills: requiredSkills,
          num_questions: numQuestions,
          duration,
          language,
          interviewer_tone: interviewerTone
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to save AI configuration to database.");
      }

      setIsTraining(false);
      setTrainSuccess(true);
      addLogEntry("Trained AI Mock Interview Model", "training", `Generated ${numQuestions} interview questions for role "${jobTitle}" (Domain: ${domain}, Exp: ${experienceLevel}) in ${language} with duration ${duration} min.`);
      
      // Clear form success alert after a brief time
      setTimeout(() => setTrainSuccess(false), 5000);
      
      // Reset form
      setJobTitle("");
      setJobDescription("");
      setRequiredSkills([]);
      setSkillInput("");
      setDomain("AI/ML");
      setLanguage("English");
      setInterviewerTone("Professional");
    } catch (err: any) {
      alert(err.message || "An error occurred while saving the configuration.");
      setIsTraining(false);
    }
  };

  const filteredCandidates = candidates.filter(cand => 
    cand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cand.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cand.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getScoreBadge = (score: number) => {
    if (score >= 85) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
          <CheckCircle className="h-3.5 w-3.5" />
          {score}/100
        </span>
      );
    }
    if (score >= 70) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold">
          <CheckCircle className="h-3.5 w-3.5" />
          {score}/100
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold">
        <AlertCircle className="h-3.5 w-3.5" />
        {score}/100
      </span>
    );
  };

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden flex flex-col md:flex-row bg-background text-foreground transition-colors duration-300">
      
      {/* Sidebar navigation */}
      <aside className="w-full md:w-64 bg-card border-r border-border p-6 flex flex-col justify-between shrink-0 md:h-screen md:overflow-y-auto">
        <div className="space-y-8">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-lg shadow-md shadow-cyan-500/10">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              Intervue.AI
            </span>
          </div>

          <nav className="space-y-1">
            <button 
              onClick={() => setActiveTab("candidates")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border cursor-pointer
                ${activeTab === "candidates"
                  ? "bg-primary/5 text-primary border-primary/20"
                  : "border-transparent hover:bg-muted text-muted-foreground hover:text-foreground"
                }
              `}
            >
              <Users className="h-4.5 w-4.5" />
              Candidates List
            </button>
            <button 
              onClick={() => setActiveTab("train")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border cursor-pointer
                ${activeTab === "train"
                  ? "bg-primary/5 text-primary border-primary/20"
                  : "border-transparent hover:bg-muted text-muted-foreground hover:text-foreground"
                }
              `}
            >
              <Sparkles className="h-4.5 w-4.5" />
              Train AI
            </button>
            <button 
              onClick={() => setActiveTab("settings")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border cursor-pointer
                ${activeTab === "settings"
                  ? "bg-primary/5 text-primary border-primary/20"
                  : "border-transparent hover:bg-muted text-muted-foreground hover:text-foreground"
                }
              `}
            >
              <Settings className="h-4.5 w-4.5" />
              Settings
            </button>
            <button 
              onClick={() => setActiveTab("logs")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border cursor-pointer
                ${activeTab === "logs"
                  ? "bg-primary/5 text-primary border-primary/20"
                  : "border-transparent hover:bg-muted text-muted-foreground hover:text-foreground"
                }
              `}
            >
              <FileText className="h-4.5 w-4.5" />
              Activity Log
            </button>
          </nav>
        </div>

        <div className="pt-6 border-t border-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center font-bold">
              {profileName ? profileName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "AD"}
            </div>
            <div className="max-w-[120px] overflow-hidden">
              <p className="font-semibold leading-none truncate" title={profileName}>{profileName}</p>
              <span className="text-[10px] text-muted-foreground truncate block mt-0.5" title={profileEmail}>{profileEmail}</span>
            </div>
          </div>
          <button 
            onClick={() => {
              sessionStorage.removeItem("adminToken");
              router.push("/admin-portal-secure");
            }}
            className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Main dashboard content area */}
      <main className="flex-1 p-8 overflow-y-auto bg-grid-pattern relative">
        <div className="absolute inset-0 bg-radial-gradient pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto space-y-8">
          
          {/* Candidates Tab View */}
          {activeTab === "candidates" && (
            <>
              {/* Header block */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">Candidates Overview</h1>
                  <p className="text-sm text-muted-foreground">Track applicant mock scores and analyze resumes.</p>
                </div>

                <div className="flex items-center gap-3">
                  {selectedIds.length > 0 && (
                    <button
                      onClick={handleDeleteSelected}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer animate-fadeIn"
                    >
                      Delete Selected ({selectedIds.length})
                    </button>
                  )}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                      <Search className="h-4.5 w-4.5" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search applicants..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full sm:w-64 pl-11 pr-4 py-2 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-sm shadow-sm"
                    />
                  </div>

                  <button 
                    onClick={toggleTheme}
                    className="p-2.5 rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
                    aria-label="Toggle theme"
                  >
                    {theme === "dark" ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-slate-700" />}
                  </button>
                </div>
              </div>

              {/* Stats widgets */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-card border border-border p-6 rounded-2xl shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-cyan-500/10 text-cyan-500 rounded-xl">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Candidates</p>
                    <h3 className="text-2xl font-bold">{candidates.length}</h3>
                  </div>
                </div>

                <div className="bg-card border border-border p-6 rounded-2xl shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-primary/10 text-primary rounded-xl">
                    <Award className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Average Score</p>
                    <h3 className="text-2xl font-bold">
                      {(candidates.reduce((acc, c) => acc + c.score, 0) / candidates.length).toFixed(1)}/100
                    </h3>
                  </div>
                </div>

                <div className="bg-card border border-border p-6 rounded-2xl shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Passing Applicants</p>
                    <h3 className="text-2xl font-bold">
                      {candidates.filter(c => c.score >= 70).length}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Candidates table card */}
              <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        <th className="py-4 px-6 w-12 text-center">
                          <input
                            type="checkbox"
                            className="rounded border-border bg-background focus:ring-ring cursor-pointer h-4 w-4"
                            checked={filteredCandidates.length > 0 && filteredCandidates.every(c => selectedIds.includes(c.id))}
                            onChange={handleSelectAll}
                          />
                        </th>
                        <th className="py-4 px-6">Name</th>
                        <th className="py-4 px-6">Target Role</th>
                        <th className="py-4 px-6">Contact Info</th>
                        <th className="py-4 px-6">Resume</th>
                        <th className="py-4 px-6 text-center">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-sm">
                      {filteredCandidates.map((cand) => (
                        <tr 
                          key={cand.id} 
                          className={`hover:bg-muted/10 transition-all ${selectedIds.includes(cand.id) ? 'bg-primary/5 dark:bg-primary/10' : ''}`}
                        >
                          <td className="py-4 px-6 text-center w-12">
                            <input
                              type="checkbox"
                              className="rounded border-border bg-background focus:ring-ring cursor-pointer h-4 w-4"
                              checked={selectedIds.includes(cand.id)}
                              onChange={() => handleSelectCandidate(cand.id)}
                            />
                          </td>
                          <td className="py-4 px-6 font-semibold">{cand.name}</td>
                          <td className="py-4 px-6 text-muted-foreground">{cand.role}</td>
                          <td className="py-4 px-6 space-y-1">
                            <div className="text-xs">{cand.email}</div>
                            <div className="text-[11px] text-muted-foreground">{cand.phone}</div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                               <button
                                 onClick={() => {
                                   setSelectedCandidate(cand);
                                   addLogEntry("Viewed Candidate Resume", "settings", `Opened document details for candidate ${cand.name} (${cand.role}).`);
                                 }}
                                 className="flex items-center gap-1.5 px-3 py-1.5 border border-border bg-background hover:bg-muted text-xs font-semibold rounded-xl transition-all cursor-pointer"
                                 title="View Parsed Resume Text"
                               >
                                 <FileText className="h-3.5 w-3.5 text-cyan-500" />
                                 View
                               </button>
                               <a
                                 href={`${API_BASE}/api/interview/download-cv/${cand.id}`}
                                 download
                                 className="flex items-center gap-1.5 px-3 py-1.5 border border-border bg-background hover:bg-muted text-xs font-semibold rounded-xl text-foreground transition-all cursor-pointer"
                                 title="Download Original Resume File"
                               >
                                 <Download className="h-3.5 w-3.5 text-emerald-500" />
                                 Download
                               </a>
                             </div>
                          </td>
                          <td className="py-4 px-6 text-center">{getScoreBadge(cand.score)}</td>
                        </tr>
                      ))}
                      {filteredCandidates.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-muted-foreground italic">
                            No candidates found matching your criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Train AI / Prepare Interview Form Tab View */}
          {activeTab === "train" && (
            <div className="max-w-3xl mx-auto space-y-6">
              
              <div className="flex items-center justify-between border-b border-border pb-6">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
                    <Brain className="h-8 w-8 text-cyan-500" />
                    Train AI Recruiter
                  </h1>
                  <p className="text-sm text-muted-foreground">Configure job specs to train the AI interviewer mock models.</p>
                </div>

                <button 
                  onClick={toggleTheme}
                  className="p-2.5 rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
                  aria-label="Toggle theme"
                >
                  {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
                </button>
              </div>

              {trainSuccess && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl text-sm flex items-center gap-2.5 animate-fadeIn">
                  <CheckCircle className="h-5 w-5 shrink-0" />
                  <div>
                    <span className="font-bold">Success!</span> The AI Recruiter has been successfully trained for this interview model.
                  </div>
                </div>
              )}

              <div className="bg-card border border-border p-8 rounded-3xl shadow-md backdrop-blur-sm">
                <form onSubmit={handleTrainSubmit} className="space-y-6">
                  
                  {/* Job Title & Domain */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Job Title
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Junior AI Engineer"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Domain
                      </label>
                      <select
                        value={domain}
                        onChange={(e) => {
                          if (e.target.value === "Custom") {
                            setShowCustomDomainModal(true);
                          } else {
                            setDomain(e.target.value);
                          }
                        }}
                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-sm cursor-pointer"
                      >
                        {domainsList.map((dom) => (
                          <option key={dom} value={dom}>{dom}</option>
                        ))}
                        <option value="Custom">+ Add Custom Domain...</option>
                      </select>
                    </div>
                  </div>

                  {/* Experience Level & Required Skills */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Experience Level
                      </label>
                      <select
                        value={experienceLevel}
                        onChange={(e) => setExperienceLevel(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-sm cursor-pointer"
                      >
                        <option value="Fresher">Fresher (Entry Level)</option>
                        <option value="Junior">Junior (1-2 years)</option>
                        <option value="Mid">Mid Level (3-5 years)</option>
                        <option value="Senior">Senior (5+ years)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Required Skills (Type and press Enter or click +)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. Python"
                          value={skillInput}
                          onChange={(e) => setSkillInput(e.target.value)}
                          onKeyDown={handleAddSkill}
                          className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-sm"
                        />
                        <button
                          type="button"
                          onClick={handleAddSkill}
                          className="px-4 py-2 bg-muted text-foreground border border-border hover:bg-background rounded-xl text-sm font-semibold transition-all cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                      
                      {/* Active Tag Pills Container */}
                      <div className="flex flex-wrap gap-2 mt-1.5 min-h-[36px]">
                        {requiredSkills.map((skill, idx) => (
                          <span 
                            key={idx} 
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-semibold select-none animate-fadeIn"
                          >
                            {skill}
                            <button
                              type="button"
                              onClick={() => handleRemoveSkill(idx)}
                              className="text-primary hover:text-red-500 transition-colors cursor-pointer text-[10px]"
                              aria-label={`Remove ${skill}`}
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                        {requiredSkills.length === 0 && (
                          <span className="text-xs text-muted-foreground italic py-1">No skills added yet.</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Job Description */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Job Description
                    </label>
                    <textarea
                      required
                      rows={5}
                      placeholder="Paste the core responsibilities and job criteria here..."
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-sm"
                    />
                  </div>

                  {/* Question count & duration limits */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                        <HelpCircle className="h-4 w-4 text-cyan-500" />
                        Number of Questions
                      </label>
                      <input
                        type="number"
                        required
                        min={5}
                        max={30}
                        value={numQuestions}
                        onChange={(e) => setNumQuestions(Number(e.target.value))}
                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-cyan-500" />
                        Interview Duration (Minutes)
                      </label>
                      <input
                        type="number"
                        required
                        min={10}
                        max={120}
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-sm"
                      />
                    </div>
                  </div>

                  {/* Interview Language & Interviewer Tone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Interview Language
                      </label>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-sm cursor-pointer"
                      >
                        <option value="English">English</option>
                        <option value="Urdu">Urdu</option>
                        <option value="Spanish">Spanish</option>
                        <option value="German">German</option>
                        <option value="French">French</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Interviewer Tone
                      </label>
                      <select
                        value={interviewerTone}
                        onChange={(e) => setInterviewerTone(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-sm cursor-pointer"
                      >
                        <option value="Professional">Professional</option>
                        <option value="Strict">Strict (Challenging)</option>
                        <option value="Technical">Technical Focused</option>
                        <option value="Friendly">Friendly & Encouraging</option>
                      </select>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isTraining}
                    className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed text-sm mt-4"
                  >
                    {isTraining ? (
                      <>
                        <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Launching Interview...
                      </>
                    ) : (
                      <>
                        <Brain className="h-4.5 w-4.5" />
                        Launch Interview
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Settings Tab View */}
          {activeTab === "settings" && (
            <div className="max-w-2xl mx-auto space-y-8">
              
              <div className="flex items-center justify-between border-b border-border pb-6">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
                    <Settings className="h-8 w-8 text-cyan-500" />
                    Admin Settings
                  </h1>
                  <p className="text-sm text-muted-foreground">Manage your credentials and configuration options.</p>
                </div>

                <button 
                  onClick={toggleTheme}
                  className="p-2.5 rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
                  aria-label="Toggle theme"
                >
                  {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
                </button>
              </div>

              {settingsSuccess && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl text-sm flex items-center gap-2.5 animate-fadeIn">
                  <CheckCircle className="h-5 w-5 shrink-0" />
                  <div>{settingsSuccess}</div>
                </div>
              )}

              {/* Profile card */}
              <div className="bg-card border border-border p-8 rounded-3xl shadow-sm space-y-6">
                <div>
                  <h2 className="text-lg font-bold">Profile Settings</h2>
                  <p className="text-xs text-muted-foreground">Update your identity and administrator contact emails.</p>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={profileEmail}
                        onChange={(e) => setProfileEmail(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-sm"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="bg-primary hover:bg-primary/90 text-white font-semibold py-2 px-4 rounded-xl text-xs shadow hover:shadow-md transition-all cursor-pointer disabled:opacity-75"
                  >
                    {isSavingProfile ? "Saving Profile..." : "Save Profile Details"}
                  </button>
                </form>
              </div>

              {/* Password card */}
              <div className="bg-card border border-border p-8 rounded-3xl shadow-sm space-y-6">
                <div>
                  <h2 className="text-lg font-bold">Security & Password</h2>
                  <p className="text-xs text-muted-foreground">Update your current administrator authorization password.</p>
                </div>

                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        required
                        placeholder="••••••••"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full pl-4 pr-11 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                        title={showCurrentPassword ? "Hide password" : "Show password"}
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          required
                          placeholder="••••••••"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full pl-4 pr-11 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                          title={showNewPassword ? "Hide password" : "Show password"}
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          required
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full pl-4 pr-11 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                          title={showConfirmPassword ? "Hide password" : "Show password"}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="bg-primary hover:bg-primary/90 text-white font-semibold py-2 px-4 rounded-xl text-xs shadow hover:shadow-md transition-all cursor-pointer disabled:opacity-75"
                  >
                    {isUpdatingPassword ? "Updating Security..." : "Change Password"}
                  </button>
                </form>
              </div>

              {/* Administrator Management card */}
              <div className="bg-card border border-border p-8 rounded-3xl shadow-sm space-y-6">
                <div>
                  <h2 className="text-lg font-bold">Administrator Management</h2>
                  <p className="text-xs text-muted-foreground">List active administrators and grant administrator privileges to new members.</p>
                </div>

                {(() => {
                  const canManageAdmins = profileRole === "Super Admin" || profileEmail === "aleemman1234@gmail.com";
                  return (
                    <div className={canManageAdmins ? "grid grid-cols-1 md:grid-cols-2 gap-8" : "max-w-md"}>
                      {/* Left Column: Active Admin List */}
                      <div className="space-y-4">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Current Administrators ({adminUsers.length})
                        </h3>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                          {adminUsers.map((admin, idx) => {
                            const isSelf = admin.email === profileEmail;
                            const isSeedAdmin = admin.email === "aleemman1234@gmail.com";
                            const isClickableBox = isSeedAdmin && isSelf;
                            const isLoggedAsSeed = profileEmail === "aleemman1234@gmail.com";

                            return (
                              <div 
                                key={admin.id} 
                                onClick={isClickableBox ? () => handleEditClick(admin) : undefined}
                                className={`p-3 bg-muted/40 rounded-xl border border-border flex items-center justify-between text-xs transition-all relative
                                  ${isClickableBox 
                                    ? "hover:bg-muted/65 cursor-pointer" 
                                    : "hover:bg-muted/50"
                                  }
                                `}
                                title={isClickableBox ? "Click to view or edit your credentials" : undefined}
                              >
                                {/* Backdrop to close other active dropdowns when clicked */}
                                {activeDropdownAdminId === admin.id && (
                                  <div 
                                    className="fixed inset-0 z-10" 
                                    onClick={() => setActiveDropdownAdminId(null)}
                                  />
                                )}

                                <div className="space-y-0.5">
                                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                                    {admin.name}
                                    {isSelf && <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.2 rounded-md font-normal">You</span>}
                                  </p>
                                  <p className="text-muted-foreground text-[10px]">{admin.email}</p>
                                </div>
                                <div className="flex items-center gap-2 relative z-20">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                                    ${admin.role === "Super Admin"
                                      ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    }
                                  `}>
                                    {admin.role}
                                  </span>

                                  {isLoggedAsSeed && !isSeedAdmin && (
                                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        type="button"
                                        onClick={() => setActiveDropdownAdminId(activeDropdownAdminId === admin.id ? null : admin.id)}
                                        className="p-1 hover:bg-muted-foreground/10 text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
                                        title="Actions"
                                      >
                                        <MoreVertical className="h-4 w-4" />
                                      </button>

                                      {activeDropdownAdminId === admin.id && (
                                        <div className={`absolute right-0 w-28 bg-card border border-border rounded-xl shadow-xl z-30 py-1 overflow-hidden animate-fadeIn ${idx === 0 ? "top-full mt-1" : "bottom-full mb-1"}`}>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              handleEditClick(admin);
                                              setActiveDropdownAdminId(null);
                                            }}
                                            className="w-full px-3 py-1.5 text-left text-[11px] hover:bg-muted text-foreground transition-colors cursor-pointer"
                                          >
                                            View
                                          </button>
                                          <button
                                            type="button"
                                            disabled={isSelf}
                                            onClick={() => {
                                              handleDeleteAdmin(admin.id, admin.name);
                                              setActiveDropdownAdminId(null);
                                            }}
                                            className={`w-full px-3 py-1.5 text-left text-[11px] border-t border-border/40 transition-colors
                                              ${isSelf
                                                ? "text-muted-foreground/40 cursor-not-allowed bg-muted/5"
                                                : "hover:bg-red-500/10 text-red-500 cursor-pointer"
                                              }
                                            `}
                                            title={isSelf ? "You cannot delete your own account" : "Delete Administrator"}
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Right Column: Add Admin Form */}
                      {canManageAdmins && (
                        <div className="space-y-4">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Add New Administrator
                          </h3>
                          
                          <form onSubmit={handleAddAdminSubmit} className="space-y-4">
                            <div>
                              <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                Full Name
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="e.g. Rohail Khan"
                                value={newAdminName}
                                onChange={(e) => setNewAdminName(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                Email Address
                              </label>
                              <input
                                type="email"
                                required
                                placeholder="e.g. rohail@intervue.ai"
                                value={newAdminEmail}
                                onChange={(e) => setNewAdminEmail(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                Password
                              </label>
                              <div className="relative">
                                <input
                                  type={showNewAdminPassword ? "text" : "password"}
                                  required
                                  placeholder="••••••••"
                                  value={newAdminPassword}
                                  onChange={(e) => setNewAdminPassword(e.target.value)}
                                  className="w-full pl-4 pr-11 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowNewAdminPassword(!showNewAdminPassword)}
                                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                                  title={showNewAdminPassword ? "Hide password" : "Show password"}
                                >
                                  {showNewAdminPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                Access Level Role
                              </label>
                              <select
                                value={newAdminRole}
                                onChange={(e) => setNewAdminRole(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-xs cursor-pointer"
                              >
                                <option value="Interview Coach">Interview Coach</option>
                                <option value="Super Admin">Super Admin</option>
                              </select>
                            </div>

                            <button
                              type="submit"
                              disabled={isAddingAdmin}
                              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-2.5 px-4 rounded-xl text-xs shadow hover:shadow-md transition-all cursor-pointer disabled:opacity-75"
                            >
                              {isAddingAdmin ? "Creating Credentials..." : "Create Administrator Account"}
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Activity Log Tab View */}
          {activeTab === "logs" && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
                    <FileText className="h-8 w-8 text-cyan-500" />
                    Activity Logs
                  </h1>
                  <p className="text-sm text-muted-foreground">Monitor administrative actions and database records in real-time.</p>
                </div>

                <div className="flex items-center gap-3">
                  {profileEmail === "aleemman1234@gmail.com" && (
                    <button 
                      onClick={handleClearLogs}
                      className="px-4 py-2 text-xs font-semibold border border-border bg-card hover:bg-muted text-red-500 rounded-xl transition-all cursor-pointer"
                    >
                      Clear Logs
                    </button>
                  )}

                  <button 
                    onClick={toggleTheme}
                    className="p-2.5 rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
                    aria-label="Toggle theme"
                  >
                    {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
                  </button>
                </div>
              </div>

              {/* Filtering block */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-4 rounded-2xl">
                <div className="flex flex-wrap gap-2">
                  {(["all", "security", "training", "settings"] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setLogCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer
                        ${logCategoryFilter === cat
                          ? "bg-primary/10 text-primary border-primary/25"
                          : "border-transparent text-muted-foreground hover:bg-muted"
                        }
                      `}
                    >
                      {cat === "all" && "All"}
                      {cat === "security" && "Security"}
                      {cat === "training" && "Training"}
                      {cat === "settings" && "Setting"}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                    <Search className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-xs"
                  />
                </div>
              </div>

              {/* Logs chronological list */}
              <div className="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
                <div className="flow-root">
                  <ul className="-mb-8">
                    {logs
                      .filter(log => logCategoryFilter === "all" || log.category === logCategoryFilter)
                      .filter(log => 
                        log.action.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
                        log.details.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
                        log.adminName.toLowerCase().includes(logSearchQuery.toLowerCase())
                      )
                      .map((log, logIdx, filteredList) => (
                        <li key={log.id}>
                          <div className="relative pb-8">
                            {logIdx !== filteredList.length - 1 ? (
                              <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-border" aria-hidden="true" />
                            ) : null}
                            <div className="relative flex space-x-3">
                              <div>
                                <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-card
                                  ${log.category === "security" ? "bg-amber-500/10 text-amber-500" : ""}
                                  ${log.category === "training" ? "bg-emerald-500/10 text-emerald-500" : ""}
                                  ${log.category === "settings" ? "bg-purple-500/10 text-purple-500" : ""}
                                `}>
                                  <FileText className="h-4 w-4" />
                                </span>
                              </div>
                              <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                                <div>
                                  <p className="text-sm font-semibold text-foreground">
                                    {log.action}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {log.details}
                                  </p>
                                  <div className="flex items-center gap-2 mt-2">
                                    <span className="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                                      By: {log.adminName}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded capitalize">
                                      Category: {log.category === "settings" ? "setting" : log.category}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right text-xs whitespace-nowrap text-muted-foreground font-mono flex flex-col items-end gap-1.5">
                                  <span>{log.timestamp}</span>
                                  {profileEmail === "aleemman1234@gmail.com" && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteLog(log.id)}
                                      className="text-red-500 hover:text-red-600 transition-colors p-1 hover:bg-red-500/10 rounded-lg cursor-pointer"
                                      title="Delete Log Entry"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    {logs
                      .filter(log => logCategoryFilter === "all" || log.category === logCategoryFilter)
                      .filter(log => 
                        log.action.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
                        log.details.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
                        log.adminName.toLowerCase().includes(logSearchQuery.toLowerCase())
                      ).length === 0 && (
                      <div className="py-12 text-center text-muted-foreground italic text-sm">
                        No activity logs captured yet.
                      </div>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Resume Document Viewer Modal */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="w-full max-w-4xl h-[90vh] bg-card border border-border rounded-3xl flex flex-col overflow-hidden shadow-2xl relative animate-fadeIn">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-border bg-muted/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="font-bold text-sm leading-none">{selectedCandidate.name}</h3>
                <span className="text-[10px] text-muted-foreground">{selectedCandidate.role}</span>
              </div>

              {/* Tab Switcher */}
              <div className="flex bg-muted p-1 rounded-xl border border-border">
                <button
                  onClick={() => setModalTab("resume")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    modalTab === "resume"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Resume View
                </button>
                <button
                  onClick={() => setModalTab("integrity")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    modalTab === "integrity"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Integrity & Interview Report
                </button>
              </div>

              {/* Document Actions */}
              <div className="flex items-center gap-2">
                {modalTab === "resume" && (
                  <>
                    <button 
                      onClick={() => setZoomLevel(prev => Math.max(70, prev - 10))}
                      className="p-2 border border-border bg-background hover:bg-muted rounded-xl transition-all cursor-pointer"
                      title="Zoom Out"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </button>
                    <span className="text-xs font-mono">{zoomLevel}%</span>
                    <button 
                      onClick={() => setZoomLevel(prev => Math.min(150, prev + 10))}
                      className="p-2 border border-border bg-background hover:bg-muted rounded-xl transition-all cursor-pointer"
                      title="Zoom In"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </button>
                    
                    <div className="w-px h-6 bg-border mx-1" />

                    <button 
                      onClick={() => alert("Downloading PDF... (Simulated)")}
                      className="p-2 border border-border bg-background hover:bg-muted rounded-xl transition-all cursor-pointer text-cyan-600 dark:text-cyan-400"
                      title="Download File"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </>
                )}

                <button 
                  onClick={() => {
                    setSelectedCandidate(null);
                    setModalTab("resume"); // Reset tab
                  }}
                  className="p-2 border border-border bg-background hover:bg-muted rounded-xl transition-all cursor-pointer text-red-500"
                  title="Close Modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal Body Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950/60 transition-colors">
              {modalTab === "resume" ? (
                <div className="flex items-start justify-center p-4">
                  <div 
                    className="bg-white text-black p-10 rounded-xl shadow-lg max-w-2xl w-full border border-slate-200 text-left font-serif transition-all"
                    style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                  >
                    {/* Simulated Doc Header */}
                    <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
                      <h1 className="text-3xl font-extrabold tracking-tight mb-1">{selectedCandidate.name}</h1>
                      <p className="text-xs font-sans text-slate-600 space-x-2">
                        <span>{selectedCandidate.email}</span>
                        <span>•</span>
                        <span>{selectedCandidate.phone}</span>
                      </p>
                    </div>

                    {/* Simulated Doc Body */}
                    <div className="space-y-6 text-sm leading-relaxed font-sans">
                      {/* Summary */}
                      <div>
                        <div className="flex items-center justify-between border-b border-slate-300 pb-1 mb-2">
                          <h4 className="font-bold uppercase tracking-wider text-xs">Professional Summary</h4>
                          <a
                            href={`${API_BASE}/api/interview/download-cv/${selectedCandidate.id}`}
                            download
                            className="flex items-center gap-1.5 px-2 py-0.5 border border-slate-300 hover:bg-muted rounded text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                            title="Download Original Resume File"
                          >
                            <Download className="h-3 w-3 text-emerald-500" />
                            Download Original Resume
                          </a>
                        </div>
                        <p>{selectedCandidate.resumeData.summary}</p>
                      </div>

                      {/* Experience */}
                      <div>
                        <h4 className="font-bold uppercase tracking-wider text-xs border-b border-slate-300 pb-1 mb-2">Experience</h4>
                        <ul className="list-disc pl-5 space-y-2">
                          {selectedCandidate.resumeData.experience.map((exp, idx) => (
                            <li key={idx}>{exp}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Skills */}
                      <div>
                        <h4 className="font-bold uppercase tracking-wider text-xs border-b border-slate-300 pb-1 mb-2">Technical Skills</h4>
                        <p className="text-xs">
                          {selectedCandidate.resumeData.skills.join(", ")}
                        </p>
                      </div>

                      {/* Education */}
                      <div>
                        <h4 className="font-bold uppercase tracking-wider text-xs border-b border-slate-300 pb-1 mb-2">Education</h4>
                        <p>{selectedCandidate.resumeData.education}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* INTEGRITY & INTERVIEW REPORT VIEW */
                (() => {
                  const integrity = getIntegrityData(selectedCandidate);
                  const transcript = getTranscript(selectedCandidate);
                  const riskColorClass = 
                    integrity.behavioral_risk_score === "High" ? "bg-red-500/10 border-red-500/20 text-red-500" :
                    integrity.behavioral_risk_score === "Medium" ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                    "bg-emerald-500/10 border-emerald-500/20 text-emerald-500";

                  return (
                    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-6">
                      
                      {/* Summary Stats Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        
                        {/* Overall Score */}
                        <div className="bg-card border border-border p-5 rounded-2xl flex flex-col justify-between shadow-sm">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Evaluation Score</span>
                          <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-4xl font-extrabold text-foreground">{selectedCandidate.score}</span>
                            <span className="text-sm text-muted-foreground">/100</span>
                          </div>
                          <span className="text-xs text-muted-foreground mt-2">
                            Recommendation: <span className="font-bold text-foreground">{selectedCandidate.recommendation || "Recommend"}</span>
                          </span>
                        </div>

                        {/* Integrity Score / Risk Level */}
                        <div className={`border p-5 rounded-2xl flex flex-col justify-between shadow-sm ${riskColorClass}`}>
                          <span className="text-xs font-semibold uppercase tracking-wider">Behavioral Risk Level</span>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-3xl font-extrabold">{integrity.behavioral_risk_score}</span>
                            {integrity.behavioral_risk_score === "High" ? (
                              <AlertOctagon className="h-7 w-7 text-red-500" />
                            ) : integrity.behavioral_risk_score === "Medium" ? (
                              <AlertTriangle className="h-7 w-7 text-amber-500" />
                            ) : (
                              <CheckCircle className="h-7 w-7 text-emerald-500" />
                            )}
                          </div>
                          <span className="text-[11px] mt-2">
                            Continuous behavioral calibration telemetry
                          </span>
                        </div>

                        {/* Baseline calibration */}
                        <div className="bg-card border border-border p-5 rounded-2xl flex flex-col justify-between shadow-sm text-xs space-y-1.5">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Behavioral Baseline</span>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Typing Speed:</span>
                            <span className="font-mono font-semibold text-foreground">{Math.round(integrity.behavioral_baseline?.baseline_typing_speed || 120)} cpm</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Thinking Time:</span>
                            <span className="font-mono font-semibold text-foreground">{integrity.behavioral_baseline?.baseline_thinking_time?.toFixed(1) || 3.5}s</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Backspace Rate:</span>
                            <span className="font-mono font-semibold text-foreground">{((integrity.behavioral_baseline?.baseline_backspace_rate || 0.04) * 100).toFixed(0)}%</span>
                          </div>
                        </div>

                      </div>

                      {/* Strengths & Weaknesses (Split Panel) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-500 mb-3 flex items-center gap-1.5">
                            <CheckCircle className="h-4 w-4" /> Demonstrated Strengths
                          </h4>
                          <ul className="space-y-1.5 text-xs text-muted-foreground pl-1">
                            {selectedCandidate.strengths && selectedCandidate.strengths.length > 0 ? (
                              selectedCandidate.strengths.map((str, idx) => (
                                <li key={idx} className="flex gap-2">
                                  <span>•</span>
                                  <span>{str}</span>
                                </li>
                              ))
                            ) : (
                              <>
                                <li className="flex gap-2"><span>•</span><span>Strong conceptual knowledge of target role stack.</span></li>
                                <li className="flex gap-2"><span>•</span><span>Fast, coherent, and consistent communication behavior.</span></li>
                              </>
                            )}
                          </ul>
                        </div>
                        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-red-500 mb-3 flex items-center gap-1.5">
                            <AlertTriangle className="h-4 w-4" /> Areas for Development
                          </h4>
                          <ul className="space-y-1.5 text-xs text-muted-foreground pl-1">
                            {selectedCandidate.weaknesses && selectedCandidate.weaknesses.length > 0 ? (
                              selectedCandidate.weaknesses.map((weak, idx) => (
                                <li key={idx} className="flex gap-2">
                                  <span>•</span>
                                  <span>{weak}</span>
                                </li>
                              ))
                            ) : (
                              <>
                                <li className="flex gap-2"><span>•</span><span>Some responses could have deeper architectural elaboration.</span></li>
                                <li className="flex gap-2"><span>•</span><span>Verify system integration projects via tech interview follow-up.</span></li>
                              </>
                            )}
                          </ul>
                        </div>
                      </div>

                      {/* Integrity Details & Observations */}
                      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Integrity Evidence & Audit Log</h4>
                          <span className="text-[10px] text-muted-foreground px-2 py-0.5 bg-muted rounded-full font-mono">
                            {integrity.observations?.length || 0} signals detected
                          </span>
                        </div>
                        <div className="p-5 space-y-4">
                          {integrity.observations && integrity.observations.length > 0 ? (
                            <ul className="divide-y divide-border/60 text-xs">
                              {integrity.observations.map((obs: any, idx: number) => {
                                const isSuccess = obs.type === "successful_validation";
                                const isWarning = ["paste_large", "paste_multiple", "typing_speed_deviation", "short_thinking_time", "instant_submission", "project_missing", "inconsistency_detected", "failed_validation"].includes(obs.type);
                                
                                return (
                                  <li key={idx} className="py-3 flex items-start gap-3 first:pt-0 last:pb-0">
                                    {isSuccess ? (
                                      <CheckCircle className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" />
                                    ) : (
                                      <AlertTriangle className={`h-4.5 w-4.5 shrink-0 mt-0.5 ${obs.type === "failed_validation" ? "text-red-500" : "text-amber-500"}`} />
                                    )}
                                    <div className="space-y-0.5">
                                      <p className="text-foreground font-medium">{obs.detail}</p>
                                      <p className="text-[10px] text-muted-foreground font-mono">
                                        {obs.timestamp ? new Date(obs.timestamp).toLocaleString() : "Audit Log"}
                                      </p>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <div className="py-6 text-center text-muted-foreground text-xs italic flex flex-col items-center gap-2">
                              <CheckCircle className="h-8 w-8 text-emerald-500/60" />
                              No behavioral anomalies or background inconsistencies detected. Candidate demonstrated consistent Typing Telemetry and verified credentials.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Behavioral Timeline */}
                      {integrity.behavioral_timeline && integrity.behavioral_timeline.length > 0 && (
                        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                          <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Detailed Behavioral Timeline</h4>
                            <span className="text-[10px] text-muted-foreground px-2 py-0.5 bg-muted rounded-full font-mono">
                              {integrity.behavioral_timeline.length} actions
                            </span>
                          </div>
                          <div className="p-5 max-h-[300px] overflow-y-auto space-y-4">
                            <div className="relative border-l-2 border-border ml-2.5 pl-5 space-y-4">
                              {integrity.behavioral_timeline.map((event: any, idx: number) => (
                                <div key={idx} className="relative">
                                  {/* Dot */}
                                  <div className="absolute -left-[27px] top-1.5 h-3.5 w-3.5 rounded-full bg-background border-2 border-primary" />
                                  <div className="space-y-0.5 text-xs">
                                    <p className="text-foreground font-semibold">{event.event}</p>
                                    <p className="text-[10px] text-muted-foreground font-mono">
                                      {event.timestamp ? new Date(event.timestamp).toLocaleString() : "Audit Event"}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Interview Exchange Transcript */}
                      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-border bg-muted/20">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Interview Transcript Audit</h4>
                        </div>
                        <div className="p-5 max-h-[300px] overflow-y-auto space-y-4 text-xs font-sans">
                          {transcript.map((msg: any, idx: number) => {
                            const isAi = msg.role === "ai" || msg.sender === "ai";
                            return (
                              <div key={idx} className={`flex flex-col p-3 rounded-xl border ${
                                isAi 
                                  ? "bg-muted/30 border-border/80 text-foreground" 
                                  : "bg-primary/5 border-primary/10 text-foreground ml-6"
                              }`}>
                                <span className="font-bold uppercase tracking-wider text-[9px] text-muted-foreground mb-1">
                                  {isAi ? "AI Recruiter" : selectedCandidate.name}
                                </span>
                                <p className="whitespace-pre-wrap leading-relaxed">{msg.content || msg.text}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Admin Modal */}
      {showEditModal && editingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-card border border-border rounded-3xl shadow-xl p-6 relative">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            
            <h3 className="text-lg font-bold mb-1">Edit Administrator</h3>
            <p className="text-xs text-muted-foreground mb-6">Modify details or update the security password for this administrator account.</p>
            
            <form onSubmit={handleSaveEditAdmin} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rohail Khan"
                  value={editAdminName}
                  onChange={(e) => setEditAdminName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. rohail@intervue.ai"
                  value={editAdminEmail}
                  onChange={(e) => setEditAdminEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  New Password (leave blank to keep current)
                </label>
                <div className="relative">
                  <input
                    type={showEditAdminPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={editAdminPassword}
                    onChange={(e) => setEditAdminPassword(e.target.value)}
                    className="w-full pl-4 pr-11 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditAdminPassword(!showEditAdminPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                    title={showEditAdminPassword ? "Hide password" : "Show password"}
                  >
                    {showEditAdminPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Access Level Role
                </label>
                <select
                  value={editAdminRole}
                  onChange={(e) => setEditAdminRole(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-xs cursor-pointer"
                >
                  <option value="Interview Coach">Interview Coach</option>
                  <option value="Super Admin">Super Admin</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-border hover:bg-muted rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEditAdmin}
                  className="px-4 py-2 bg-primary text-white hover:bg-primary/90 rounded-xl transition-colors font-semibold cursor-pointer disabled:opacity-75"
                >
                  {isSavingEditAdmin ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Domain Modal */}
      {showCustomDomainModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-card border border-border rounded-3xl shadow-xl p-6 relative">
            <h3 className="text-lg font-bold mb-2">Add Custom Domain</h3>
            <p className="text-xs text-muted-foreground mb-4">Introduce a new domain type to your interview classification models.</p>
            
            <div className="space-y-4">
              <input
                type="text"
                required
                placeholder="e.g. Mobile Development"
                value={customDomainInput}
                onChange={(e) => setCustomDomainInput(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-sm"
              />
              
              <div className="flex gap-3 justify-end text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomDomainModal(false);
                    setCustomDomainInput("");
                  }}
                  className="px-4 py-2 border border-border hover:bg-muted rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = customDomainInput.trim();
                    if (trimmed) {
                      if (!domainsList.includes(trimmed)) {
                        setDomainsList([...domainsList, trimmed]);
                      }
                      setDomain(trimmed);
                    }
                    setShowCustomDomainModal(false);
                    setCustomDomainInput("");
                  }}
                  className="px-4 py-2 bg-primary text-white hover:bg-primary/90 rounded-xl transition-colors font-semibold cursor-pointer"
                >
                  Add Domain
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
