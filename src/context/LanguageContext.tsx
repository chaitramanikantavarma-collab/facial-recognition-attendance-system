import React, { createContext, useContext, useState, useEffect } from "react";
import { Language, translations } from "../utils/translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations["en"], replace?: Record<string, any>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const cached = localStorage.getItem("attendance_portal_lang");
    if (cached === "en" || cached === "ko") {
      setLanguageState(cached);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("attendance_portal_lang", lang);
  };

  const t = (key: keyof typeof translations["en"], replace?: Record<string, any>): string => {
    const translationSet = translations[language] || translations["en"];
    let phrase = translationSet[key] || translations["en"][key] || String(key);
    
    if (replace) {
      Object.entries(replace).forEach(([k, v]) => {
        phrase = phrase.replace(`{${k}}`, String(v));
      });
    }
    
    return phrase;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
