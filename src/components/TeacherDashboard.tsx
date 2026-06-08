import React, { useState, useEffect, useRef } from "react";
import { 
  Users, 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  Edit2, 
  CheckCircle, 
  XCircle, 
  Camera, 
  Search, 
  Shield, 
  FileCheck, 
  UserPlus, 
  RefreshCw,
  LogOut,
  MapPin,
  HelpCircle,
  Image as ImageIcon,
  Lock,
  AlertCircle
} from "lucide-react";
import { Student, ClassSchedule, AttendanceSession, AttendanceRecord } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "../context/LanguageContext";
import LanguageSelector from "./LanguageSelector";
import { ClockPicker } from "./ClockPicker";

interface TeacherDashboardProps {
  user: {
    id: string;
    name: string;
    email?: string;
  };
  onLogout: () => void;
}

export default function TeacherDashboard({ user, onLogout }: TeacherDashboardProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"live" | "timetable" | "students">("live");

  // State
  const [classes, setClasses] = useState<ClassSchedule[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, language } = useLanguage();
  
  // Password Change States
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);
  const [passChanging, setPassChanging] = useState(false);
  
  // Real-time Session state
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<boolean>(false);

  // Forms states
  const [selectedCourseDetails, setSelectedCourseDetails] = useState<ClassSchedule | null>(null);
  const [showClassModal, setShowClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassSchedule | null>(null);
  const [classForm, setClassForm] = useState({
    subjectName: "",
    room: "",
    dayOfWeek: "Monday" as ClassSchedule["dayOfWeek"],
    startTime: "09:00",
    endTime: "10:30",
    studentIds: [] as string[]
  });

  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentForm, setStudentForm] = useState({
    studentNumber: "",
    name: "",
    major: "",
    photo: "", // Base64
    timetable: [] as string[]
  });

  // Local camera helper within Modals
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Custom delete confirmation state
  const [deleteConfirmType, setDeleteConfirmType] = useState<"class" | "student" | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string>("");

  // Load baseline app data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const classRes = await fetch("/api/classes");
      const stuRes = await fetch("/api/students");
      
      if (classRes.ok && stuRes.ok) {
        const clsData = await classRes.json();
        const stuData = await stuRes.json();
        
        // Filter classes that this specific teacher manages
        const teacherClasses = clsData.filter((c: ClassSchedule) => c.teacherId === user.id);
        setClasses(teacherClasses);
        setStudents(stuData);

        if (teacherClasses.length > 0 && !selectedClassId) {
          setSelectedClassId(teacherClasses[0].id);
        }
      }
    } catch (e) {
      console.error("Error drawing database stats", e);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPassError(t("emptyCredentialsError"));
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPassError(t("passRulesMessage"));
      return;
    }

    setPassChanging(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          role: "teacher",
          currentPassword,
          newPassword
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setPassSuccess(t("passChangedSuccess"));
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
        setTimeout(() => {
          setShowChangePassModal(false);
          setPassSuccess(null);
        }, 1500);
      } else {
        setPassError(data.error === "Incorrect current password" ? t("incorrectCurrentPass") : (data.error || t("incorrectCredentialsError")));
      }
    } catch (err) {
      setPassError(t("serverError"));
    } finally {
      setPassChanging(false);
    }
  };

  // Poll for live attendance check records when session is active
  useEffect(() => {
    if (!selectedClassId || activeTab !== "live") return;
    
    const controller = new AbortController();
    
    // Initial fetch
    fetchSessionStatus(controller.signal);

    // Setup micro-polling while session exists
    const timer = setInterval(() => {
      fetchSessionStatus(controller.signal);
    }, 4000);

    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [selectedClassId, refreshInterval, activeTab]);

  const fetchSessionStatus = async (signal?: AbortSignal) => {
    if (!selectedClassId) return;
    try {
      const res = await fetch(`/api/classes/${selectedClassId}/session`, { signal });
      if (res.ok) {
        const sessionData = await res.json();
        setActiveSession(sessionData || null);
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.warn("Poller connection warning:", err);
    }
  };

  // Session Control Actions
  const handleStartSession = async () => {
    if (!selectedClassId) return;
    try {
      const res = await fetch("/api/sessions/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: selectedClassId })
      });
      if (res.ok) {
        const updatedSession = await res.json();
        setActiveSession(updatedSession);
        setRefreshInterval(!refreshInterval);
      }
    } catch (err) {
      alert(t("errStartScanner"));
    }
  };

  const handleCloseSession = async () => {
    if (!selectedClassId) return;
    try {
      const res = await fetch("/api/sessions/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: selectedClassId })
      });
      if (res.ok) {
        const updatedSession = await res.json();
        setActiveSession(updatedSession);
        setRefreshInterval(!refreshInterval);
      }
    } catch (err) {
      alert(t("errCloseRegister"));
    }
  };

  // Class Actions
  const handleOpenAddClass = () => {
    setEditingClass(null);
    setClassForm({
      subjectName: "",
      room: "",
      dayOfWeek: "Monday",
      startTime: "09:00",
      endTime: "10:30",
      studentIds: []
    });
    setShowClassModal(true);
  };

  const handleOpenEditClass = (cls: ClassSchedule) => {
    setEditingClass(cls);
    setClassForm({
      subjectName: cls.subjectName,
      room: cls.room,
      dayOfWeek: cls.dayOfWeek,
      startTime: cls.startTime,
      endTime: cls.endTime,
      studentIds: cls.studentIds
    });
    setShowClassModal(true);
  };

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingClass ? editingClass.id : undefined,
          ...classForm,
          teacherId: user.id
        })
      });
      if (response.ok) {
        setShowClassModal(false);
        fetchData();
      }
    } catch (err) {
      alert(t("errSyncClasses"));
    }
  };

  const handleDeleteClass = (classId: string) => {
    setDeleteConfirmType("class");
    setDeleteTargetId(classId);
  };

  const handleDeleteStudent = (studentId: string) => {
    setDeleteConfirmType("student");
    setDeleteTargetId(studentId);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId || !deleteConfirmType) return;
    const targetId = deleteTargetId;
    const type = deleteConfirmType;
    setDeleteConfirmType(null);
    setDeleteTargetId("");

    try {
      if (type === "class") {
        const response = await fetch(`/api/classes/${targetId}`, {
          method: "DELETE"
        });
        if (response.ok) {
          fetchData();
          if (selectedClassId === targetId) {
            setSelectedClassId("");
            setActiveSession(null);
          }
        } else {
          alert(t("errDeleteClass"));
        }
      } else if (type === "student") {
        const response = await fetch(`/api/students/${targetId}`, {
          method: "DELETE"
        });
        if (response.ok) {
          fetchData();
        } else {
          alert(t("errDeleteStudent"));
        }
      }
    } catch (err) {
      alert(type === "class" ? t("errDeleteClass") : t("errDeleteStudent"));
    }
  };

  // Student Actions
  const handleOpenAddStudent = () => {
    setEditingStudent(null);
    setStudentForm({
      studentNumber: "",
      name: "",
      major: "",
      photo: "",
      timetable: []
    });
    stopCamera();
    setShowStudentModal(true);
  };

  const handleOpenEditStudent = (student: Student) => {
    setEditingStudent(student);
    setStudentForm({
      studentNumber: student.studentNumber,
      name: student.name,
      major: student.major,
      photo: student.photo || "",
      timetable: student.timetable || []
    });
    stopCamera();
    setShowStudentModal(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.name || !studentForm.studentNumber || !studentForm.major) {
      alert(t("alertFillStudentFields"));
      return;
    }
    
    try {
      const response = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingStudent ? editingStudent.id : undefined,
          ...studentForm
        })
      });

      if (response.ok) {
        setShowStudentModal(false);
        stopCamera();
        fetchData();
      } else {
        const errData = await response.json();
        alert(errData.error || t("errSaveStudent"));
      }
    } catch (err) {
      alert(t("errSaveStudent"));
    }
  };

  // Camera capture inside Student Add/Edit Modal (For Teacher's manual photo uploads)
  const startCamera = async () => {
    setCameraError(null);
    setCameraActive(true);
    try {
      // Small timeout to allow element rendering
      setTimeout(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 400, height: 300, facingMode: "user" },
            audio: false
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
        } catch (innerErr) {
          setCameraError(t("cameraPermissionError"));
          setCameraActive(false);
        }
      }, 150);
    } catch (e) {
      setCameraError(t("cameraInitiationFailed"));
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = 400;
      canvas.height = 300;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg");
        setStudentForm(prev => ({ ...prev, photo: dataUrl }));
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setStudentForm(prev => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Calculate percentages
  const getStatistics = () => {
    if (!activeSession) return { present: 0, absent: 0, total: 0, rate: 0 };
    const total = activeSession.records.length;
    const present = activeSession.records.filter(r => r.status === "PRESENT").length;
    const absent = total - present;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { present, absent, total, rate };
  };

  const stats = getStatistics();

  // Helper to translate AI parameters
  const localizeMatchExplanation = (exp: string) => {
    if (!exp) return "";
    if (language === "ko") {
      if (exp.includes("[Local fallback verification]")) {
        return "[로컬 대체 검증]: 안면 비례의 강력한 정밀 분석 매칭이 활성화되어 데이터베이스 기준 사양과 매칭됨을 확인하였습니다.";
      }
      if (exp.includes("First-time setup")) {
        return "최초 프로필 설정: 촬영된 스냅샷이 생체 원안 기준 등록 사진물로 마스터에 안전 기포 완료되었습니다.";
      }
      if (exp.includes("Biometric check bypassed via fail-safe fallback")) {
        return "출결 안전 보호 모드로 생체 인식이 우회됨: 카메라 스냅샷 수집이 성공 완료되었습니다.";
      }
      if (exp.includes("Bypassed securely due to brief API latency")) {
        return "네트워크 API 시간 초과 보호 대체 작동: 등교 출석 기록 일지 저장이 완료되었습니다.";
      }
    }
    return exp;
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col" id="teacher-dashboard-main">
      {/* Sub Header / Local Navbar */}
      <header className="bg-slate-900 text-white shadow" id="teacher-navbar-header">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">{t("teacherHeaderTitle")}</h2>
              <p className="text-xs text-slate-400">{t("teacherHeaderWelcome", { name: user.name })}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <button
              id="instructor-password-btn"
              onClick={() => {
                setShowChangePassModal(true);
                setPassError(null);
                setPassSuccess(null);
              }}
              className="flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 border border-slate-700 transition cursor-pointer whitespace-nowrap"
            >
              <Lock className="h-3.5 w-3.5" />
              {t("changePassword")}
            </button>
            <button
              id="instructor-logout-btn"
              onClick={onLogout}
              className="flex items-center gap-2 rounded-lg bg-slate-805 bg-slate-850 hover:bg-slate-700 active:bg-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300 border border-slate-700 transition cursor-pointer whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              {t("signOut")}
            </button>
          </div>
        </div>
      </header>

      {/* Primary Section Switch Tabs */}
      <div className="border-b border-slate-200 bg-white shadow-sm" id="dashboard-tab-rail">
        <div className="max-w-7xl mx-auto px-4 flex">
          <button
            id="tab-live-btn"
            onClick={() => { setActiveTab("live"); stopCamera(); }}
            className={`flex items-center gap-2 border-b-2 py-4 px-6 text-sm font-semibold transition ${
              activeTab === "live"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            <Clock className="h-4 w-4" />
            {t("tabLiveFace")}
          </button>
          <button
            id="tab-timetable-btn"
            onClick={() => { setActiveTab("timetable"); stopCamera(); }}
            className={`flex items-center gap-2 border-b-2 py-4 px-6 text-sm font-semibold transition ${
              activeTab === "timetable"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            <Calendar className="h-4 w-4" />
            {t("tabTimetable")}
          </button>
          <button
            id="tab-students-btn"
            onClick={() => { setActiveTab("students"); stopCamera(); }}
            className={`flex items-center gap-2 border-b-2 py-4 px-6 text-sm font-semibold transition ${
              activeTab === "students"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            <Users className="h-4 w-4" />
            {t("tabStudentEnrollment")}
          </button>
        </div>
      </div>

      <main className="flex-grow max-w-7xl w-full mx-auto p-4 md:p-6" id="dashboard-dynamic-pane">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3" id="main-loader-screen">
            <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
            <span className="text-sm font-medium">{t("downloadingDatabases")}</span>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {/* VIEW A: LIVE ATTENDANCE PANEL */}
            {activeTab === "live" && (
              <motion.div
                key="live-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
                id="live-attendance-tab-view"
              >
                {/* Session control header */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Select course column */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 matches-tab whitespace-nowrap">
                      <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                      {t("chooseClassTitle")}
                    </h3>
                    
                    {classes.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-xs">
                        {t("noCoursesFound")}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-500">{t("pickClassLabel")}</label>
                        <select
                          id="class-session-selector"
                          value={selectedClassId}
                          onChange={(e) => setSelectedClassId(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 p-2 text-sm bg-slate-50 hover:bg-slate-100 transition focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                        >
                          {classes.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.subjectName} ({c.id})
                            </option>
                          ))}
                        </select>
                        {selectedClassId && (
                          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-1.5 border border-slate-100">
                            {(() => {
                              const item = classes.find(c => c.id === selectedClassId);
                              if (!item) return null;
                              const translatedDayName = t(`formDay${item.dayOfWeek}` as any) || item.dayOfWeek;

                              return (
                                <>
                                  <div className="flex items-center gap-1.5 font-medium text-slate-800">
                                    <MapPin className="h-3.5 w-3.5 text-indigo-500" /> {item.room}
                                  </div>
                                  <div className="text-slate-400 font-medium flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5" /> {translatedDayName}, {item.startTime} - {item.endTime}
                                  </div>
                                  <div className="mt-2 text-[11px] font-semibold text-indigo-600 uppercase tracking-wider animate-fade-in">
                                    {t("enrolledStudentCount", { count: item.studentIds.length })}
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Operational Controls panel */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between md:col-span-2">
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5 text-indigo-500" />
                        {t("attendanceControllerTitle")}
                      </h3>
                      
                      {activeSession ? (
                        <div className="flex items-start gap-4 animate-fade-in">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            activeSession.status === "OPEN" 
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse" 
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${activeSession.status === "OPEN" ? "bg-emerald-500" : "bg-amber-500"}`} />
                            {activeSession.status === "OPEN" ? t("detectorRunning") : t("registersClosed")}
                          </span>
                          <div className="text-xs text-slate-500 font-bold">
                            {t("startedAt", { time: new Date(activeSession.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) })}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs font-medium text-slate-400">
                          {t("noScannerInitialized")}
                        </div>
                      )}

                      <p className="mt-3.5 text-xs text-slate-500 leading-relaxed">
                        {t("scannerInstructions")}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3 mt-4 justify-end border-t border-slate-100 pt-4">
                      {activeSession?.status === "OPEN" ? (
                        <button
                          id="close-attendance-btn"
                          onClick={handleCloseSession}
                          className="flex items-center gap-2 rounded-lg bg-rose-600 hover:bg-rose-700 hover:shadow active:bg-rose-800 px-4 py-2.5 text-sm font-semibold text-white transition shadow-sm cursor-pointer whitespace-nowrap"
                        >
                          <XCircle className="h-4 w-4" />
                          {t("lockRegisterBtn")}
                        </button>
                      ) : (
                        <button
                          id="open-attendance-btn"
                          onClick={handleStartSession}
                          disabled={!selectedClassId}
                          className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 hover:shadow active:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 px-4 py-2.5 text-sm font-semibold text-white transition shadow-sm cursor-pointer whitespace-nowrap"
                        >
                          <CheckCircle className="h-4 w-4" />
                          {t("startAttendanceBtn")}
                        </button>
                      )}
                      
                      <button 
                        id="refresh-live-btn"
                        onClick={fetchSessionStatus}
                        className="p-2.5 text-slate-500 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                        title={t("forceSyncSnapshots")}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Live Feed and Summary statistics */}
                {activeSession ? (
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
                    {/* Compact stats strip */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4 lg:col-span-1">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t("checkinOverview")}</h4>
                      <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                        <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                          <span className="text-2xl font-bold text-slate-900 block">{stats.total}</span>
                          <span className="text-[11px] text-slate-500 uppercase font-medium">{t("enrolledList")}</span>
                        </div>
                        <div className="bg-emerald-50/50 rounded-lg p-3 text-center border border-emerald-100">
                          <span className="text-2xl font-bold text-emerald-600 block">{stats.present}</span>
                          <span className="text-[11px] text-emerald-600 uppercase font-medium">{t("presentScanned")}</span>
                        </div>
                      </div>

                      {/* Progress Circle Heuristic representation */}
                      <div className="pt-2">
                        <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                          <span>{t("verifiedRatio")}</span>
                          <span>{stats.rate}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div 
                            className="bg-indigo-600 h-2 rounded-full transition-all duration-500" 
                            style={{ width: `${stats.rate}%` }} 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Checkins Grid list */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm lg:col-span-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center justify-between">
                        <span>{t("attendingStudentListTitle", { date: activeSession.date })}</span>
                        <span className="text-[11px] text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded bg-indigo-50 font-semibold uppercase tracking-wider">
                          {t("realtimeFaceMatched")}
                        </span>
                      </h4>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs" id="live-records-grid">
                          <thead>
                            <tr className="border-b border-slate-101 text-slate-400 font-bold uppercase tracking-wider">
                              <th className="pb-3 pl-2">{t("tableColStudent")}</th>
                              <th className="pb-3">{t("tableColIDMajor")}</th>
                              <th className="pb-3">{t("tableColTimestamp")}</th>
                              <th className="pb-3">{t("tableColBiometric")}</th>
                              <th className="pb-3 text-right pr-2">{t("tableColFaceSnap")}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {activeSession.records.map((rec) => {
                              // Find student profile photo to compare
                              const studProfile = students.find(s => s.id === rec.studentId);
                              
                              return (
                                <tr key={rec.studentId} className="hover:bg-slate-50 transition font-medium animate-fade-in">
                                  <td className="py-3 pl-2">
                                    <div className="flex items-center gap-3">
                                      {studProfile?.photo ? (
                                        <img 
                                          src={studProfile.photo} 
                                          alt="Registered Base" 
                                          className="h-8 w-8 rounded-full border border-slate-200 object-cover shadow-sm animate-fade-in"
                                        />
                                      ) : (
                                        <div className="h-8 w-8 rounded-full bg-slate-100 border flex items-center justify-center text-[10px] text-slate-400 font-bold">
                                          NO BASE
                                        </div>
                                      )}
                                      <div>
                                        <span className="text-slate-950 font-semibold block">{rec.studentName}</span>
                                        <span className="text-[10px] text-slate-400 font-medium">{t("studentCode", { id: rec.studentId })}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3">
                                    <span className="text-slate-800 font-semibold block">{rec.studentNumber}</span>
                                    <span className="text-slate-400 text-[10px] block font-semibold uppercase tracking-wider">{rec.major}</span>
                                  </td>
                                  <td className="py-3 text-slate-500">
                                    {rec.timestamp ? (
                                      <span>
                                        {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 font-medium">--</span>
                                    )}
                                  </td>
                                  <td className="py-3">
                                    {rec.status === "PRESENT" ? (
                                      <div className="space-y-1 animate-fade-in">
                                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-100 uppercase tracking-wider">
                                          {t("presentVerified")}
                                        </span>
                                        {rec.confidenceScore !== undefined && (
                                          <div className="text-[10px] text-emerald-600 block">
                                            {t("similarityMatches", { score: rec.confidenceScore })}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500 border border-slate-205 uppercase tracking-wider">
                                        {t("absent")}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 text-right pr-2">
                                    <div className="flex justify-end items-center gap-2">
                                      {rec.verifiedPhoto ? (
                                        // Visual side-by-side matching preview
                                        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded border border-slate-200" title="Left: Base | Right: Verifying Selfie">
                                          <img 
                                            src={studProfile?.photo} 
                                            alt="Base" 
                                            className="h-8 w-8 object-cover rounded shadow-sm border border-white"
                                          />
                                          <span className="text-[9px] text-slate-400 font-bold">{t("vsLabel")}</span>
                                          <img 
                                            src={rec.verifiedPhoto} 
                                            alt="Selfie" 
                                            className="h-8 w-8 object-cover rounded shadow-sm border border-indigo-200"
                                          />
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 italic">{t("noBiometricCapture")}</span>
                                      )}
                                    </div>
                                    {rec.matchAnalysis && (
                                      <span className="block text-[9px] text-slate-400 text-right mt-0.5 max-w-[200px] leading-tight truncate font-sans ml-auto" title={rec.matchAnalysis}>
                                        {localizeMatchExplanation(rec.matchAnalysis)}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-400 shadow-sm animate-fade-in" id="empty-session-monitor">
                    <FileCheck className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                    <h4 className="text-base font-bold text-slate-900 leading-tight">{t("biometricOfflineTitle")}</h4>
                    <p className="max-w-md mx-auto mt-1 text-xs font-medium text-slate-400 leading-normal">
                      {t("biometricOfflineDesc")}
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* VIEW B: COURSE TIMETABLE MANAGEMENT */}
            {activeTab === "timetable" && (
              <motion.div
                key="timetable-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
                id="timetable-tab-view"
              >
                <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">{t("managedTimetablesTitle")}</h3>
                    <p className="text-xs text-slate-400 font-medium">{t("managedTimetablesSubtitle")}</p>
                  </div>
                  
                  <button
                    id="add-class-modal-btn"
                    onClick={handleOpenAddClass}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 px-3 py-2 text-xs font-bold text-white transition shadow-sm cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4" />
                    {t("addTimetableBlockBtn")}
                  </button>
                </div>

                {classes.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-350 shadow-sm" id="empty-classes-tab">
                    <Calendar className="h-12 w-12 mx-auto text-slate-300 mb-2" />
                    <span className="text-sm font-bold block text-slate-805 text-slate-800">{t("timetableEmptyTitle")}</span>
                    <button
                      id="empty-class-add-btn"
                      onClick={handleOpenAddClass}
                      className="mt-3 text-xs text-indigo-600 border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 rounded-lg px-3 py-1.5 font-bold transition cursor-pointer"
                    >
                      {t("configureClassNowBtn")}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in" id="classes-timetable-grid">
                    {classes.map(c => {
                      const translatedDayName = t(`formDay${c.dayOfWeek}` as any) || c.dayOfWeek;
                      return (
                        <div 
                          key={c.id} 
                          onClick={() => setSelectedCourseDetails(c)}
                          className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer hover:-translate-y-0.5 group"
                          title="Click to view course details and enrolled students"
                        >
                          <div className="p-5">
                            <div className="flex justify-between items-start gap-3">
                              <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase tracking-widest border border-slate-200">
                                {c.id}
                              </span>
                              <div className="flex gap-1.5">
                                <button
                                  id={`edit-class-btn-${c.id}`}
                                  onClick={(e) => { e.stopPropagation(); handleOpenEditClass(c); }}
                                  className="text-slate-400 hover:text-indigo-600 p-1 transition bg-slate-50 hover:bg-slate-100 rounded"
                                  title="Edit class schedule"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  id={`delete-class-btn-${c.id}`}
                                  onClick={(e) => { e.stopPropagation(); handleDeleteClass(c.id); }}
                                  className="text-slate-400 hover:text-rose-600 p-1 transition bg-slate-50 hover:bg-slate-100 rounded"
                                  title="Delete class"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            <h4 className="text-base font-bold text-slate-900 mt-2 mb-1.5 line-clamp-1">{c.subjectName}</h4>
                            
                            <div className="space-y-1.5 text-xs text-slate-500 font-medium">
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-indigo-500" />
                                <span>{c.room}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-slate-404 text-slate-400" />
                                <span>{translatedDayName}, {c.startTime} - {c.endTime}</span>
                              </div>
                            </div>
                          </div>

                          {/* Enrolled students drawer bar */}
                          <div className="bg-slate-50/80 px-5 py-3 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-500">
                            <span className="font-semibold">{t("enrolledStudentCount", { count: c.studentIds.length })}</span>
                            <span className="text-[10px] bg-indigo-50 border border-indigo-100 font-bold uppercase rounded px-1.5 py-0.5 text-indigo-700 tracking-wider">
                              {t("activeTimeBlock")}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* VIEW C: STUDENT ENROLLMENT DIRECTORY */}
            {activeTab === "students" && (
              <motion.div
                key="students-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
                id="students-directory-view"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">{t("enrollmentRegistryTitle")}</h3>
                    <p className="text-xs text-slate-400 font-medium">{t("enrollmentRegistrySubtitle")}</p>
                  </div>
                  
                  <button
                    id="add-student-modal-btn"
                    onClick={handleOpenAddStudent}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 px-3 py-2 text-xs font-bold text-white transition shadow-sm cursor-pointer whitespace-nowrap"
                  >
                    <UserPlus className="h-4 w-4" />
                    {t("registerNewStudentBtn")}
                  </button>
                </div>

                {students.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-400 shadow-sm" id="empty-students-view">
                    <Users className="h-12 w-12 mx-auto text-slate-300 mb-2" />
                    <span className="text-sm font-bold block text-slate-805 text-slate-800">{t("enrollmentLedgerEmptyTitle")}</span>
                    <p className="text-xs text-slate-405 mt-1 max-w-sm mx-auto leading-normal">
                      {t("enrollmentLedgerEmptyDesc")}
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs" id="students-directory-list">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-5 = bg-slate-50/50 text-slate-400 font-bold uppercase tracking-wider">
                            <th className="py-3 pl-4">{t("tableColPhotoBaseline")}</th>
                            <th className="py-3">{t("tableColPortalLoginId")}</th>
                            <th className="py-3">{t("tableColStudentName")}</th>
                            <th className="py-3">{t("tableColUniversityNumber")}</th>
                            <th className="py-3">{t("tableColMajor")}</th>
                            <th className="py-3">{t("tableColEnrolledBlocks")}</th>
                            <th className="py-3 text-right pr-4">{t("tableColOperations")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {students.map((stud) => (
                            <tr key={stud.id} className="hover:bg-slate-55 hover:bg-slate-50 transition font-medium">
                              <td className="py-3 pl-4">
                                <div className="flex items-center">
                                  {stud.photo ? (
                                    <div className="group relative">
                                      <img 
                                        src={stud.photo} 
                                        alt={stud.name} 
                                        className="h-11 w-11 rounded-lg border border-slate-200 object-cover shadow-sm transition hover:scale-105"
                                      />
                                      <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center text-[9px] text-white transition cursor-pointer font-bold uppercase">
                                        {t("active")}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="h-11 w-11 rounded-lg bg-slate-100 border border-dashed flex flex-col items-center justify-center text-[8px] text-slate-400 font-bold border-slate-200">
                                      <ImageIcon className="h-4 w-4 text-slate-300 mb-0.5" />
                                      {t("pending")}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="py-3">
                                <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-bold text-slate-650 tracking-wide border border-slate-200">
                                  {stud.id}
                                </code>
                              </td>
                              <td className="py-3 text-slate-900 font-bold">{stud.name}</td>
                              <td className="py-3 text-slate-500 font-bold">{stud.studentNumber}</td>
                              <td className="py-3.5 py-3 text-slate-550">
                                <span className="text-[11px] bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/60 uppercase font-semibold text-slate-600 block w-max">
                                  {stud.major}
                                </span>
                              </td>
                              <td className="py-3 text-slate-500 font-bold">
                                {stud.timetable && stud.timetable.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {stud.timetable.map(tid => (
                                      <span key={tid} className="bg-indigo-50 text-[10px] text-indigo-700 px-1.5 py-0.5 border border-indigo-100 rounded animate-fade-in">
                                        {tid}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 font-medium">{t("noBlocksEnrolled")}</span>
                                )}
                              </td>
                              <td className="py-3 text-right pr-4">
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    id={`student-edit-btn-${stud.id}`}
                                    onClick={() => handleOpenEditStudent(stud)}
                                    className="p-1.5 text-slate-405 hover:text-indigo-600 rounded hover:bg-slate-100 transition cursor-pointer"
                                    title={t("opsEdit")}
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    id={`student-delete-btn-${stud.id}`}
                                    onClick={() => handleDeleteStudent(stud.id)}
                                    className="p-1.5 text-slate-405 hover:text-rose-600 rounded hover:bg-slate-100 transition cursor-pointer"
                                    title={t("opsDelete")}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-100 mt-12 py-6 border-t border-slate-200 text-center text-xs text-slate-500 font-medium" id="dashboard-system-footer">
        🏫 {t("studentDashboardTitle")} Admin • Powered by Multimodal AI
      </footer>

      {/* CUSTOM CONFIRM DELETE MODAL */}
      {deleteConfirmType && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" id="custom-delete-confirm-modal">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setDeleteConfirmType(null)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden z-[101] font-sans p-6 text-center shadow-rose-100"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 mb-4 animate-bounce">
              <Trash2 className="h-6 w-6 text-rose-605 text-rose-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">
              {deleteConfirmType === "class" ? t("delete") + " Course" : t("delete") + " Student"}
            </h3>
            <p className="text-xs text-slate-500 font-medium mb-6 leading-relaxed">
              {deleteConfirmType === "class" ? t("confirmDeleteClass") : t("confirmDeleteStudent")}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                id="cancel-delete-btn"
                onClick={() => setDeleteConfirmType(null)}
                className="inline-flex justify-center rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition cursor-pointer"
              >
                {t("cancel")}
              </button>
              <button
                id="confirm-delete-btn"
                onClick={handleConfirmDelete}
                className="inline-flex justify-center rounded-lg border border-transparent bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition cursor-pointer"
              >
                {t("delete")}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL 1: ADD / EDIT CLASS FORM */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" id="class-timetable-modal">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setShowClassModal(false)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden z-10 font-sans"
          >
            <div className="bg-slate-900 px-5 py-4 text-white flex justify-between items-center">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-indigo-400" />
                {editingClass ? t("modalEditClassTitle") : t("modalAddClassTitle")}
              </h3>
              <button
                id="close-class-modal-btn"
                onClick={() => setShowClassModal(false)}
                className="text-slate-400 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveClass} className="p-5 space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-705 text-slate-700 mb-1">{t("formSubjectName")}</label>
                <input
                  id="class-subject-input"
                  type="text"
                  required
                  value={classForm.subjectName}
                  onChange={(e) => setClassForm(prev => ({ ...prev, subjectName: e.target.value }))}
                  placeholder={t("formSubjectPlaceholder")}
                  className="w-full rounded-lg border border-slate-250 p-2 font-medium focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1">{t("formRoom")}</label>
                  <input
                    id="class-room-input"
                    type="text"
                    required
                    value={classForm.room}
                    onChange={(e) => setClassForm(prev => ({ ...prev, room: e.target.value }))}
                    placeholder={t("formRoomPlaceholder")}
                    className="w-full rounded-lg border border-slate-250 p-2 font-medium focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1">{t("formDayOfWeek")}</label>
                  <select
                    id="class-day-input"
                    value={classForm.dayOfWeek}
                    onChange={(e) => setClassForm(prev => ({ ...prev, dayOfWeek: e.target.value as ClassSchedule["dayOfWeek"] }))}
                    className="w-full rounded-lg border border-slate-250 p-2 font-medium focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50"
                  >
                    {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => (
                      <option key={day} value={day}>{t(`formDay${day}` as any) || day}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <ClockPicker
                    id="class-start-time"
                    label={t("formStartTime")}
                    value={classForm.startTime}
                    onChange={(time) => setClassForm(prev => ({ ...prev, startTime: time }))}
                  />
                </div>
                <div>
                  <ClockPicker
                    id="class-end-time"
                    label={t("formEndTime")}
                    value={classForm.endTime}
                    onChange={(time) => setClassForm(prev => ({ ...prev, endTime: time }))}
                  />
                </div>
              </div>

              {/* Class enrolments checklist */}
              <div>
                <label className="block text-slate-700 mb-1.5">{t("formStudentsEnrollment")}</label>
                {students.length === 0 ? (
                  <div className="text-center py-3 bg-slate-50 text-slate-400 border rounded font-medium">
                    No students configured yet. Register a student first!
                  </div>
                ) : (
                  <div className="max-h-[120px] overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50 space-y-1.5">
                    {students.map(s => {
                      const enrolled = classForm.studentIds.includes(s.id);
                      return (
                        <label key={s.id} className="flex items-center gap-2 cursor-pointer font-medium text-slate-650 hover:text-slate-900">
                          <input
                            type="checkbox"
                            checked={enrolled}
                            onChange={() => {
                              const newIds = enrolled 
                                ? classForm.studentIds.filter(id => id !== s.id)
                                : [...classForm.studentIds, s.id];
                              setClassForm(prev => ({ ...prev, studentIds: newIds }));
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>{s.name} ({s.studentNumber})</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex gap-2.5 justify-end border-t border-slate-100 pt-4 mt-3">
                <button
                  id="cancel-class-form-btn"
                  type="button"
                  onClick={() => setShowClassModal(false)}
                  className="px-3.5 py-2 font-semibold text-slate-500 hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
                >
                  {t("cancel")}
                </button>
                <button
                  id="submit-class-form-btn"
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition cursor-pointer shadow-sm"
                >
                  {t("formSaveButton")}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL 2: REGISTER / EDIT STUDENT PROFILE */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in" id="student-record-modal">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => { setShowStudentModal(false); stopCamera(); }} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg my-8 overflow-hidden z-10 font-sans"
          >
            <div className="bg-slate-900 px-5 py-4 text-white flex justify-between items-center">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <UserPlus className="h-4 w-4 text-indigo-400" />
                {editingStudent ? t("modalEditStudentTitle") : t("modalAddStudentTitle")}
              </h3>
              <button
                id="close-student-modal-btn"
                onClick={() => { setShowStudentModal(false); stopCamera(); }}
                className="text-slate-400 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="p-5 space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-700 mb-1">{t("formStudentNameLabel")}</label>
                    <input
                      id="student-name-input"
                      type="text"
                      required
                      value={studentForm.name}
                      onChange={(e) => setStudentForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder={t("formStudentNamePlaceholder")}
                      className="w-full rounded-lg border border-slate-250 p-2 font-medium focus:border-indigo-550 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 mb-1">{t("formStudentNumberLabel")}</label>
                    <input
                      id="student-number-input"
                      type="text"
                      required
                      value={studentForm.studentNumber}
                      onChange={(e) => setStudentForm(prev => ({ ...prev, studentNumber: e.target.value }))}
                      placeholder={t("formStudentNumberPlaceholder")}
                      className="w-full rounded-lg border border-slate-250 p-2 font-medium focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 mb-1">{t("formStudentMajorLabel")}</label>
                    <input
                      id="student-major-input"
                      type="text"
                      required
                      value={studentForm.major}
                      onChange={(e) => setStudentForm(prev => ({ ...prev, major: e.target.value }))}
                      placeholder={t("formStudentMajorPlaceholder")}
                      className="w-full rounded-lg border border-slate-250 p-2 font-medium focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50"
                    />
                  </div>
                </div>

                {/* Facial Registration Box (Webcam Capture + Local uploads) */}
                <div className="space-y-3">
                  <label className="block text-slate-700">{t("formBiometricPhotoBaseline")}</label>
                  
                  <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-55 bg-slate-50 flex flex-col items-center justify-center min-h-[160px] relative overflow-hidden">
                    {cameraActive ? (
                      <div className="relative w-full aspect-video rounded overflow-hidden bg-black border">
                        <video 
                          ref={videoRef} 
                          className="w-full h-full object-cover scale-x-[-1]" 
                          autoPlay 
                          playsInline 
                          muted 
                        />
                        <div className="absolute bottom-2 inset-x-0 flex justify-center gap-2">
                          <button
                            id="capture-photo-btn"
                            type="button"
                            onClick={capturePhoto}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1 px-3 rounded shadow-sm text-[10px] cursor-pointer"
                          >
                            {t("capturePhotoBtn")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {studentForm.photo ? (
                          <div className="relative w-full max-h-[140px] rounded overflow-hidden group">
                            <img 
                              src={studentForm.photo} 
                              alt="Captured selfie draft" 
                              className="w-full h-full object-cover rounded shadow"
                            />
                            <div className="absolute inset-0 bg-slate-955 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 transition">
                              <button
                                type="button"
                                id="retake-photo-btn"
                                onClick={startCamera}
                                className="bg-white/90 text-slate-900 border font-bold text-[9px] px-2 py-1 rounded hover:bg-white cursor-pointer"
                              >
                                {t("retakePhotoBtn")}
                              </button>
                              <button
                                type="button"
                                id="clear-photo-btn"
                                onClick={() => setStudentForm(prev => ({ ...prev, photo: "" }))}
                                className="bg-rose-600 text-white font-bold text-[9px] px-2 py-1 rounded hover:bg-rose-700 cursor-pointer"
                              >
                                {t("delete")}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center text-slate-400 p-4 space-y-2">
                            <Camera className="h-8 w-8 mx-auto text-slate-300" />
                            <p className="text-[10px] text-slate-400 leading-tight">{t("cameraOnboardingInstructions")}</p>
                            
                            <div className="flex gap-2 justify-center pt-1.5">
                              <button
                                id="start-profile-cam-btn"
                                type="button"
                                onClick={startCamera}
                                className="bg-white hover:bg-slate-100 border text-slate-700 px-2 py-1 rounded text-[10px] font-bold shadow-sm transition flex items-center gap-1 cursor-pointer"
                              >
                                <Camera className="h-3 w-3" />
                                {t("formTakeWebcamPhoto")}
                              </button>
                              <label className="bg-white hover:bg-slate-100 border text-slate-700 px-2 py-1 rounded text-[10px] font-bold shadow-sm cursor-pointer transition flex items-center gap-1">
                                <Plus className="h-3 w-3" />
                                {t("formUploadDiskPhoto")}
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={handleFileUpload} 
                                />
                              </label>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {cameraError && (
                      <span className="text-[10px] text-rose-500 font-bold block text-center mt-2 bg-rose-50 rounded border border-rose-100 p-1.5 w-full animate-fade-in">
                        {cameraError}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Multi-Enrol Class Timetables checkbox list */}
              <div>
                <label className="block text-slate-700 mb-1.5">{t("formStudentsEnrollment")}</label>
                {classes.length === 0 ? (
                  <div className="text-center py-3 bg-slate-50 text-slate-400 border rounded font-medium">
                    No timetables registered yet. Create a course class first.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 border border-slate-200 rounded-lg p-2 bg-slate-50">
                    {classes.map(c => {
                      const assigned = studentForm.timetable.includes(c.id);
                      return (
                        <label key={c.id} className="flex items-center gap-2 cursor-pointer font-medium text-slate-650 hover:text-slate-900 border p-1 rounded bg-white border-slate-200 hover:border-slate-300 transition">
                          <input
                            type="checkbox"
                            checked={assigned}
                            onChange={() => {
                              const newRefs = assigned 
                                ? studentForm.timetable.filter(id => id !== c.id)
                                : [...studentForm.timetable, c.id];
                              setStudentForm(prev => ({ ...prev, timetable: newRefs }));
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="truncate">{c.subjectName}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex gap-2.5 justify-end border-t border-slate-100 pt-4 mt-3">
                <button
                  id="cancel-student-form-btn"
                  type="button"
                  onClick={() => { setShowStudentModal(false); stopCamera(); }}
                  className="px-3.5 py-2 font-semibold text-slate-505 text-slate-500 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                >
                  {t("cancel")}
                </button>
                <button
                  id="submit-student-form-btn"
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition cursor-pointer shadow-sm"
                >
                  {t("saveStudentBtn")}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: CHANGE PASSWORD */}
      {showChangePassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 text-slate-800" id="change-pass-modal">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setShowChangePassModal(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden z-10 font-sans"
          >
            <div className="bg-slate-900 px-5 py-4 text-white flex justify-between items-center">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-indigo-400" />
                {t("changePassword")}
              </h3>
              <button
                id="close-pass-modal-btn"
                onClick={() => setShowChangePassModal(false)}
                className="text-slate-400 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              {passError && (
                <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2.5 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{passError}</span>
                </div>
              )}
              {passSuccess && (
                <div className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span>{passSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{t("currentPasswordLabel")}</label>
                <input
                  type="password"
                  id="teacher-current-pass-input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{t("newPasswordLabel")}</label>
                <input
                  type="password"
                  id="teacher-new-pass-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{t("confirmNewPasswordLabel")}</label>
                <input
                  type="password"
                  id="teacher-confirm-pass-input"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="w-full flex gap-3 justify-end border-t border-slate-100 pt-4">
                <button
                  id="cancel-pass-btn"
                  type="button"
                  onClick={() => setShowChangePassModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                >
                  {t("cancel")}
                </button>
                <button
                  id="confirm-change-pass-btn"
                  type="submit"
                  disabled={passChanging}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  {passChanging ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Lock className="h-3.5 w-3.5" />
                  )}
                  {t("save")}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: COURSE DETAILS AND ENROLLED STUDENTS */}
      {selectedCourseDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 text-slate-800" id="course-details-modal">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setSelectedCourseDetails(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden z-10 font-sans"
          >
            {/* Header */}
            <div className="bg-slate-900 px-5 py-4 text-white flex justify-between items-center">
              <div>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-extrabold uppercase tracking-widest px-2 py-0.5 rounded border border-indigo-500/30">
                  Block {selectedCourseDetails.id}
                </span>
                <h3 className="text-sm font-bold mt-1.5 flex items-center gap-1.5">
                  <Calendar className="h-4.5 w-4.5 text-indigo-400" />
                  Course Timetable Details
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  id="header-edit-course-btn"
                  title={t("editCourse")}
                  onClick={() => {
                    handleOpenEditClass(selectedCourseDetails);
                    setSelectedCourseDetails(null);
                  }}
                  className="text-slate-400 hover:text-white transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t("editCourse")}</span>
                </button>
                <div className="w-px h-4 bg-slate-700" />
                <button
                  id="close-course-details-modal-btn"
                  onClick={() => setSelectedCourseDetails(null)}
                  className="text-slate-400 hover:text-white font-bold cursor-pointer text-sm"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Info Matrix */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subject Name</span>
                  <span className="block text-sm font-bold text-slate-900">{selectedCourseDetails.subjectName}</span>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Classroom Location</span>
                  <span className="block text-sm font-semibold text-slate-800 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                    {selectedCourseDetails.room}
                  </span>
                </div>
                <div className="space-y-1 col-span-2 border-t border-slate-200/60 pt-3">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scheduled Timing</span>
                  <span className="block text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    {t(`formDay${selectedCourseDetails.dayOfWeek}` as any) || selectedCourseDetails.dayOfWeek}, {selectedCourseDetails.startTime} - {selectedCourseDetails.endTime}
                  </span>
                </div>
              </div>

              {/* Enrolled Students header & count */}
              <div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-slate-400" />
                    Enrolled Students
                  </h4>
                  <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100/50 px-2.5 py-0.5 rounded-full">
                    {selectedCourseDetails.studentIds.length} Registered
                  </span>
                </div>

                {/* Students list */}
                {(() => {
                  const enrolledList = students.filter(
                    s => selectedCourseDetails.studentIds.includes(s.id) || (s.timetable && s.timetable.includes(selectedCourseDetails.id))
                  );

                  if (enrolledList.length === 0) {
                    return (
                      <div className="text-center py-8 text-slate-400 text-xs font-medium bg-slate-50 border border-dashed rounded-xl">
                        No students enrolled in this course yet.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {enrolledList.map(s => (
                        <div key={s.id} className="flex items-center justify-between p-2.5 bg-white border border-slate-150 rounded-xl hover:bg-slate-55 hover:bg-slate-50 transition shadow-xs">
                          <div className="flex items-center gap-3">
                            {s.photo ? (
                              <img src={s.photo} alt={s.name} className="h-9 w-9 rounded-lg object-cover border border-slate-200" />
                            ) : (
                              <div className="h-9 w-9 rounded-lg bg-slate-100 border border-dashed border-slate-200 flex items-center justify-center text-slate-300">
                                <ImageIcon className="h-4 w-4" />
                              </div>
                            )}
                            <div>
                              <span className="block text-xs font-bold text-slate-900 leading-snug">{s.name}</span>
                              <span className="block text-[10px] text-slate-400 font-bold">{s.major}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="block text-[10px] font-bold font-mono text-indigo-600 bg-indigo-50 border border-indigo-100/40 px-1.5 py-0.5 rounded">
                              ID: {s.studentNumber}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Close Button & Edit Button */}
              <div className="border-t border-slate-150/80 pt-4 flex justify-end gap-2.5">
                <button
                  id="details-edit-course-btn"
                  onClick={() => {
                    handleOpenEditClass(selectedCourseDetails);
                    setSelectedCourseDetails(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg transition cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  {t("editCourse")}
                </button>
                <button
                  id="close-details-dlg-btn"
                  onClick={() => setSelectedCourseDetails(null)}
                  className="px-5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-lg transition cursor-pointer shadow-sm border border-slate-200"
                >
                  Close Panel
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Hidden canvas for image operations */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
