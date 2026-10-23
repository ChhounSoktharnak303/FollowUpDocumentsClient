"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useI18n } from "@/components/context";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { tr } = useI18n();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="page-wrap">
      <div className="surface-card empty-state mx-auto mt-10 max-w-xl">
        <span className="empty-icon">
          <AlertTriangle size={22} strokeWidth={1.6} />
        </span>
        <h1 className="empty-title">{tr("errorTitle")}</h1>
        <p className="empty-description mt-1">{tr("errorGeneric")}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button type="button" className="btn btn-primary" onClick={reset}>
            <RotateCcw size={14} />
            {tr("tryAgain")}
          </button>
          <Link href="/" className="btn btn-secondary">
            {tr("navToday")}
          </Link>
        </div>
      </div>
    </main>
  );
}
