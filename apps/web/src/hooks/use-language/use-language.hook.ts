import { useEffect, useState } from "react";
import type { Language } from "../../lib/types/language.type";
import { copy, type Copy } from "./copy";

const STORAGE_KEY = "altin:language";

function initialLanguage(): Language {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "ar" || saved === "en") return saved;
  return navigator.language.toLowerCase().startsWith("ar") ? "ar" : "en";
}

export function useLanguage(): {
  language: Language;
  dir: "rtl" | "ltr";
  setLanguage: (language: Language) => void;
  copy: Copy;
} {
  const [language, setLanguage] = useState<Language>(initialLanguage);

  // dir on <html> flips the whole layout; the CSS uses logical properties so nothing else changes.
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  return { language, dir: language === "ar" ? "rtl" : "ltr", setLanguage, copy: copy[language] };
}
