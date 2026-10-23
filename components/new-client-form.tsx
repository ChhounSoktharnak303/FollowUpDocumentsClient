"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/components/context";
import { useToast } from "@/components/toast";
import { apiErrorKey, sendJson } from "@/lib/client-api";
import type { Client } from "@/lib/types";

export function NewClientForm({ returnTo }: { returnTo: string }) {
  const { tr } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [nameKh, setNameKh] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!nameKh.trim() && !nameEn.trim()) {
      setError(tr("clientNameHint"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await sendJson<{ client: Client }>("/api/clients", "POST", {
        nameKh,
        nameEn,
        phone,
        note,
      });
      toast.push(tr("toastClientCreated"));
      router.push(returnTo);
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
        <div>
          <label htmlFor="client-name-kh" className="field-label">
            {tr("clientNameKh")}
          </label>
          <input
            id="client-name-kh"
            className="input font-khmer"
            value={nameKh}
            onChange={(event) => setNameKh(event.target.value)}
            placeholder={tr("nameKhPlaceholder")}
            maxLength={160}
          />
        </div>
        <div>
          <label htmlFor="client-name-en" className="field-label">
            {tr("clientNameEn")}
          </label>
          <input
            id="client-name-en"
            className="input"
            value={nameEn}
            onChange={(event) => setNameEn(event.target.value)}
            placeholder={tr("nameEnPlaceholder")}
            maxLength={160}
          />
        </div>

        <div>
          <label htmlFor="client-phone" className="field-label">
            {tr("phoneLabel")}{" "}
            <span className="font-normal text-muted">({tr("optional")})</span>
          </label>
          <input
            id="client-phone"
            className="input tnum"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder={tr("phonePlaceholder")}
            maxLength={60}
            inputMode="tel"
          />
        </div>
        <div />

        <div className="span-2">
          <label htmlFor="client-note" className="field-label">
            {tr("noteLabel")}{" "}
            <span className="font-normal text-muted">({tr("optional")})</span>
          </label>
          <textarea
            id="client-note"
            className="textarea"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={tr("notePlaceholder")}
            maxLength={3000}
          />
        </div>
      </div>
      <p className="hint mt-3">{tr("clientNameHint")}</p>

      {error ? (
        <div className="error-box mt-4" role="alert">
          {error}
        </div>
      ) : null}

      <div className="mt-5 flex justify-end">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? tr("creatingClient") : tr("createClient")}
          {!busy ? <ArrowRight size={15} /> : null}
        </button>
      </div>
    </form>
  );
}
