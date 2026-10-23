"use client";

import { Printer } from "lucide-react";
import { useI18n } from "@/components/context";
import { LanguageToggle, ThemeToggle } from "@/components/preference-toggles";

export function ShareActions() {
  const { tr } = useI18n();

  return (
    <div className="no-print flex items-center gap-1.5">
      <LanguageToggle compact />
      <ThemeToggle />
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => window.print()}
      >
        <Printer size={14} />
        <span className="hidden sm:inline">{tr("sharePrint")}</span>
      </button>
    </div>
  );
}
