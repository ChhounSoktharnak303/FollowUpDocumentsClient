import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarCheck2,
  Clock3,
  FileWarning,
  Folders,
} from "lucide-react";
import { AddActivityButton } from "@/components/add-activity-button";
import {
  attentionReason,
  optionLabel,
  statusLabel,
  warningTone,
} from "@/lib/status";
import { clientName, formatDisplayDate, shortCaseId, todayIso } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/preferences";
import { getTodayData } from "@/lib/store";

export const metadata: Metadata = {
  title: "Today",
};

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const lang = await getLang();
  const { cases, stats, settings } = await getTodayData();

  const statCards = [
    { label: t(lang, "statOpen"), value: stats.openCases, tone: "normal" },
    { label: t(lang, "statWaiting"), value: stats.waiting, tone: "normal" },
    { label: t(lang, "statOverdue"), value: stats.overdue, tone: "danger" },
    {
      label: t(lang, "statCompleted"),
      value: stats.completedThisMonth,
      tone: "success",
    },
  ];

  return (
    <div className="page-wrap">
      <header className="page-head">
        <div>
          <p className="eyebrow">{t(lang, "todayKicker")}</p>
          <h1 className="page-title">{t(lang, "todayTitle")}</h1>
          <p className="page-description mt-3">{t(lang, "todayDesc")}</p>
        </div>
        <div className="hidden items-center gap-2 text-xs text-muted md:flex">
          <CalendarCheck2 size={15} strokeWidth={1.6} className="text-accent" />
          <span className="tnum">{formatDisplayDate(todayIso(), lang)}</span>
        </div>
      </header>

      <section className="stats-grid" aria-label={t(lang, "todayTitle")}>
        {statCards.map((card, index) => (
          <div className="stat-cell" key={card.label} data-tone={card.tone}>
            <div className="flex items-center justify-between gap-2">
              <p className="stat-label">{card.label}</p>
              <span className="text-[0.62rem] font-semibold tracking-widest text-line-strong tnum">
                0{index + 1}
              </span>
            </div>
            <p className="stat-value">{card.value}</p>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="section-title">{t(lang, "attentionTitle")}</h2>
            <p className="hint mt-0.5">
              {t(lang, "attentionCount", { count: cases.length })}
            </p>
          </div>
          <Link href="/cases" className="back-link !mb-0">
            {t(lang, "navCases")}
            <ArrowUpRight size={13} />
          </Link>
        </div>

        {cases.length === 0 ? (
          <div className="surface-card empty-state">
            <span className="empty-icon">
              <Folders size={22} strokeWidth={1.6} />
            </span>
            <h2 className="empty-title">{t(lang, "attentionEmptyTitle")}</h2>
            <p className="empty-description">{t(lang, "attentionEmptyDesc")}</p>
          </div>
        ) : (
          <div className="queue-list">
            {cases.map((item) => {
              const reason = attentionReason(item, settings);
              const tone =
                item.status === "rejected"
                  ? "red"
                  : warningTone(
                      item.daysSinceUpdate,
                      settings.warningOrangeDays,
                      settings.warningRedDays,
                    );
              const reasonLabel =
                reason === "rejected"
                  ? t(lang, "reasonRejected")
                  : reason === "waiting"
                    ? t(lang, "reasonWaiting")
                    : t(lang, "reasonStale");
              const reasonTone =
                tone === "red" ? "red" : reason === "waiting" ? "orange" : "normal";

              return (
                <article key={item.id} className="queue-row" data-tone={tone}>
                  <div className="queue-main">
                    <div className="queue-meta">
                      <span className="tnum">
                        {t(lang, "caseNo", { id: shortCaseId(item.id) })}
                      </span>
                      <span aria-hidden="true">/</span>
                      <span>{optionLabel(item.serviceType, lang, settings.serviceTypes)}</span>
                      <span aria-hidden="true">/</span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-1 w-1 rounded-full bg-line-strong" />
                        {optionLabel(item.ministry, lang, settings.ministries)}
                      </span>
                    </div>
                    <Link href={`/cases/${item.id}`} className="mt-1 inline-block">
                      <h3 className="queue-client">{clientName(item.client, lang)}</h3>
                    </Link>
                    <p className="queue-service mt-0.5 line-clamp-2">
                      {item.description ||
                        optionLabel(item.serviceType, lang, settings.serviceTypes)}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="warning-badge" data-tone={reasonTone}>
                        {reasonTone === "normal" ? (
                          <span className="chip-dot" />
                        ) : (
                          <FileWarning size={12} strokeWidth={1.8} />
                        )}
                        {reasonLabel}
                      </span>
                      <span className="hint inline-flex items-center gap-1.5">
                        <Clock3 size={12} strokeWidth={1.7} />
                        {t(lang, "lastUpdated")}:{" "}
                        <span className="tnum">
                          {formatDisplayDate(item.lastActivityDate, lang)}
                        </span>
                      </span>
                      <span className="hint">
                        {statusLabel(item.status, lang, settings)}
                      </span>
                    </div>
                  </div>
                  <div className="queue-side">
                    <span className="warning-badge" data-tone={tone}>
                      {t(lang, "daysWaiting", { count: item.daysSinceUpdate })}
                    </span>
                    <div className="queue-actions">
                      <AddActivityButton caseId={item.id} />
                      <Link
                        href={`/cases/${item.id}`}
                        className="btn btn-sm btn-quiet"
                        aria-label={t(lang, "viewCase")}
                        title={t(lang, "viewCase")}
                      >
                        <ArrowUpRight size={14} />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
