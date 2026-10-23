"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  Clock3,
  PenLine,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
} from "lucide-react";
import { useI18n } from "@/components/context";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useQuickAdd } from "@/components/quick-add";
import { useToast } from "@/components/toast";
import { apiErrorKey, sendJson } from "@/lib/client-api";
import { formatDisplayDate } from "@/lib/format";
import {
  ACTIVITY_STATUSES,
  optionLabel,
  statusLabel,
} from "@/lib/status";
import type {
  Activity,
  ActivityStatus,
  AppSettings,
} from "@/lib/types";

interface ActivityDraft {
  date: string;
  ministry: string;
  action: string;
  status: ActivityStatus;
  signed: boolean;
  note: string;
}

export function ActivityTimeline({
  activities,
  settings,
  caseId,
}: {
  activities: Activity[];
  settings: AppSettings;
  caseId: string;
}) {
  const { lang, tr } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const { open } = useQuickAdd();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ActivityDraft | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Activity | null>(null);

  const ordered = useMemo(
    () =>
      [...activities].sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          b.createdAt.localeCompare(a.createdAt) ||
          b.id.localeCompare(a.id),
      ),
    [activities],
  );

  const startEdit = (activity: Activity) => {
    setEditingId(activity.id);
    setError("");
    setDraft({
      date: activity.date,
      ministry: activity.ministry,
      action: activity.action,
      status: activity.status,
      signed: activity.signed,
      note: activity.note,
    });
  };

  const save = async () => {
    if (!editingId || !draft || busy) return;
    if (!draft.action.trim()) {
      setError(tr("quickAddActionRequired"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await sendJson(`/api/activities/${editingId}`, "PATCH", {
        date: draft.date,
        ministry: draft.ministry,
        action: draft.action.trim(),
        status: draft.status,
        signed: draft.signed,
        note: draft.note,
      });
      toast.push(tr("toastActivityUpdated"));
      setEditingId(null);
      setDraft(null);
      router.refresh();
    } catch (requestError) {
      setError(tr(apiErrorKey(requestError)));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget || busy) return;
    setBusy(true);
    try {
      await sendJson(`/api/activities/${deleteTarget.id}`, "DELETE");
      toast.push(tr("toastActivityDeleted"));
      setDeleteTarget(null);
      router.refresh();
    } catch (requestError) {
      toast.push(tr(apiErrorKey(requestError)), "error");
    } finally {
      setBusy(false);
    }
  };

  if (ordered.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon">
          <Clock3 size={22} strokeWidth={1.6} />
        </span>
        <p className="empty-title">{tr("noActivities")}</p>
        <button
          type="button"
          className="btn btn-secondary mt-4"
          onClick={() => open(caseId)}
        >
          <Plus size={14} />
          {tr("addFirstActivity")}
        </button>
      </div>
    );
  }

  return (
    <>
      <ol className="timeline">
        {ordered.map((activity, index) => {
          const isEditing = editingId === activity.id;
          return (
            <li key={activity.id} className="timeline-item">
              <div className="timeline-axis">
                <span className="timeline-dot" data-status={activity.status} />
                {index < ordered.length - 1 ? <span className="timeline-line" /> : null}
              </div>
              <div className="timeline-content">
                {isEditing && draft ? (
                  <div className="activity-form !mt-0">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="field-label" htmlFor={`edit-date-${activity.id}`}>
                          {tr("activityDate")}
                        </label>
                        <input
                          id={`edit-date-${activity.id}`}
                          type="date"
                          className="input tnum"
                          value={draft.date}
                          onChange={(event) =>
                            setDraft({ ...draft, date: event.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label
                          className="field-label"
                          htmlFor={`edit-ministry-${activity.id}`}
                        >
                          {tr("activityMinistry")}
                        </label>
                        <select
                          id={`edit-ministry-${activity.id}`}
                          className="select"
                          value={draft.ministry}
                          onChange={(event) =>
                            setDraft({ ...draft, ministry: event.target.value })
                          }
                        >
                          <option value="">{tr("quickAddNoMinistry")}</option>
                          {settings.ministries.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option[lang]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mt-3">
                      <label
                        className="field-label"
                        htmlFor={`edit-action-${activity.id}`}
                      >
                        {tr("activityAction")}
                      </label>
                      <textarea
                        id={`edit-action-${activity.id}`}
                        className="textarea !min-h-[4.25rem]"
                        value={draft.action}
                        onChange={(event) =>
                          setDraft({ ...draft, action: event.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="mt-3">
                      <span className="field-label">{tr("quickAddStatus")}</span>
                      <div className="status-choices">
                        {ACTIVITY_STATUSES.map((value) => (
                          <button
                            key={value}
                            type="button"
                            className="status-choice"
                            data-status={value}
                            aria-pressed={draft.status === value}
                            onClick={() => setDraft({ ...draft, status: value })}
                          >
                            {draft.status === value ? (
                              <Check size={12} />
                            ) : (
                              <span className="chip-dot" />
                            )}
                            {statusLabel(value, lang, settings)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
                      <label className="flex cursor-pointer items-center gap-2 pt-1 text-[0.8rem] text-ink-soft">
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={draft.signed}
                          onChange={(event) =>
                            setDraft({ ...draft, signed: event.target.checked })
                          }
                        />
                        <PenLine size={13} className="text-muted" />
                        {tr("signed")}
                      </label>
                      <div>
                        <label
                          className="field-label"
                          htmlFor={`edit-note-${activity.id}`}
                        >
                          {tr("internalNote")}
                        </label>
                        <textarea
                          id={`edit-note-${activity.id}`}
                          className="textarea !min-h-[3.5rem]"
                          value={draft.note}
                          onChange={(event) =>
                            setDraft({ ...draft, note: event.target.value })
                          }
                        />
                      </div>
                    </div>
                    {error ? (
                      <div className="error-box mt-3" role="alert">
                        {error}
                      </div>
                    ) : null}
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-quiet"
                        onClick={() => {
                          setEditingId(null);
                          setDraft(null);
                          setError("");
                        }}
                        disabled={busy}
                      >
                        {tr("cancel")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => void save()}
                        disabled={busy}
                      >
                        {busy ? tr("saving") : tr("saveChanges")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="timeline-meta">
                      <span className="timeline-date tnum">
                        {formatDisplayDate(activity.date, lang)}
                      </span>
                      <span className="chip" data-status={activity.status}>
                        <span className="chip-dot" />
                        {statusLabel(activity.status, lang, settings)}
                      </span>
                      {activity.ministry ? (
                        <span className="inline-flex items-center gap-1">
                          <Building2 size={11} />
                          {optionLabel(activity.ministry, lang, settings.ministries)}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1">
                        <PenLine size={11} />
                        {activity.signed ? tr("signedYes") : tr("signedNo")}
                      </span>
                      <span className="timeline-actions">
                        <button
                          type="button"
                          className="btn btn-icon btn-quiet !h-7 !min-h-7 !w-7"
                          onClick={() => startEdit(activity)}
                          aria-label={tr("editActivity")}
                          title={tr("editActivity")}
                        >
                          <Pencil size={13} strokeWidth={1.7} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-icon btn-quiet !h-7 !min-h-7 !w-7 hover:!text-danger"
                          onClick={() => setDeleteTarget(activity)}
                          aria-label={tr("deleteActivity")}
                          title={tr("deleteActivity")}
                        >
                          <Trash2 size={13} strokeWidth={1.7} />
                        </button>
                      </span>
                    </div>
                    <p className="timeline-action">{activity.action}</p>
                    {activity.note ? (
                      <div className="timeline-note">
                        <span className="mb-1 flex items-center gap-1 text-[0.64rem] font-semibold uppercase tracking-[0.08em] text-muted">
                          <StickyNote size={11} />
                          {tr("internalNote")}
                        </span>
                        {activity.note}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={tr("deleteActivity")}
        description={tr("deleteActivityConfirm")}
        confirmLabel={tr("delete")}
        onConfirm={() => void remove()}
        onCancel={() => setDeleteTarget(null)}
        busy={busy}
      />
    </>
  );
}
