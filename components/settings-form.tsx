"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import { useI18n } from "@/components/context";
import { useToast } from "@/components/toast";
import { apiErrorKey, sendJson } from "@/lib/client-api";
import { CASE_STATUSES } from "@/lib/status";
import type {
  AppSettings,
  CaseStatus,
  LabelPair,
  ListOption,
} from "@/lib/types";

function makeOption(prefix: string): ListOption {
  return {
    id: `${prefix}-${crypto.randomUUID()}`,
    kh: "",
    en: "",
  };
}

export function SettingsForm({ initialSettings }: { initialSettings: AppSettings }) {
  const { tr } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [serviceTypes, setServiceTypes] = useState(initialSettings.serviceTypes);
  const [ministries, setMinistries] = useState(initialSettings.ministries);
  const [statusLabels, setStatusLabels] = useState(initialSettings.statusLabels);
  const [orange, setOrange] = useState(String(initialSettings.warningOrangeDays));
  const [red, setRed] = useState(String(initialSettings.warningRedDays));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const updateStatus = (
    status: CaseStatus,
    lang: keyof LabelPair,
    value: string,
  ) => {
    setStatusLabels((current) => ({
      ...current,
      [status]: { ...current[status], [lang]: value },
    }));
  };

  const updateOption = (
    kind: "serviceTypes" | "ministries",
    id: string,
    field: "kh" | "en",
    value: string,
  ) => {
    const setter = kind === "serviceTypes" ? setServiceTypes : setMinistries;
    setter((current) =>
      current.map((option) =>
        option.id === id ? { ...option, [field]: value } : option,
      ),
    );
  };

  const removeOption = (
    kind: "serviceTypes" | "ministries",
    id: string,
  ) => {
    const setter = kind === "serviceTypes" ? setServiceTypes : setMinistries;
    setter((current) => current.filter((option) => option.id !== id));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const orangeDays = Number.parseInt(orange, 10);
    const redDays = Number.parseInt(red, 10);
    if (!Number.isFinite(orangeDays) || !Number.isFinite(redDays) || redDays <= orangeDays) {
      setError(tr("warningDaysHint"));
      return;
    }
    setError("");
    setBusy(true);
    try {
      await sendJson<{ settings: AppSettings }>("/api/settings", "PUT", {
        serviceTypes: serviceTypes.map((option) => ({
          ...option,
          kh: option.kh.trim(),
          en: option.en.trim(),
        })),
        ministries: ministries.map((option) => ({
          ...option,
          kh: option.kh.trim(),
          en: option.en.trim(),
        })),
        statusLabels,
        warningOrangeDays: orangeDays,
        warningRedDays: redDays,
      });
      toast.push(tr("toastSettingsSaved"));
      router.refresh();
    } catch (requestError) {
      setError(tr(apiErrorKey(requestError)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-6">
      <section className="panel">
        <div className="panel-head !items-start">
          <div>
            <h2 className="section-title">{tr("statusSection")}</h2>
            <p className="hint mt-0.5">{tr("statusSectionDesc")}</p>
          </div>
          <span className="hidden text-[0.62rem] uppercase tracking-widest text-muted md:block">
            {tr("statusCode")}
          </span>
        </div>
        <div className="panel-body">
          <div className="divide-y divide-line">
            {CASE_STATUSES.map((status) => (
              <div
                key={status}
                className="grid gap-3 py-3 first:pt-0 last:pb-0 md:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)] md:items-center"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip" data-status={status}>
                    <span className="chip-dot" />
                    <span className="font-mono text-[0.62rem]">{status}</span>
                  </span>
                  {status === "success" ? (
                    <span className="text-[0.6rem] text-muted">{tr("statusCaseOnly")}</span>
                  ) : null}
                </div>
                <div>
                  <label
                    htmlFor={`status-${status}-kh`}
                    className="field-label md:hidden"
                  >
                    {tr("itemKhLabel")}
                  </label>
                  <input
                    id={`status-${status}-kh`}
                    className="input font-khmer"
                    value={statusLabels[status].kh}
                    onChange={(event) =>
                      updateStatus(status, "kh", event.target.value)
                    }
                    aria-label={`${status} ${tr("itemKhLabel")}`}
                    required
                    maxLength={100}
                  />
                </div>
                <div>
                  <label
                    htmlFor={`status-${status}-en`}
                    className="field-label md:hidden"
                  >
                    {tr("itemEnLabel")}
                  </label>
                  <input
                    id={`status-${status}-en`}
                    className="input"
                    value={statusLabels[status].en}
                    onChange={(event) =>
                      updateStatus(status, "en", event.target.value)
                    }
                    aria-label={`${status} ${tr("itemEnLabel")}`}
                    required
                    maxLength={100}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {(
          [
            {
              kind: "serviceTypes" as const,
              title: tr("servicesSection"),
              desc: tr("servicesSectionDesc"),
              add: tr("addService"),
              rows: serviceTypes,
              setRows: setServiceTypes,
              prefix: "service",
            },
            {
              kind: "ministries" as const,
              title: tr("ministriesSection"),
              desc: tr("ministriesSectionDesc"),
              add: tr("addMinistry"),
              rows: ministries,
              setRows: setMinistries,
              prefix: "ministry",
            },
          ] as const
        ).map((section) => (
          <section className="panel" key={section.kind}>
            <div className="panel-head !items-start">
              <div>
                <h2 className="section-title">{section.title}</h2>
                <p className="hint mt-0.5">{section.desc}</p>
              </div>
              <span className="tnum text-[0.7rem] text-muted">{section.rows.length}</span>
            </div>
            <div className="panel-body">
              <div className="option-stack">
                {section.rows.map((option) => (
                  <div key={option.id} className="option-row">
                    <div>
                      <label className="field-label" htmlFor={`${section.prefix}-${option.id}-kh`}>
                        {tr("itemKhLabel")}
                      </label>
                      <input
                        id={`${section.prefix}-${option.id}-kh`}
                        className="input font-khmer"
                        value={option.kh}
                        onChange={(event) =>
                          updateOption(section.kind, option.id, "kh", event.target.value)
                        }
                        required
                        maxLength={200}
                      />
                    </div>
                    <div>
                      <label className="field-label" htmlFor={`${section.prefix}-${option.id}-en`}>
                        {tr("itemEnLabel")}
                      </label>
                      <input
                        id={`${section.prefix}-${option.id}-en`}
                        className="input"
                        value={option.en}
                        onChange={(event) =>
                          updateOption(section.kind, option.id, "en", event.target.value)
                        }
                        required
                        maxLength={200}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-icon btn-quiet mt-[1.72rem] hover:!text-danger"
                      onClick={() => removeOption(section.kind, option.id)}
                      disabled={section.rows.length <= 1}
                      aria-label={tr("remove")}
                      title={tr("remove")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-sm btn-secondary mt-3"
                onClick={() => {
                  const option = makeOption(section.prefix);
                  section.setRows((current) => [...current, option]);
                }}
              >
                <Plus size={13} />
                {section.add}
              </button>
            </div>
          </section>
        ))}
      </div>

      <section className="panel">
        <div className="panel-head !items-start">
          <div>
            <h2 className="section-title">{tr("warningsSection")}</h2>
            <p className="hint mt-0.5">{tr("warningsSectionDesc")}</p>
          </div>
        </div>
        <div className="panel-body">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="orange-days" className="field-label">
                {tr("orangeAfter")}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="orange-days"
                  type="number"
                  min={1}
                  max={365}
                  className="input max-w-[8rem] tnum"
                  value={orange}
                  onChange={(event) => setOrange(event.target.value)}
                  required
                />
                <span className="hint">{tr("daysAfter")}</span>
              </div>
            </div>
            <div>
              <label htmlFor="red-days" className="field-label">
                {tr("redAfter")}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="red-days"
                  type="number"
                  min={1}
                  max={365}
                  className="input max-w-[8rem] tnum"
                  value={red}
                  onChange={(event) => setRed(event.target.value)}
                  required
                />
                <span className="hint">{tr("daysAfter")}</span>
              </div>
            </div>
          </div>
          <p className="hint mt-3">{tr("warningDaysHint")}</p>
        </div>
      </section>

      {error ? (
        <div className="error-box" role="alert">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="hint max-w-xl">{tr("settingsNote")}</p>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          <Save size={15} />
          {busy ? tr("saving") : tr("saveSettings")}
        </button>
      </div>
    </form>
  );
}
