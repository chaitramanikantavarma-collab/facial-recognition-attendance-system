import React, { useState } from "react";
import { LogIn, Shield, GraduationCap, Eye, EyeOff, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { useLanguage } from "../context/LanguageContext";
import LanguageSelector from "./LanguageSelector";

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [role, setRole] = useState<"teacher" | "student">("teacher");
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !password) {
      setError(t("emptyCredentialsError"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password, role }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        onLoginSuccess(data.user);
      } else {
        // Simple heuristic translation of any server validation message or fallbacks
        if (data.message === "Invalid credentials or user role") {
          setError(t("incorrectCredentialsError"));
        } else {
          setError(data.message || t("incorrectCredentialsError"));
        }
      }
    } catch (err) {
      setError(t("serverError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[90vh] flex-col items-center justify-center bg-slate-50 p-4 font-sans" id="login-screen-container">
      {/* Top right language selector container tailored to login card layout */}
      <div className="mb-4 flex w-full max-w-md justify-end animate-fade-in" id="login-lang-dock">
        <LanguageSelector />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        id="login-card"
      >
        <div className="bg-slate-900 px-6 py-8 text-center text-white">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-md">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("loginTitle")}</h1>
          <p className="mt-1.5 text-xs text-slate-400">{t("loginSubtitle")}</p>
        </div>

        <div className="p-6">
          {/* Role selection tab pills */}
          <div className="mb-6 flex rounded-lg bg-slate-100 p-1" id="role-selector">
            <button
              id="role-teacher-btn"
              type="button"
              onClick={() => { setRole("teacher"); setError(null); }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-xs font-medium transition-all ${
                role === "teacher"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              {t("roleFaculty")}
            </button>
            <button
              id="role-student-btn"
              type="button"
              onClick={() => { setRole("student"); setError(null); }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-xs font-medium transition-all ${
                role === "student"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <GraduationCap className="h-4 w-4" />
              {t("roleStudent")}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-600 border border-rose-200"
                id="login-error-alert"
              >
                {error}
              </motion.div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                {role === "teacher" ? t("idLabelTeacher") : t("idLabelStudent")}
              </label>
              <input
                id="login-id-input"
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder={role === "teacher" ? t("idPlaceholderTeacher") : t("idPlaceholderStudent")}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 hover:bg-slate-50 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                {t("passwordLabel")}
              </label>
              <div className="relative">
                <input
                  id="login-password-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("passwordPlaceholder")}
                  className="w-full rounded-lg border border-slate-200 pl-3.5 pr-10 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 hover:bg-slate-50 transition"
                />
                <button
                  type="button"
                  id="toggle-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 py-2.5 text-sm font-medium text-white transition disabled:bg-indigo-400/80 cursor-pointer shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("verifyingText")}
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  {t("loginBtn")}
                </>
              )}
            </button>
          </form>

          {/* Quick instructions / Help labels */}
          <div className="mt-6 border-t border-slate-100 pt-4 text-center">
            <span className="text-xs text-slate-400 block font-medium">{t("testCredentialsTitle")}</span>
            <div className="mt-2 text-[11px] text-slate-500 bg-slate-50/80 rounded-lg p-2 border border-slate-100 text-left space-y-1">
              <p>🧬 <strong>{t("facultyText")}:</strong> <code className="bg-white px-1 py-0.5 rounded border">T101</code> &nbsp;|&nbsp; <strong>{t("passText")}:</strong> <code className="bg-white px-1 py-0.5 rounded border">password123</code></p>
              <p>🎓 <strong>{t("studentText")}:</strong> <code className="bg-white px-1 py-0.5 rounded border">STUD-2026-001</code> &nbsp;|&nbsp; <strong>{t("passText")}:</strong> <code className="bg-white px-1 py-0.5 rounded border">password123</code></p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
