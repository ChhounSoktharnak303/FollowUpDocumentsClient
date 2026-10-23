import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FolderPlus, UserPlus } from "lucide-react";
import { NewCaseForm } from "@/components/new-case-form";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/preferences";
import { getSettings, listClients } from "@/lib/store";

export const metadata: Metadata = {
  title: "New case",
};

export const dynamic = "force-dynamic";

export default async function NewCasePage() {
  const lang = await getLang();
  const [clients, settings] = await Promise.all([listClients(), getSettings()]);

  return (
    <div className="page-wrap">
      <Link href="/cases" className="back-link">
        <ArrowLeft size={13} />
        {t(lang, "backToCases")}
      </Link>
      <header className="page-head">
        <div>
          <p className="eyebrow">{t(lang, "newCaseKicker")}</p>
          <h1 className="page-title">{t(lang, "newCaseTitle")}</h1>
          <p className="page-description mt-3">{t(lang, "newCaseDesc")}</p>
        </div>
      </header>

      <div className="max-w-4xl">
        {clients.length === 0 ? (
          <div className="surface-card empty-state">
            <span className="empty-icon">
              <UserPlus size={22} strokeWidth={1.6} />
            </span>
            <h2 className="empty-title">{t(lang, "noClientsFirstTitle")}</h2>
            <p className="empty-description">{t(lang, "noClientsFirstDesc")}</p>
            <Link
              href="/clients/new?returnTo=/cases/new"
              className="btn btn-primary mt-4"
            >
              <UserPlus size={14} />
              {t(lang, "addClientFirst")}
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2 text-[0.72rem] text-muted">
              <FolderPlus size={14} className="text-accent" />
              <span>{t(lang, "chooseClient")}</span>
              <span aria-hidden="true">/</span>
              <span>{t(lang, "serviceType")}</span>
              <span aria-hidden="true">/</span>
              <span>{t(lang, "descriptionField")}</span>
            </div>
            <NewCaseForm clients={clients} settings={settings} />
          </>
        )}
      </div>
    </div>
  );
}
