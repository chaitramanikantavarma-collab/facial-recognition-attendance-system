/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import LoginScreen from "./components/LoginScreen";
import TeacherDashboard from "./components/TeacherDashboard";
import StudentDashboard from "./components/StudentDashboard";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";

interface SessionUser {
  id: string;
  name: string;
  role: "teacher" | "student";
  email?: string;
  studentNumber?: string;
  major?: string;
  photo?: string;
}

function AppContent() {
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    // Read user from localStorage if cached
    const cached = localStorage.getItem("attendance_portal_session");
    if (cached) {
      try {
        setCurrentUser(JSON.parse(cached));
      } catch (err) {
        console.error("Local session token corrupt, clearing.", err);
        localStorage.removeItem("attendance_portal_session");
      }
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (userObj: SessionUser) => {
    setCurrentUser(userObj);
    localStorage.setItem("attendance_portal_session", JSON.stringify(userObj));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("attendance_portal_session");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">{t("restoringSession")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {!currentUser ? (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      ) : currentUser.role === "teacher" ? (
        <TeacherDashboard user={currentUser} onLogout={handleLogout} />
      ) : (
        <StudentDashboard user={currentUser} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

