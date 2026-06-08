import React from "react";
import { useLanguage } from "../context/LanguageContext";
import { Globe } from "lucide-react";

export default function LanguageSelector() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-1 bg-slate-850 bg-slate-900 border border-slate-700/60 rounded-lg p-1 text-[11px] font-semibold text-slate-300" id="global-language-selector">
      <Globe className="h-3.5 w-3.5 text-indigo-400 mx-1 shrink-0" />
      <button
        id="lang-toggle-en-btn"
        type="button"
        onClick={() => setLanguage("en")}
        className={`px-2 py-0.5 rounded transition ${
          language === "en"
            ? "bg-indigo-600 text-white shadow"
            : "hover:text-white hover:bg-slate-800"
        }`}
      >
        English
      </button>
      <button
        id="lang-toggle-ko-btn"
        type="button"
        onClick={() => setLanguage("ko")}
        className={`px-2 py-0.5 rounded transition ${
          language === "ko"
            ? "bg-indigo-600 text-white shadow"
            : "hover:text-white hover:bg-slate-800"
        }`}
      >
        한국어
      </button>
    </div>
  );
}
