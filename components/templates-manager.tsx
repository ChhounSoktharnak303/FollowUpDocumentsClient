"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useI18n } from "@/components/context";
import { useToast } from "@/components/toast";
import { apiErrorKey, sendJson } from "@/lib/client-api";
import type { Template } from "@/lib/types";

export function TemplatesManager({
  initialTemplates,
}: {
  initialTemplates: Template[];
}) {
  const { tr } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState(initialTemplates);
  const [newKh, setNewKh] = useState("");
  const [newEn, setNewEn] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Template | null>(null);

  const updateRow = (id: string, field: "textKh" | "textEn", value: string) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  };

  const saveRow = async (row: Template) => {
    if (busyKey) return;
    if (!row.textKh.trim() || !row.textEn.trim()) {
      setError(tr("errorValidation"));
      return;
    }
    setError("");
    setBusyKey(`save-${row.id}`);
    try {
      const result = await sendJson<{ template: Template }>(
        `/api/templates/${row.id}`,
        "PUT",
        { textKh: row.textKh, textEn: row.textEn },
      );
      setRows((current) =>
        current.map((item) =>
          item.id === row.id ? result.template : item,
        ),
      );
      toast.push(tr("toastTemplateUpdated"));
      router.refresh();
    } catch (requestError) {
      setError(tr(apiErrorKey(requestError)));
    } finally {
      setBusyKey("");
    }
  };

  const addRow = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busyKey) return;
    if (!newKh.trim() || !newEn.trim()) {
      setError(tr("errorValidation"));
      return;
    }
    setError("");
    setBusyKey("new");
    try {
      const result = await sendJson<{ template: Template }>(
        "/api/templates",
        "POST",
        { textKh: newKh, textEn: newEn },
      );
      setRows((current) => [...current, result.template]);
      setNewKh("");
      setNewEn("");
      toast.push(tr("toastTemplateAdded"));
      router.refresh();
    } catch (requestError) {
      setError(tr(apiErrorKey(requestError)));
    } finally {
      setBusyKey("");
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete || busyKey) return;
    const target = pendingDelete;
    setBusyKey(`delete-${target.id}`);
    setError("");
    try {
      await sendJson<{ ok: boolean }>(
        `/api/templates/${target.id}`,
        "DELETE",
      );
      setRows((current) => current.filter((row) => row.id !== target.id));
      setPendingDelete(null);
      toast.push(tr("toastTemplateDeleted"));
      router.refresh();
    } catch (requestError) {
      setError(tr(apiErrorKey(requestError)));
    } finally {
      setBusyKey("");
    }
  };

  return (
    <section className="panel">
      <div className="panel-head !items-start">
        <div>
          <h2 className="section-title">{tr("templatesSection")}</h2>
          <p className="hint mt-0.5 max-w-2xl">{tr("templatesSectionDesc")}</p>
        </div>
        <span className="tnum text-[0.7rem] text-muted">{rows.length}</span>
      </div>
      <div className="panel-body">
        {rows.length === 0 ? (
          <p className="hint">{tr("templatesEmpty")}</p>
        ) : (
          <div className="option-stack">
            {rows.map((row) => (
              <div key={row.id} className="template-row">
                <div>
                  <label className="field-label" htmlFor={`template-${row.id}-kh`}>
                    {tr("templateKh")}
                  </label>
                  <input
                    id={`template-${row.id}-kh`}
                    className="input font-khmer"
                    value={row.textKh}
                    onChange={(event) =>
                      updateRow(row.id, "textKh", event.target.value)
                    }
                    required
                    maxLength={500}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor={`template-${row.id}-en`}>
                    {tr("templateEn")}
                  </label>
                  <input
                    id={`template-${row.id}-en`}
                    className="input"
                    value={row.textEn}
                    onChange={(event) =>
                      updateRow(row.id, "textEn", event.target.value)
                    }
                    required
                    maxLength={500}
                  />
                </div>
                <div className="flex gap-1 md:mt-[1.72rem]">
                  <button
                    type="button"
                    className="btn btn-icon btn-secondary"
                    onClick={() => void saveRow(row)}
                    disabled={Boolean(busyKey)}
                    aria-label={tr("save")}
                    title={tr("save")}
                  >
                    <Check size={15} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-icon btn-quiet hover:!text-danger"
                    onClick={() => setPendingDelete(row)}
                    disabled={Boolean(busyKey)}
                    aria-label={tr("removeTemplate")}
                    title={tr("removeTemplate")}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={(event) => void addRow(event)} className="new-template">
          <div>
            <label htmlFor="new-template-kh" className="field-label">
              {tr("templateKh")}
            </label>
            <input
              id="new-template-kh"
              className="input font-khmer"
              value={newKh}
              onChange={(event) => setNewKh(event.target.value)}
              placeholder={tr("templateKhPlaceholder")}
              maxLength={500}
            />
          </div>
          <div>
            <label htmlFor="new-template-en" className="field-label">
              {tr("templateEn")}
            </label>
            <input
              id="new-template-en"
              className="input"
              value={newEn}
              onChange={(event) => setNewEn(event.target.value)}
              placeholder={tr("templateEnPlaceholder")}
              maxLength={500}
            />
          </div>
          <button
            type="submit"
            className="btn btn-secondary md:mt-[1.72rem]"
            disabled={Boolean(busyKey)}
          >
            <Plus size={14} />
            {busyKey === "new" ? tr("saving") : tr("addTemplate")}
          </button>
        </form>

        {error ? (
          <div className="error-box mt-3" role="alert">
            {error}
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={tr("removeTemplate")}
        description={tr("removeTemplateConfirm")}
        confirmLabel={tr("removeTemplate")}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (!busyKey) setPendingDelete(null);
        }}
        busy={busyKey.startsWith("delete-")}
      />
    </section>
  );
}
