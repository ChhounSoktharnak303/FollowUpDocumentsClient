"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  Check,
  ChevronLeft,
  PenLine,
  Search,
  X,
} from "lucide-react";
import { useI18n } from "@/components/context";
import { useToast } from "@/components/toast";
import { apiErrorKey, sendJson } from "@/lib/client-api";
import { todayIso } from "@/lib/format";
import { ACTIVITY_STATUSES, optionLabel } from "@/lib/status";
import type {
  ActivityStatus,
  AppSettings,
  CasePickerItem,
  Template,
} from "@/lib/types";

interface QuickAddContextValue {
  open: (caseId?: string) => void;
  close: () => void;
  isOpen: boolean;
}

const QuickAddContext = createContext<QuickAddContextValue | null>(null);

interface QuickAddProviderProps {
  cases: CasePickerItem[];
  templates: Template[];
  settings: AppSettings;
  children: ReactNode;
}

export function QuickAddProvider({
  cases,
  templates,
  settings,
  children,
}: QuickAddProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialCaseId, setInitialCaseId] = useState<string | undefined>(
    undefined,
  );

  const open = useCallback((caseId?: string) => {
    setInitialCaseId(caseId);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      if (event.key.toLowerCase() === "n" && !isOpen) {
        event.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, open]);

  const value = useMemo(
    () => ({ open, close, isOpen }),
    [open, close, isOpen],
  );

  return (
    <QuickAddContext.Provider value={value}>
      {children}
      {isOpen ? (
        <QuickAddModal
          initialCaseId={initialCaseId}
          onClose={close}
          cases={cases}
          templates={templates}
          settings={settings}
        />
      ) : null}
    </QuickAddContext.Provider>
  );
}

export function useQuickAdd(): QuickAddContextValue {
  const value = useContext(QuickAddContext);
  if (!value) throw new Error("useQuickAdd must be used inside QuickAddProvider");
  return value;
}

