"use client";

import { Plus } from "lucide-react";
import { useI18n } from "@/components/context";
import { useQuickAdd } from "@/components/quick-add";

export function AddActivityButton({
  caseId,
  small = true,
  label,
}: {
  caseId: string;
  small?: boolean;
  label?: string;
}) {
  const { tr } = useI18n();
  const { open } = useQuickAdd();
  return (
    <button
      type="button"
      onClick={() => open(caseId)}
      className={`btn btn-secondary ${small ? "btn-sm" : ""}`}
    >
      <Plus size={14} strokeWidth={1.9} />
      {label ?? tr("addActivity")}
    </button>
  );
}
