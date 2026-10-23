"use client";

import { LogOut, Plus, Search } from "lucide-react";
import { useI18n } from "@/components/context";
import { LanguageToggle, ThemeToggle } from "@/components/preference-toggles";
import { useQuickAdd } from "@/components/quick-add";

export function TopBar() {
  const { tr } = useI18n();
  const { open } = useQuickAdd();

  return (
    <header className="topbar">
      <form action="/cases" method="get" className="topbar-search" role="search">
        <Search size={16} strokeWidth={1.7} className="search-icon" />
        <input
          type="search"
          name="q"
          className="input"
          placeholder={tr("searchPlaceholder")}
          aria-label={tr("search")}
          maxLength={160}
        />
      </form>

      <div className="topbar-actions">
        <div className="language-toggle">
          <LanguageToggle compact />
        </div>
        <div className="theme-toggle">
          <ThemeToggle />
        </div>
        <form action="/api/logout" method="post" className="hidden max-[860px]:block">
          <button
            type="submit"
            className="btn btn-icon btn-secondary"
            aria-label={tr("logout")}
            title={tr("logout")}
          >
            <LogOut size={16} strokeWidth={1.7} />
          </button>
        </form>
        <button
          type="button"
          className="topbar-shortcut"
          onClick={() => open()}
          aria-label={tr("quickAdd")}
          title={`${tr("quickAdd")} (N)`}
        >
          <Plus size={16} strokeWidth={1.8} />
          <span>{tr("quickAdd")}</span>
          <kbd className="kbd">N</kbd>
        </button>
      </div>
    </header>
  );
}