function QuickAddModal({
  initialCaseId,
  onClose,
  cases,
  templates,
  settings,
}: {
  initialCaseId?: string;
  onClose: () => void;
  cases: CasePickerItem[];
  templates: Template[];
  settings: AppSettings;
}) {
  const { lang, tr } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const actionRef = useRef<HTMLInputElement>(null);

  const initialSelected = initialCaseId
    ? cases.find((item) => item.id === initialCaseId)
    : undefined;
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelected?.id ?? null,
  );
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [status, setStatus] = useState<ActivityStatus>("in_progress");
  const [date, setDate] = useState(todayIso());
  const [ministry, setMinistry] = useState(
    initialSelected?.ministry || settings.ministries[0]?.id || "",
  );
  const [signed, setSigned] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedCase = cases.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = original;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (selectedId) {
        actionRef.current?.focus();
      } else {
        searchRef.current?.focus();
      }
    }, 60);
    return () => window.clearTimeout(timer);
  }, [selectedId]);

  const selectCase = (item: CasePickerItem) => {
    setSelectedId(item.id);
    setMinistry(item.ministry || settings.ministries[0]?.id || "");
    setError("");
  };

  const filteredCases = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return cases;
    return cases.filter((item) => {
      const service = optionLabel(item.serviceType, lang, settings.serviceTypes);
      const ministryLabel = optionLabel(item.ministry, lang, settings.ministries);
      return [
        item.clientNameKh,
        item.clientNameEn,
        item.serviceType,
        item.ministry,
        service,
        ministryLabel,
      ]
        .join("\n")
        .toLowerCase()
        .includes(needle);
    });
  }, [cases, lang, search, settings.ministries, settings.serviceTypes]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const template = templates.find((item) => item.id === id);
    if (template) {
      setAction(
        (lang === "kh" ? template.textKh : template.textEn) ||
          template.textEn ||
          template.textKh,
      );
    }
  };

  const close = () => {
    if (busy) return;
    onClose();
  };

  const submit = async () => {
    if (busy) return;
    setError("");
    if (!selectedId) {
      setError(tr("quickAddCaseRequired"));
      return;
    }
    if (!action.trim()) {
      setError(tr("quickAddActionRequired"));
      actionRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      await sendJson("/api/activities", "POST", {
        caseId: selectedId,
        date,
        ministry,
        action: action.trim(),
        status,
        signed,
        note,
      });
      toast.push(tr("toastActivityAdded"));
      onClose();
      router.refresh();
    } catch (requestError) {
      setError(tr(apiErrorKey(requestError)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby="quick-add-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) close();
      }}
    >
      <form
        className="modal-shell"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            (event.ctrlKey || event.metaKey) &&
            !busy
          ) {
            event.preventDefault();
            event.currentTarget.requestSubmit();
          }
        }}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">{tr("quickAddTitle")}</p>
            <h2 id="quick-add-title" className="section-title mt-1 !text-lg">
              {selectedCase
                ? lang === "kh"
                  ? selectedCase.clientNameKh || selectedCase.clientNameEn
                  : selectedCase.clientNameEn || selectedCase.clientNameKh
                : tr("quickAddSelectCase")}
            </h2>
            <p className="hint mt-0.5">{tr("quickAddDesc")}</p>
          </div>
          <button
            type="button"
            className="btn btn-icon btn-quiet -mr-1 -mt-1"
            onClick={close}
            aria-label={tr("close")}
            disabled={busy}
          >
            <X size={18} strokeWidth={1.7} />
          </button>
        </div>

        <div className="modal-body">
          {selectedCase ? (
            <div>
              <div className="flex items-center justify-between gap-3">
                <span className="field-label !mb-0">{tr("quickAddSelectedCase")}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-quiet"
                  onClick={() => {
                    setSelectedId(null);
                    setSearch("");
                  }}
                >
                  <ChevronLeft size={13} />
                  {tr("quickAddChangeCase")}
                </button>
              </div>
              <div className="selected-case mt-1.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {lang === "kh"
                      ? selectedCase.clientNameKh || selectedCase.clientNameEn
                      : selectedCase.clientNameEn || selectedCase.clientNameKh}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.72rem] text-muted">
                    <span>
                      {optionLabel(
                        selectedCase.serviceType,
                        lang,
                        settings.serviceTypes,
                      )}
                    </span>
                    <span className="text-line-strong">/</span>
                    <span className="inline-flex items-center gap-1">
                      <Building2 size={11} />
                      {optionLabel(
                        selectedCase.ministry,
                        lang,
                        settings.ministries,
                      )}
                    </span>
                  </div>
                </div>
                <span className="chip" data-status={selectedCase.status}>
                  <span className="chip-dot" />
                  {settings.statusLabels[selectedCase.status][lang]}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="quick-case-search" className="field-label">
                {tr("quickAddSearchCase")}
              </label>
              <div className="relative">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  ref={searchRef}
                  id="quick-case-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={tr("quickAddSearchPlaceholder")}
                  className="input input-search"
                  autoComplete="off"
                />
              </div>
              {cases.length === 0 ? (
                <div className="empty-state !py-10">
                  <p className="empty-description">{tr("quickAddNoCasesAtAll")}</p>
                </div>
              ) : filteredCases.length === 0 ? (
                <p className="hint mt-4 text-center">{tr("quickAddNoCases")}</p>
              ) : (
                <div className="case-search-list" role="listbox" aria-label={tr("quickAddSelectCase")}>
                  {filteredCases.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="case-option"
                      role="option"
                      aria-selected={false}
                      onClick={() => selectCase(item)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {lang === "kh"
                            ? item.clientNameKh || item.clientNameEn
                            : item.clientNameEn || item.clientNameKh}
                        </span>
                        <span className="mt-0.5 block truncate text-[0.7rem] text-muted">
                          {optionLabel(item.serviceType, lang, settings.serviceTypes)}
                          {" · "}
                          {optionLabel(item.ministry, lang, settings.ministries)}
                        </span>
                      </span>
                      <span className="chip shrink-0" data-status={item.status}>
                        <span className="chip-dot" />
                        {settings.statusLabels[item.status][lang]}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedCase ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="activity-date" className="field-label">
                    {tr("quickAddDate")}
                  </label>
                  <div className="relative">
                    <CalendarDays
                      size={14}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                    />
                    <input
                      id="activity-date"
                      type="date"
                      className="input input-search tnum"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="activity-ministry" className="field-label">
                    {tr("quickAddMinistry")}
                  </label>
                  <select
                    id="activity-ministry"
                    className="select"
                    value={ministry}
                    onChange={(event) => setMinistry(event.target.value)}
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

              <div>
                <label htmlFor="activity-template" className="field-label">
                  {tr("quickAddTemplate")}
                </label>
                <select
                  id="activity-template"
                  className="select"
                  value={templateId}
                  onChange={(event) => applyTemplate(event.target.value)}
                >
                  <option value="">{tr("quickAddNoTemplate")}</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {(lang === "kh" ? template.textKh : template.textEn) ||
                        template.textEn ||
                        template.textKh}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="activity-action" className="field-label">
                  {tr("quickAddAction")}
                </label>
                <input
                  ref={actionRef}
                  id="activity-action"
                  type="text"
                  className="input"
                  value={action}
                  onChange={(event) => {
                    setAction(event.target.value);
                    if (templateId) setTemplateId("");
                  }}
                  placeholder={tr("quickAddActionPlaceholder")}
                  maxLength={2000}
                  required
                />
              </div>

              <div>
                <span className="field-label">{tr("quickAddStatus")}</span>
                <div className="status-choices" role="group" aria-label={tr("quickAddStatus")}>
                  {ACTIVITY_STATUSES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className="status-choice"
                      data-status={value}
                      aria-pressed={status === value}
                      onClick={() => setStatus(value)}
                    >
                      {status === value ? <Check size={12} /> : <span className="chip-dot" />}
                      {settings.statusLabels[value][lang]}
                    </button>
                  ))}
                </div>
                {status === "rejected" ? (
                  <p className="hint mt-1.5">{tr("quickAddTerminalHint")}</p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
                <label className="flex cursor-pointer items-center gap-2 pt-1 text-[0.8rem] font-medium text-ink-soft">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={signed}
                    onChange={(event) => setSigned(event.target.checked)}
                  />
                  <PenLine size={14} className="text-muted" />
                  {tr("quickAddSigned")}
                </label>
                <div>
                  <label htmlFor="activity-note" className="field-label">
                    {tr("quickAddNote")}{" "}
                    <span className="font-normal text-muted">({tr("optional")})</span>
                  </label>
                  <textarea
                    id="activity-note"
                    className="textarea !min-h-[4.4rem]"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={tr("quickAddNotePlaceholder")}
                    maxLength={5000}
                  />
                </div>
              </div>

              {error ? (
                <div className="error-box" role="alert">
                  {error}
                </div>
              ) : null}
            </div>
          ) : error ? (
            <div className="error-box mt-4" role="alert">
              {error}
            </div>
          ) : null}
        </div>

        <div className="modal-foot">
          <span className="hint hidden items-center gap-1.5 sm:flex">
            <kbd className="kbd">Ctrl</kbd>
            <span>+</span>
            <kbd className="kbd">Enter</kbd>
            <span className="ml-1">{tr("quickAddShortcut")}</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={close}
              disabled={busy}
            >
              {tr("cancel")}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || !selectedId}
            >
              {busy ? tr("quickAddSaving") : tr("quickAddSave")}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
