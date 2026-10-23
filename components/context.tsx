"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { t, type TranslationKey } from "@/lib/i18n";
import type { Lang, Theme } from "@/lib/types";

interface LanguageContextValue {
  lang: Lang;
  tr: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);
const ThemeContext = createContext<ThemeContextValue | null>(null);

async function savePreference(body: { lang?: Lang; theme?: Theme }) {
  const response = await fetch("/api/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Could not save preference");
}

export function AppProviders({
  lang,
  theme,
  children,
}: {
  lang: Lang;
  theme: Theme;
  children: ReactNode;
}) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(theme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", currentTheme === "dark");
  }, [currentTheme]);

  const setTheme = useCallback(
    (next: Theme) => {
      setCurrentTheme(next);
      document.documentElement.classList.toggle("dark", next === "dark");
      void savePreference({ theme: next }).catch(() => undefined);
    },
    [],
  );

  const languageValue = useMemo<LanguageContextValue>(
    () => ({
      lang,
      tr: (key, vars) => t(lang, key, vars),
    }),
    [lang],
  );

  const themeValue = useMemo<ThemeContextValue>(
    () => ({
      theme: currentTheme,
      setTheme,
    }),
    [currentTheme, setTheme],
  );

  useEffect(() => {
    document.documentElement.lang = lang === "kh" ? "km" : "en";
  }, [lang]);

  return (
    <LanguageContext.Provider value={languageValue}>
      <ThemeContext.Provider value={themeValue}>{children}</ThemeContext.Provider>
    </LanguageContext.Provider>
  );
}

export function useI18n(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useI18n must be used inside AppProviders");
  return value;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside AppProviders");
  return value;
}

export function useLanguageSwitcher() {
  const router = useRouter();
  const { lang } = useI18n();
  const [pending, setPending] = useState(false);

  const switchLanguage = useCallback(
    async (next: Lang) => {
      if (next === lang || pending) return;
      setPending(true);
      try {
        await savePreference({ lang: next });
        document.documentElement.lang = next === "kh" ? "km" : "en";
        router.refresh();
      } finally {
        setPending(false);
      }
    },
    [lang, pending, router],
  );

  return { lang, pending, switchLanguage };
}
