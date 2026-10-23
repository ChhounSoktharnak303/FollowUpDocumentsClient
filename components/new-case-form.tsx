"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/components/context";
import { useToast } from "@/components/toast";
import { apiErrorKey, sendJson } from "@/lib/client-api";
import { clientName, clientSecondaryName, todayIso } from "@/lib/format";
import { CASE_STATUSES, optionLabel, statusLabel } from "@/lib/status";
import type {
  AppSettings,
  CaseRecord,
  CaseStatus,
  Client,
} from "@/lib/types";

export function NewCaseForm({
  clients,
  settings,
}: {
  clients: Client[];
  settings: AppSettings;
}) {
  const { lang, tr } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [serviceType, setServiceType] = useState(
    settings.serviceTypes[0]?.id ?? "",
  );
  const [ministry, setMinistry] = useState(settings.ministries[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [status, setStatus] = useState<CaseStatus>("in_progress");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!clientId) {
      setError(tr("errorValidation"));
      return;
    }
    setBusy(true);
    try {
      const result = await sendJson<{ case: CaseRecord }>("/api/cases", "POST", {
        clientId,
        serviceType,
        ministry,
        description,
        startDate,
        endDate: "",
        status,
      });
      toast.push(tr("toastCaseCreated"));
      router.push(`/cases/${result.case.id}`);
      router.refresh();
    } catch (requestError) {
      setError(tr(apiErrorKey(requestError)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="form-card">
      <div className="form-grid">
        <div className="span-2">
          <label htmlFor="case-client" className="field-label">
            {tr("chooseClient")}
          </label>
          <select
            id="case-client"
            className="select"
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            required
          >
            <option value="" disabled>
              {tr("chooseClientPlaceholder")}
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {[clientName(client, lang), clientSecondaryName(client, lang)]
                  .filter(Boolean)
                  .join(" · ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="case-service" className="field-label">
            {tr("serviceType")}
          </label>
          <select
            id="case-service"
            className="select"
            value={serviceType}
            onChange={(event) => setServiceType(event.target.value)}
            required
          >
            {settings.serviceTypes.map((option) => (
              <option key={option.id} value={option.id}>
                {optionLabel(option.id, lang, settings.serviceTypes)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="case-ministry" className="field-label">
            {tr("ministryField")}
          </label>
          <select
            id="case-ministry"
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

        <div>
          <label htmlFor="case-start" className="field-label">
            {tr("startDateField")}
          </label>
          <input
            id="case-start"
            type="date"
            className="input tnum"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="case-status" className="field-label">
            {tr("initialStatus")}
          </label>
          <select
            id="case-status"
            className="select"
            value={status}
            onChange={(event) => setStatus(event.target.value as CaseStatus)}
          >
            {CASE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value, lang, settings)}
              </option>
            ))}
          </select>
        </div>

        <div className="span-2">
          <label htmlFor="case-description" className="field-label">
            {tr("descriptionField")}{" "}
            <span className="font-normal text-muted">({tr("optional")})</span>
          </label>
          <textarea
            id="case-description"
            className="textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={tr("descriptionPlaceholder")}
            maxLength={3000}
          />
        </div>
      </div>

      {error ? (
        <div className="error-box mt-4" role="alert">
          {error}
        </div>
      ) : null}

      <div className="mt-5 flex justify-end">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? tr("creatingCase") : tr("createCase")}
          {!busy ? <ArrowRight size={15} /> : null}
        </button>
      </div>
    </form>
  );
}
