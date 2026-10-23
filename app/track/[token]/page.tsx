import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Building2,
  CalendarDays,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { JourneyLine } from "@/components/journey-line";
import { ShareActions } from "@/components/share-actions";
import {
  clientName,
  clientSecondaryName,
  formatDisplayDate,
  shortCaseId,
} from "@/lib/format";
import { t } from "@/lib/i18n";
import { buildJourney } from "@/lib/journey";
import { getLang } from "@/lib/preferences";
import { optionLabel, statusLabel } from "@/lib/status";
import { getSettings, getSharedCase } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shared case",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SharedCasePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const lang = await getLang();
  const { token } = await params;
  const shared = await getSharedCase(token);
  if (!shared) notFound();

  const settings = await getSettings();
  const caseRecord = shared.case;
  const client = shared.client;
  const primary = clientName(client, lang);
  const secondary = clientSecondaryName(client, lang);
  const journey = buildJourney({
    case: caseRecord,
    activities: shared.activities,
    settings,
    lang,
  });
  const recent = [...shared.activities].sort((a, b) =>
    (b.date || "").localeCompare(a.date || ""),
  );
  const closed = caseRecord.status === "done" || caseRecord.status === "success";

  return (
    <div className="share-page">
      <div className="share-frame">
        <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Image
              src="/logo.png"
              alt={t(lang, "officeLabel")}
              width={800}
              height={182}
              priority
              className="share-logo"
            />
            <div className="min-w-0">
              <div className="truncate text-[0.8rem] font-semibold">
                {t(lang, "appName")}
              </div>
              <div className="truncate text-[0.65rem] text-muted">
                {t(lang, "shareSubtitle")}
              </div>
            </div>
          </div>
          <ShareActions />
        </div>

        <header className="share-head">
          <div className="min-w-0">
            <p className="eyebrow">{t(lang, "shareKicker")}</p>
            <h1 className="mt-2 text-[clamp(1.45rem,4vw,2.1rem)] font-semibold tracking-tight">
              {primary}
            </h1>
            {secondary ? (
              <p className="mt-0.5 text-sm text-muted">{secondary}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="chip" data-status={caseRecord.status}>
                <span className="chip-dot" />
                {statusLabel(caseRecord.status, lang, settings)}
              </span>
              <span className="hint">
                {t(lang, "caseNo", { id: shortCaseId(caseRecord.id) })}
              </span>
              {closed ? (
                <span className="chip" data-status="success">
                  <span className="chip-dot" />
                  {t(lang, "caseClosed")}
                </span>
              ) : null}
            </div>
          </div>
          <div className="shrink-0 text-left md:text-right">
            <div className="text-[0.62rem] uppercase tracking-widest text-muted">
              {t(lang, "lastUpdate")}
            </div>
            <div className="tnum mt-1 text-sm font-semibold">
              {formatDisplayDate(shared.lastActivityDate, lang)}
            </div>
          </div>
        </header>

        <div className="share-body">
          <div className="grid gap-4 border-b border-line pb-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-[0.62rem] uppercase tracking-widest text-muted">
                {t(lang, "serviceType")}
              </div>
              <div className="mt-1 flex items-start gap-1.5 text-sm font-medium">
                <FileText size={14} className="mt-0.5 shrink-0 text-accent" />
                {optionLabel(caseRecord.serviceType, lang, settings.serviceTypes)}
              </div>
            </div>
            <div>
              <div className="text-[0.62rem] uppercase tracking-widest text-muted">
                {t(lang, "currentMinistry")}
              </div>
              <div className="mt-1 flex items-start gap-1.5 text-sm font-medium">
                <Building2 size={14} className="mt-0.5 shrink-0 text-accent" />
                {caseRecord.ministry
                  ? optionLabel(caseRecord.ministry, lang, settings.ministries)
                  : t(lang, "quickAddNoMinistry")}
              </div>
            </div>
            <div>
              <div className="text-[0.62rem] uppercase tracking-widest text-muted">
                {t(lang, "started")}
              </div>
              <div className="tnum mt-1 flex items-center gap-1.5 text-sm font-medium">
                <CalendarDays size={14} className="shrink-0 text-accent" />
                {formatDisplayDate(caseRecord.startDate, lang)}
              </div>
            </div>
            <div>
              <div className="text-[0.62rem] uppercase tracking-widest text-muted">
                {t(lang, "endDateLabel")}
              </div>
              <div className="tnum mt-1 flex items-center gap-1.5 text-sm font-medium">
                <CalendarDays size={14} className="shrink-0 text-accent" />
                {caseRecord.endDate
                  ? formatDisplayDate(caseRecord.endDate, lang)
                  : t(lang, "notSet")}
              </div>
            </div>
          </div>

          {caseRecord.description ? (
            <section className="border-b border-line py-6">
              <h2 className="section-title">{t(lang, "descriptionLabel")}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ink-soft">
                {caseRecord.description}
              </p>
            </section>
          ) : null}

          <section className="border-b border-line py-6">
            <div className="mb-4">
              <h2 className="section-title">{t(lang, "journeyTitle")}</h2>
              <p className="hint mt-0.5">{t(lang, "journeyDesc")}</p>
            </div>
            <JourneyLine steps={journey} lang={lang} />
          </section>

          <section className="pt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="section-title">{t(lang, "shareActivities")}</h2>
                <p className="hint mt-0.5">{t(lang, "activityDesc")}</p>
              </div>
              <span className="tnum text-[0.68rem] text-muted">
                {recent.length}
              </span>
            </div>

            {recent.length === 0 ? (
              <p className="hint">{t(lang, "shareNoActivities")}</p>
            ) : (
              <ol className="timeline">
                {recent.map((activity, index) => (
                  <li key={activity.id} className="timeline-item">
                    <div className="timeline-axis">
                      <span
                        className="timeline-dot"
                        data-status={activity.status}
                      />
                      {index < recent.length - 1 ? (
                        <span className="timeline-line" />
                      ) : null}
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-meta">
                        <span className="timeline-date">
                          {formatDisplayDate(activity.date, lang)}
                        </span>
                        {activity.ministry ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              {optionLabel(
                                activity.ministry,
                                lang,
                                settings.ministries,
                              )}
                            </span>
                          </>
                        ) : null}
                        <span className="chip ml-auto" data-status={activity.status}>
                          <span className="chip-dot" />
                          {statusLabel(activity.status, lang, settings)}
                        </span>
                      </div>
                      <p className="timeline-action">{activity.action}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <footer className="share-footer">
          <div className="flex items-start gap-2">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent" />
            <div>
              <p>{t(lang, "sharePrivacy")}</p>
              <p className="mt-1.5">{t(lang, "sharePoweredBy")}</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
