"use client";

import { Moon, Sun } from "lucide-react";
import { useI18n, useLanguageSwitcher, useTheme } from "@/components/context";

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { tr, lang } = useI18n();
  const { switchLanguage, pending } = useLanguageSwitcher();

  return (
    <div
      className="inline-flex items-center rounded-lg border border-line bg-surface p-0.5"
      aria-label={tr("language")}
      role="group"
    >
      <button
        type="button"
        onClick={() => void switchLanguage("kh")}
        disabled={pending}
        className={`rounded-md px-2 py-1 text-[0.68rem] font-semibold transition-colors ${
          lang === "kh"
            ? "bg-ink text-paper"
            : "text-muted hover:text-ink"
        }`}
        aria-pressed={lang === "kh"}
      >
        {compact ? "ខ្មែរ" : tr("khmer")}
      </button>
      <button
        type="button"
        onClick={() => void switchLanguage("en")}
        disabled={pending}
        className={`rounded-md px-2 py-1 text-[0.68rem] font-semibold transition-colors ${
          lang === "en"
            ? "bg-ink text-paper"
            : "text-muted hover:text-ink"
        }`}
        aria-pressed={lang === "en"}
      >
        EN
      </button>
    </div>
  );
}

export function ThemeToggle({ light = false }: { light?: boolean }) {
  const { theme, setTheme } = useTheme();
  const { tr } = useI18n();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`btn btn-icon ${
        light ? "border-white/20 bg-white/5 text-white hover:bg-white/10" : "btn-secondary"
      }`}
      aria-label={isDark ? tr("themeLight") : tr("themeDark")}
      title={isDark ? tr("themeLight") : tr("themeDark")}
    >
      {isDark ? <Sun size={16} strokeWidth={1.7} /> : <Moon size={16} strokeWidth={1.7} />}
    </button>
  );
}
