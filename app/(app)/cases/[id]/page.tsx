import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Clock3,
  FolderOpen,
  Phone,
} from "lucide-react";
import { AddActivityButton } from "@/components/add-activity-button";
import { StoreNotFoundError } from "@/lib/errors";
import { ActivityTimeline } from "@/components/activity-timeline";
import { CaseStatusControl } from "@/components/case-status-control";
import { JourneyLine } from "@/components/journey-line";
import { ShareLinkCard } from "@/components/share-link-card";
import {
  clientName,
  clientSecondaryName,
  formatDisplayDate,
  shortCaseId,
  todayIso,
} from "@/lib/format";
import { t } from "@/lib/i18n";
import { buildJourney } from "@/lib/journey";
import { getLang } from "@/lib/preferences";
import {
  daysBetween,
  daysSince,
  optionLabel,
  statusLabel,
} from "@/lib/status";
import { getCase, getSettings } from "@/lib/store";

export const metadata: Metadata = {
  title: "Case file",
};

export const dynamic = "force-dynamic";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const lang = await getLang();
  const { id } = await params;
  let detail;
  try {
    detail = await getCase(id);
  } catch (error) {
    if (error instanceof StoreNotFoundError) notFound();
    throw error;
  }
  const settings = await getSettings();
  const { case: caseRecord, client, activities, lastActivityDate } = detail;
  const journey = buildJourney({
    case: caseRecord,
    activities,
    settings,
    lang,
  });
  const closed =
    caseRecord.status === "done" || caseRecord.status === "success";
  const daysOpen = daysBetween(
    caseRecord.startDate,
    closed && caseRecord.endDate ? caseRecord.endDate : todayIso(),
  );
  const quietDays = daysSince(lastActivityDate);

  return (
    <div className="page-wrap">
      <Link href="/cases" className="back-link">
        <ArrowLeft size={13} />
        {t(lang, "backToCases")}
      </Link>

      <header className="detail-head">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow">
              {t(lang, "caseNo", { id: shortCaseId(caseRecord.id) })}
            </span>
            <span className="chip" data-status={caseRecord.status}>
              <span className="chip-dot" />
              {statusLabel(caseRecord.status, lang, settings)}
            </span>
          </div>
          <h1 className="case-title">{clientName(client, lang)}</h1>
          <p className="page-description">
            {caseRecord.description ||
              optionLabel(caseRecord.serviceType, lang, settings.serviceTypes)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.75rem] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <FolderOpen size={13} strokeWidth={1.7} />
              {optionLabel(caseRecord.serviceType, lang, settings.serviceTypes)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Building2 size={13} strokeWidth={1.7} />
              {optionLabel(caseRecord.ministry, lang, settings.ministries)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={13} strokeWidth={1.7} />
              {t(lang, "daysSince", { count: quietDays })}
            </span>
          </div>
        </div>
        <div className="page-head-actions shrink-0">
          <AddActivityButton caseId={caseRecord.id} small={false} />
        </div>
      </header>

      <section className="panel mt-7" aria-labelledby="journey-title">
        <div className="panel-head !items-start">
          <div>
            <h2 id="journey-title" className="section-title">
              {t(lang, "journeyTitle")}
            </h2>
            <p className="hint mt-0.5">{t(lang, "journeyDesc")}</p>
          </div>
          <span className="hidden shrink-0 text-[0.68rem] text-muted md:inline-flex md:items-center md:gap-1.5">
            <CalendarDays size={12} />
            {t(lang, "started")}{" "}
            <span className="tnum">{formatDisplayDate(caseRecord.startDate, lang)}</span>
          </span>
        </div>
        <div className="panel-body">
          <JourneyLine steps={journey} lang={lang} />
        </div>
      </section>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(290px,0.72fr)]">
        <section className="panel" aria-labelledby="activity-title">
          <div className="panel-head !items-start">
            <div>
              <h2 id="activity-title" className="section-title">
                {t(lang, "activityTitle")}
              </h2>
              <p className="hint mt-0.5">{t(lang, "activityDesc")}</p>
            </div>
            <AddActivityButton caseId={caseRecord.id} />
          </div>
          <div className="panel-body">
            <ActivityTimeline
              activities={activities}
              settings={settings}
              caseId={caseRecord.id}
            />
          </div>
        </section>

        <aside className="space-y-5">
          <section className="panel" aria-labelledby="details-title">
            <div className="panel-head">
              <h2 id="details-title" className="section-title">
                {t(lang, "caseDetails")}
              </h2>
            </div>
            <div className="panel-body !pt-4">
              <CaseStatusControl
                caseId={caseRecord.id}
                currentStatus={caseRecord.status}
                settings={settings}
              />

              <dl className="mt-5 divide-y divide-line border-t border-line">
                <div className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="meta-label">{t(lang, "tableClient")}</dt>
                  <dd className="text-right">
                    <div className="text-[0.8rem] font-semibold">
                      {clientName(client, lang)}
                    </div>
                    {clientSecondaryName(client, lang) ? (
                      <div className="text-[0.68rem] text-muted">
                        {clientSecondaryName(client, lang)}
                      </div>
                    ) : null}
                  </dd>
                </div>
                {client.phone ? (
                  <div className="flex items-baseline justify-between gap-4 py-2.5">
                    <dt className="meta-label">{t(lang, "phoneLabel")}</dt>
                    <dd>
                      <a
                        href={`tel:${client.phone.replace(/\s+/g, "")}`}
                        className="inline-flex items-center gap-1.5 text-[0.78rem] text-ink-soft hover:text-accent-strong tnum"
                      >
                        <Phone size={11} />
                        {client.phone}
                      </a>
                    </dd>
                  </div>
                ) : null}
                <div className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="meta-label">{t(lang, "serviceType")}</dt>
                  <dd className="text-[0.78rem] text-ink-soft">
                    {optionLabel(caseRecord.serviceType, lang, settings.serviceTypes)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="meta-label">{t(lang, "currentMinistry")}</dt>
                  <dd className="text-[0.78rem] text-ink-soft">
                    {optionLabel(caseRecord.ministry, lang, settings.ministries)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="meta-label">{t(lang, "startDateField")}</dt>
                  <dd className="tnum text-[0.78rem] text-ink-soft">
                    {formatDisplayDate(caseRecord.startDate, lang)}
                  </dd>
                </div>
                {caseRecord.endDate ? (
                  <div className="flex items-baseline justify-between gap-4 py-2.5">
                    <dt className="meta-label">{t(lang, "endDateLabel")}</dt>
                    <dd className="tnum text-[0.78rem] text-ink-soft">
                      {formatDisplayDate(caseRecord.endDate, lang)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="meta-label">{t(lang, "tableDaysOpen")}</dt>
                  <dd className="tnum text-[0.78rem] text-ink-soft">{daysOpen}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="meta-label">{t(lang, "lastUpdate")}</dt>
                  <dd className="tnum text-[0.78rem] text-ink-soft">
                    {formatDisplayDate(lastActivityDate, lang)}
                  </dd>
                </div>
                {client.note ? (
                  <div className="pt-3">
                    <dt className="meta-label">{t(lang, "internalNote")}</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-[0.75rem] leading-relaxed text-muted">
                      {client.note}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </section>

          <section className="panel">
            <div className="panel-body">
              <ShareLinkCard
                caseId={caseRecord.id}
                initialToken={caseRecord.shareToken}
              />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
