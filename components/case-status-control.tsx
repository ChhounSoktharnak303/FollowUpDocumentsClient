"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useI18n } from "@/components/context";
import { useToast } from "@/components/toast";
import { apiErrorKey, sendJson } from "@/lib/client-api";
import { CASE_STATUSES, statusLabel } from "@/lib/status";
import type { AppSettings, CaseStatus } from "@/lib/types";

export function CaseStatusControl({
  caseId,
  currentStatus,
  settings,
}: {
  caseId: string;
  currentStatus: CaseStatus;
  settings: AppSettings;
}) {
  const { lang, tr } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<CaseStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const value = draft ?? currentStatus;

  const save = async () => {
    if (busy || value === currentStatus) return;
    setBusy(true);
    setError("");
    try {
      await sendJson(`/api/cases/${caseId}`, "PATCH", { status: value });
      setDraft(null);
      toast.push(tr("toastStatusUpdated"));
      router.refresh();
    } catch (requestError) {
      setError(tr(apiErrorKey(requestError)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label htmlFor="case-status" className="field-label">
        {tr("caseStatusLabel")}
      </label>
      <div className="flex items-center gap-2">
        <select
          id="case-status"
          className="select"
          value={value}
          onChange={(event) => setDraft(event.target.value as CaseStatus)}
          disabled={busy}
        >
          {CASE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status, lang, settings)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-icon btn-primary shrink-0"
          onClick={() => void save()}
          disabled={busy || value === currentStatus}
          aria-label={tr("updateStatus")}
          title={tr("updateStatus")}
        >
          <Check size={16} strokeWidth={2} />
        </button>
      </div>
      <p className="hint mt-1.5">{tr("updateStatusHint")}</p>
      {error ? (
        <p className="mt-1 text-[0.72rem] text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
