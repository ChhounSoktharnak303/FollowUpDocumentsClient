"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/components/context";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const { tr } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal confirm-modal"
      aria-labelledby="confirm-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      onClick={(event) => {
        if (event.target === ref.current && !busy) onCancel();
      }}
    >
      <div className="modal-head">
        <div>
          <h2 id="confirm-title" className="section-title">
            {title}
          </h2>
          <p className="hint mt-1">{description}</p>
        </div>
        <button
          type="button"
          className="btn btn-icon btn-quiet -mr-1 -mt-1"
          onClick={onCancel}
          aria-label={tr("close")}
          disabled={busy}
        >
          <X size={17} />
        </button>
      </div>
      <div className="modal-foot !border-t-0 !bg-transparent !pt-1">
        <button
          type="button"
          className="btn btn-secondary ml-auto"
          onClick={onCancel}
          disabled={busy}
        >
          {tr("cancel")}
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? tr("saving") : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
