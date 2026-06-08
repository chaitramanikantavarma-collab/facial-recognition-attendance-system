import React, { useState, useEffect, useRef } from "react";
import { 
  BookOpen, 
  Calendar, 
  Clock, 
  Camera, 
  CheckCircle, 
  XCircle, 
  History, 
  User, 
  LogOut, 
  RefreshCw, 
  FileCheck, 
  Plus, 
  MapPin, 
  AlertCircle,
  HelpCircle,
  Award,
  Lock,
  Users,
  Image as ImageIcon
} from "lucide-react";
import { ClassSchedule, Student } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "../context/LanguageContext";
import LanguageSelector from "./LanguageSelector";

interface StudentDashboardProps {
  user: {
    id: string; // "S202601"
    name: string;
    studentNumber?: string;
    major?: string;
    photo?: string;
  };
  onLogout: () => void;
}

export default function StudentDashboard({ user, onLogout }: StudentDashboardProps) {
  const [studentProfile, setStudentProfile] = useState<Student | null>(null);
  const [timetable, setTimetable] = useState<ClassSchedule[]>([]);
  const [allClasses, setAllClasses] = useState<ClassSchedule[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [selectedCourseDetails, setSelectedCourseDetails] = useState<ClassSchedule | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, language } = useLanguage();

  // Password Update Modal States
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);
  const [passChanging, setPassChanging] = useState(false);

  // Active check-in states
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [activeSessionInfo, setActiveSessionInfo] = useState<any | null>(null);

  // Verification UI Flows
  const [scannerActive, setScannerActive] = useState(false);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [simulateWrongFace, setSimulateWrongFace] = useState(false);
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    confidence?: number;
    analysis?: string;
    error?: string;
  } | null>(null);

  // Camera resources
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Onboarding Avatar Registration States
  const [onboardingCam, setOnboardingCam] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  useEffect(() => {
    fetchStudentData();
  }, []);

  const fetchStudentData = async () => {
    setLoading(true);
    try {
      const profRes = await fetch(`/api/students/${user.id}`);
      const ttRes = await fetch(`/api/students/${user.id}/timetable`);
      const allRes = await fetch("/api/classes");
      const studentsRes = await fetch("/api/students");
      const subHistory = await fetch(`/api/students/${user.id}/history`);

      if (profRes.ok && ttRes.ok && allRes.ok && studentsRes.ok && subHistory.ok) {
        const pObj = await profRes.json();
        const ttObj = await ttRes.json();
        const allObj = await allRes.json();
        const studList = await studentsRes.json();
        const histObj = await subHistory.json();

        setStudentProfile(pObj);
        setTimetable(ttObj);
        setAllClasses(allObj);
        setAllStudents(studList);
        setAttendanceHistory(histObj);

        if (ttObj.length > 0) {
          setSelectedClassId(ttObj[0].id);
        }
      }
    } catch (e) {
      console.error("Student dashboard downloader fault", e);
    } finally {
      setLoading(false);
    }
  };

  // Poll for Active Session status when Class dropdown selection switches
  useEffect(() => {
    if (!selectedClassId) {
      setActiveSessionInfo(null);
      return;
    }

    const controller = new AbortController();

    checkClassSessionOpened(controller.signal);
    const interval = setInterval(() => {
      checkClassSessionOpened(controller.signal);
    }, 5000);

    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [selectedClassId]);

  const checkClassSessionOpened = async (signal?: AbortSignal) => {
    if (!selectedClassId) return;
    try {
      const res = await fetch(`/api/classes/${selectedClassId}/session`, { signal });
      if (res.ok) {
        const sData = await res.json();
        setActiveSessionInfo(sData || null);
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.warn("Session scanner network unreachable.");
    }
  };

  // Student self-enrollment into classes to build their local custom timetable
  const handleEnrollClass = async (classId: string) => {
    if (!studentProfile) return;
    const isEnrolled = studentProfile.timetable.includes(classId);
    let newTimetable = [...studentProfile.timetable];

    if (isEnrolled) {
      newTimetable = newTimetable.filter(id => id !== classId);
    } else {
      newTimetable.push(classId);
    }

    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: studentProfile.id,
          name: studentProfile.name,
          studentNumber: studentProfile.studentNumber,
          major: studentProfile.major,
          photo: studentProfile.photo,
          timetable: newTimetable
        })
      });

      if (res.ok) {
        fetchStudentData();
      }
    } catch {
      alert(t("errSyncClasses"));
    }
  };

  // Face Registration (For new students who haven't uploaded an avatar baseline photo)
  const startOnboardingCamera = async () => {
    setCameraError(null);
    setOnboardingCam(true);
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
      } catch {
        setCameraError(t("cameraPermissionStudent"));
        setOnboardingCam(false);
      }
    }, 200);
  };

  const stopOnboardingCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setOnboardingCam(false);
  };

  const saveAvatarBaseline = async () => {
    if (videoRef.current && canvasRef.current && studentProfile) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = 400;
      canvas.height = 300;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Photo = canvas.toDataURL("image/jpeg");
        
        setAvatarLoading(true);
        try {
          const res = await fetch(`/api/students/${studentProfile.id}/register-photo`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photo: base64Photo })
          });

          if (res.ok) {
            stopOnboardingCamera();
            fetchStudentData();
          }
        } catch {
          alert(t("errSaveStudent"));
        } finally {
          setAvatarLoading(false);
        }
      }
    }
  };

  const handleAvatarFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && studentProfile) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        setAvatarLoading(true);
        try {
          const res = await fetch(`/api/students/${studentProfile.id}/register-photo`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photo: base64Data })
          });

          if (res.ok) {
            fetchStudentData();
          }
        } catch {
          alert(t("errSaveStudent"));
        } finally {
          setAvatarLoading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Active Facial Recognition Attendance Scanner Modal Launcher
  const startAttendanceScanner = async () => {
    setScannerActive(true);
    setScanResult(null);
    setCameraError(null);
    
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 500, height: 375, facingMode: "user" },
          audio: false
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch {
        setCameraError(t("cameraFailStudent"));
        setScannerActive(false);
      }
    }, 200);
  };

  const closeAttendanceScanner = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setScannerActive(false);
    setScanResult(null);
  };

  const performFacialVerification = async () => {
    if (!videoRef.current || !canvasRef.current || !studentProfile || !selectedClassId) return;
    
    setCaptureLoading(true);
    setScanResult(null);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = 500;
    canvas.height = 375;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCaptureLoading(false);
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const capturedSelfie = canvas.toDataURL("image/jpeg");

    try {
      const response = await fetch("/api/sessions/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentProfile.id,
          classId: selectedClassId,
          selfiePhoto: capturedSelfie,
          simulateWrongFace: simulateWrongFace
        })
      });

      const bResponse = await response.json();
      
      if (response.ok && bResponse.success) {
        setScanResult({
          success: bResponse.matched,
          confidence: bResponse.confidence,
          analysis: bResponse.analysis
        });
        
        // Refresh local student timeline and records
        fetchStudentData();
      } else {
        setScanResult({
          success: false,
          error: bResponse.error || t("biometricRejectedDesc")
        });
      }
    } catch {
      setScanResult({
        success: false,
        error: t("verifyScannerStudent")
      });
    } finally {
      setCaptureLoading(false);
    }
  };

  // Helper helper to translates AI or fallback analytics reasoning
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
      if (exp.includes("[Biometric Rejection Simulated]")) {
        return "[생체 인식 거절 시뮬레이션]: 안면 골격 구조 불일치 감지. 눈, 코 등의 위치 비례 및 좌표 배치가 등록된 원안 기본 사진 파일 데이터베이스 기준과 부합하지 않습니다.";
      }
    }
    return exp;
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
          role: "student",
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

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col" id="student-dashboard-main">
      {/* HEADER BAR */}
      <header className="bg-slate-900 text-white shadow-md relative overflow-hidden" id="student-header-navbar">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row justify-between items-center gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="bg-indigo-600 p-2.5 rounded-xl shadow">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{user.name}</h1>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                {user.studentNumber} • {user.major}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <LanguageSelector />
            <button
              id="student-change-pass-btn"
              onClick={() => {
                setShowChangePassModal(true);
                setPassError(null);
                setPassSuccess(null);
              }}
              className="flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-300 border border-slate-700 shadow-sm transition cursor-pointer whitespace-nowrap"
            >
              <Lock className="h-3.5 w-3.5" />
              {t("changePassword")}
            </button>
            <button
              id="student-logout-btn"
              onClick={onLogout}
              className="flex items-center gap-2 rounded-lg bg-slate-805 bg-slate-850 hover:bg-slate-700 active:bg-slate-650 px-3.5 py-2 text-xs font-semibold text-slate-300 border border-slate-705 shadow-sm transition cursor-pointer whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              {t("portalLogout")}
            </button>
          </div>
        </div>
      </header>

      {/* CORE FRAME */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6" id="student-dashboard-body">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3" id="student-loading-screen">
            <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
            <span className="text-sm font-semibold">{t("configuringTimetable")}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LENS 1 & 2: SCAN PANEL + ENROLLED BLOCKS */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* WALLED WIDGET: FACIAL REGISTER ONBOARDING FOR FIRST TIME SEED USERS */}
              {studentProfile && !studentProfile.photo && (
                <motion.div 
                  initial={{ scale: 0.98, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-amber-50 rounded-2xl border border-amber-200 p-5 shadow-xs flex flex-col md:flex-row gap-5 items-center"
                  id="avatar-onboarding-panel"
                >
                  <div className="bg-amber-100 p-3 rounded-full text-amber-600">
                    <Camera className="h-8 w-8" />
                  </div>
                  <div className="space-y-1 flex-1 text-center md:text-left">
                    <h3 className="text-sm font-bold text-amber-900 leading-tight">{t("biometricRequiredTitle")}</h3>
                    <p className="text-[11px] text-amber-700 font-medium">
                      {t("biometricRequiredDesc")}
                    </p>
                    <div className="flex gap-2 justify-center md:justify-start pt-2">
                      {onboardingCam ? (
                        <div className="space-y-2">
                          <div className="relative w-[280px] aspect-video rounded bg-black overflow-hidden border">
                            <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" autoPlay playsInline muted />
                          </div>
                          <div className="flex gap-1.5 h-max">
                            <button
                              id="save-avatar-baseline-btn"
                              onClick={saveAvatarBaseline}
                              disabled={avatarLoading}
                              className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold px-3 py-1.5 rounded disabled:bg-slate-400 cursor-pointer"
                            >
                              {avatarLoading ? t("updatingDatabase") : t("captureFrameBaselineBtn")}
                            </button>
                            <button
                              id="cancel-avatar-cam-btn"
                              onClick={stopOnboardingCamera}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold px-3 py-1.5 rounded cursor-pointer"
                            >
                              {t("cancel")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            id="start-avatar-capture-btn"
                            onClick={startOnboardingCamera}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold px-3 py-1.5 rounded transition shadow-sm cursor-pointer"
                          >
                            {t("openWebcamBtn")}
                          </button>
                          <label className="bg-white hover:bg-slate-100 border text-slate-700 text-[11px] font-bold px-3 py-1.5 rounded shadow-xs cursor-pointer transition flex items-center gap-1">
                            {t("uploadFileBtn")}
                            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFileUpload} />
                          </label>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* PRIMARY ACTION: THE REALTIME SCANNER TRIGGER */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4" id="realtime-attendance-scan-widget">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-indigo-500" />
                    {t("studentClockInGateway")}
                  </h3>
                  <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                    {t("cameraVerifyMode")}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-550 mb-1">{t("selectCurrentClass")}</label>
                    {timetable.length === 0 ? (
                      <div className="text-xs bg-slate-50 border rounded-lg p-3 text-slate-400 font-medium">
                        {t("noCoursesScheduled")}
                      </div>
                    ) : (
                      <select
                        id="student-class-selector"
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 p-2.5 text-xs font-semibold bg-slate-50 hover:bg-slate-100 transition focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        {timetable.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.subjectName} ([{c.id}] {c.room})
                          </option>
                        ))}
                      </select>
                    )}

                    {selectedClassId && (
                      <div className="mt-3.5 bg-slate-50 border border-slate-100 rounded-lg p-3.5 text-xs text-slate-600 space-y-1.5">
                        {(() => {
                          const clsObj = timetable.find(c => c.id === selectedClassId);
                          if (!clsObj) return null;
                          
                          // Translate day week labels natively
                          const translatedDayName = t(`formDay${clsObj.dayOfWeek}` as any) || clsObj.dayOfWeek;
                          
                          return (
                            <>
                              <div className="flex items-center gap-1 font-bold text-slate-800">
                                <MapPin className="h-3.5 w-3.5 text-indigo-500" /> {clsObj.room}
                              </div>
                              <div className="text-[11px] text-slate-450 font-semibold flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" /> {translatedDayName}, {clsObj.startTime} - {clsObj.endTime}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Operational status screen */}
                  <div className="flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-100 pt-3.5 md:pt-0 md:pl-4">
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-widest">{t("attendanceServerState")}</span>
                      {activeSessionInfo ? (
                        activeSessionInfo.status === "OPEN" ? (
                          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 animate-fade-in">
                            <span className="font-extrabold flex items-center gap-1.5 mb-1 text-emerald-950 uppercase">
                              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                              {t("registersOpen")}
                            </span>
                            {t("registersOpenDesc")}
                          </div>
                        ) : (
                          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                            <span className="font-bold block mb-1 text-amber-950">CHECK-IN CLOSED</span>
                            {t("registersClosedDesc")}
                          </div>
                        )
                      ) : (
                        <div className="rounded-lg bg-slate-100 border p-3 text-xs text-slate-500">
                          <span className="font-semibold block mb-1 text-slate-800">{t("facultyStationIdle")}</span>
                          {t("facultyStationIdleDesc")}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 flex justify-end">
                      <button
                        id="trigger-biometric-scan-btn"
                        onClick={startAttendanceScanner}
                        disabled={!selectedClassId || activeSessionInfo?.status !== "OPEN" || !studentProfile?.photo}
                        className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-200 disabled:text-slate-400 px-4 py-2.5 text-xs font-bold text-white transition shadow-sm cursor-pointer"
                      >
                        <Camera className="h-4 w-4" />
                        {t("scanMyFaceBtn")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* TIMELINE ARCHIVE: THE ATTENDANCE CHECK HISTORY */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4" id="student-attendance-log-strip">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
                  <History className="h-4 w-4" />
                  {t("facialVerifyHistory")}
                </h3>

                {attendanceHistory.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs font-medium bg-slate-50 rounded-xl" id="empty-history-alert">
                    {t("noHistoricChecks")}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {attendanceHistory.map((hist, idx) => (
                      <div 
                        key={hist.sessionId + "_" + idx} 
                        className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3.5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-100 flex-wrap gap-2 transition animate-fade-in"
                      >
                        <div className="space-y-1">
                          <span className="text-xs text-slate-900 font-bold block">{hist.className}</span>
                          <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">
                            {hist.date} • {hist.timestamp ? new Date(hist.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : t("absent")}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {hist.status === "PRESENT" ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-widest animate-fade-in">
                              {t("presentVerified")} ({hist.confidenceScore || 90}%)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-rose-50 border border-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 uppercase tracking-widest">
                              {t("absent")}
                            </span>
                          )}
                        </div>

                        {hist.matchAnalysis && (
                          <div className="w-full mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 italic flex items-center gap-1 bg-white p-2 rounded">
                            <AlertCircle className="h-3 w-3 text-indigo-400 shrink-0" />
                            <span>{t("biometricsReasoning", { text: localizeMatchExplanation(hist.matchAnalysis) })}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* LENS 3: CLASSROOM ENROLLMENTS SELECTION TIMETABLE CONTAINER */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* CURRENT PHOTO PREVIEW BASIL BASE CARD */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm text-center flex flex-col items-center justify-center space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t("formBiometricPhotoBaseline")}</h4>
                {studentProfile?.photo ? (
                  <div className="relative group rounded-xl overflow-hidden border border-slate-200 max-w-[150px] aspect-square animate-fade-in">
                    <img 
                      src={studentProfile.photo} 
                      alt="Student biometric mapping" 
                      className="object-cover w-full h-full rounded shadow"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-slate-900/70 py-1 text-[9px] text-white font-bold uppercase tracking-widest">
                      {t("baselinePhotoInstalled")}
                    </div>
                  </div>
                ) : (
                  <div className="h-28 w-28 rounded-xl bg-slate-100 border border-dashed flex flex-col items-center justify-center text-slate-400 text-xs font-medium">
                    <Camera className="h-6 w-6 text-slate-300 mb-1" />
                    No Profile Setup
                  </div>
                )}
                
                {/* File custom inputs update baseline */}
                {studentProfile?.photo && (
                  <label className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 font-bold px-2.5 py-1 rounded cursor-pointer hover:bg-indigo-100 transition inline-block">
                    {t("updateSymmetriesPhoto")}
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFileUpload} />
                  </label>
                )}
              </div>

              {/* TIMETABLE SELECTION BOX */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4" id="timetable-enrollment-panel">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-bold text-slate-450 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {t("timetableManagement")}
                  </h3>
                  <p className="text-[10px] text-slate-400 leading-tight">{t("timetableManagementDesc")}</p>
                </div>

                <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                  {allClasses.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs font-medium bg-slate-50 border rounded-lg">
                      {t("noUniversityClasses")}
                    </div>
                  ) : (
                    allClasses.map(cls => {
                      const enrolled = studentProfile?.timetable.includes(cls.id);
                      const translatedDayName = t(`formDay${cls.dayOfWeek}` as any) || cls.dayOfWeek;

                      return (
                        <div 
                          key={cls.id} 
                          onClick={() => setSelectedCourseDetails(cls)}
                          className={`p-3 rounded-xl border transition flex items-center justify-between gap-2.5 cursor-pointer hover:shadow-md hover:border-slate-300 ${
                            enrolled 
                              ? "bg-slate-50 border-slate-250 text-slate-900" 
                              : "bg-white border-slate-200 text-slate-500"
                          }`}
                          title="Click to view course details and classmates"
                        >
                          <div className="space-y-1 flex-1 min-w-0">
                            <span className="text-xs text-slate-900 font-extrabold block truncate leading-tight">{cls.subjectName}</span>
                            <span className="text-[10px] text-slate-450 font-bold block bg-slate-100/40 w-max px-1 rounded uppercase">
                              Block {cls.id} • {cls.room}
                            </span>
                            <span className="text-[9px] text-slate-405 font-semibold block">
                              {translatedDayName}, {cls.startTime} - {cls.endTime}
                            </span>
                          </div>

                          <button
                            id={`enroll-class-btn-${cls.id}`}
                            onClick={(e) => { e.stopPropagation(); handleEnrollClass(cls.id); }}
                            className={`p-1.5 font-bold rounded-lg border text-[10px] tracking-wide transition shrink-0 cursor-pointer ${
                              enrolled
                                ? "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100"
                                : "bg-indigo-600 text-white border-indigo-555 hover:bg-indigo-700"
                            }`}
                          >
                            {enrolled ? t("dropClassBtn") : t("enlistClassBtn")}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-100 py-6 border-t border-slate-200 text-center text-xs text-slate-500 font-medium" id="student-portal-footer">
        🎓 {t("studentDashboardTitle")}
      </footer>

      {/* MODAL 3: RUN TIME ATTENDANCE CAMERA SCANNER */}
      {scannerActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="biometric-camera-scanner-modal">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={closeAttendanceScanner} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden z-10 font-sans flex flex-col"
          >
            <div className="bg-slate-900 px-5 py-4 text-white flex justify-between items-center">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Camera className="h-4 w-4 text-indigo-400" />
                {t("liveFacialSymmetryTitle")}
              </h3>
              <button
                id="close-scanner-modal-btn"
                onClick={closeAttendanceScanner}
                className="text-slate-400 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 flex flex-col items-center justify-center space-y-4">
              {/* Actual camera screen or Scan feedback */}
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner flex items-center justify-center">
                {!scanResult ? (
                  <>
                    <video 
                      ref={videoRef} 
                      className="w-full h-full object-cover scale-x-[-1]" 
                      autoPlay 
                      playsInline 
                      muted 
                    />
                    
                    {/* Visual alignment grid mockup helper to guide the users */}
                    <div className="absolute inset-0 border-2 border-indigo-500/10 pointer-events-none rounded-xl flex items-center justify-center">
                      <div className="border border-dashed border-indigo-400/50 rounded-full w-[180px] h-[240px] flex items-center justify-center relative">
                        <span className="text-[10px] text-indigo-400/50 font-bold uppercase tracking-wider absolute -top-5">{t("alignFaceHelper")}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-5 text-center text-white space-y-3 font-medium animate-fade-in">
                    {scanResult.success ? (
                      <>
                        <CheckCircle className="h-10 w-10 text-emerald-500 shrink-0" />
                        <h4 className="text-base font-bold text-emerald-400">{t("biometricConfirmed")}</h4>
                        <div className="text-xs bg-slate-800 border border-slate-700/60 rounded px-3.5 py-1 font-semibold text-slate-300">
                          {t("similarityScore", { score: scanResult.confidence })}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs bg-slate-800/50 p-2.5 rounded border border-slate-705">
                          {localizeMatchExplanation(scanResult.analysis || "")}
                        </p>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-10 w-10 text-rose-500 shrink-0" />
                        <h4 className="text-base font-bold text-rose-400">{t("biometricRejected")}</h4>
                        {scanResult.confidence !== undefined && (
                          <div className="text-xs bg-slate-800 border border-slate-700/60 rounded px-3.5 py-1 font-semibold text-rose-300">
                            {t("similarityScore", { score: scanResult.confidence })}
                          </div>
                        )}
                        <p className="text-xs text-slate-300 leading-relaxed max-w-xs bg-slate-800/50 p-2.5 rounded border border-slate-700">
                          {scanResult.error || (scanResult.analysis ? localizeMatchExplanation(scanResult.analysis) : t("biometricRejectedDesc"))}
                        </p>
                      </>
                    )}
                  </div>
                )}

                {captureLoading && (
                  <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2 font-medium">
                    <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider">{t("analyzingBiometrics")}</span>
                  </div>
                )}
              </div>

              {cameraError && (
                <div className="w-full text-xs text-rose-600 bg-rose-50 border border-rose-150 rounded-lg p-2.5 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}

              {/* Demo toggle switch option to test rejected flows */}
              {!scanResult && (
                <div className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 animate-fade-in text-xs font-semibold">
                  <label htmlFor="simulate-wrong-face-chk" className="text-[11px] font-bold text-slate-600 flex items-center gap-2 cursor-pointer select-none">
                    <input
                      id="simulate-wrong-face-chk"
                      type="checkbox"
                      checked={simulateWrongFace}
                      onChange={(e) => setSimulateWrongFace(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                    />
                    {t("simulateDifferentFace")}
                  </label>
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">Demo Mode</span>
                </div>
              )}

              {/* Action Operations bottom button */}
              <div className="w-full flex gap-3 justify-end border-t border-slate-100 pt-4">
                {!scanResult ? (
                  <>
                    <button
                      id="cancel-scanner-action-btn"
                      type="button"
                      onClick={closeAttendanceScanner}
                      className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      id="verify-biometrics-capture-btn"
                      type="button"
                      onClick={performFacialVerification}
                      disabled={captureLoading}
                      className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition cursor-pointer shadow-sm flex items-center gap-1"
                    >
                      {t("verifyPassportBtn")}
                    </button>
                  </>
                ) : (
                  <button
                    id="finish-scanner-flow-btn"
                    type="button"
                    onClick={closeAttendanceScanner}
                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition cursor-pointer shadow-sm"
                  >
                    {t("finishClockInBtn")}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: CHANGE PASSWORD */}
      {showChangePassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="change-pass-modal">
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
                  id="student-current-pass-input"
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
                  id="student-new-pass-input"
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
                  id="student-confirm-pass-input"
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
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
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

      {/* MODAL: COURSE DETAILS AND ENROLLED PEERS */}
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
              <button
                id="close-course-details-modal-btn"
                onClick={() => setSelectedCourseDetails(null)}
                className="text-slate-400 hover:text-white font-bold cursor-pointer text-sm"
              >
                ✕
              </button>
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
                    Classmates Enrolled
                  </h4>
                  <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100/50 px-2.5 py-0.5 rounded-full">
                    {selectedCourseDetails.studentIds.length} Registered
                  </span>
                </div>

                {/* Students list */}
                {(() => {
                  const enrolledList = allStudents.filter(
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
                        <div key={s.id} className="flex items-center justify-between p-2.5 bg-white border border-slate-150 rounded-xl hover:bg-slate-50 transition shadow-xs">
                          <div className="flex items-center gap-3">
                            {s.photo ? (
                              <img src={s.photo} alt={s.name} className="h-9 w-9 rounded-lg object-cover border border-slate-200" />
                            ) : (
                              <div className="h-9 w-9 rounded-lg bg-slate-100 border border-dashed border-slate-200 flex items-center justify-center text-slate-300">
                                <ImageIcon className="h-4 w-4" />
                              </div>
                            )}
                            <div>
                              <span className="block text-xs font-bold text-slate-900 leading-snug">{s.name} {s.id === user.id ? "(You)" : ""}</span>
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

              {/* Close Button */}
              <div className="border-t border-slate-150/80 pt-4 flex justify-end">
                <button
                  id="close-details-dlg-btn"
                  onClick={() => setSelectedCourseDetails(null)}
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 active:bg-slate-900 rounded-lg transition cursor-pointer shadow-sm"
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
