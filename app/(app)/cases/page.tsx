import type { Metadata } from "next";
import Link from "next/link";
import {
  FilterX,
  FolderOpen,
  FolderSearch,
  Plus,
  Search,
} from "lucide-react";
import {
  daysSince,
  optionLabel,
  statusLabel,
  warningTone,
} from "@/lib/status";
import {
  clientName,
  clientSecondaryName,
  formatDisplayDate,
  initials,
} from "@/lib/format";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/preferences";
import { getSettings, listCases } from "@/lib/store";

export const metadata: Metadata = {
  title: "Cases",
};

export const dynamic = "force-dynamic";

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const params = await searchParams;
  const q = one(params.q);
  const status = one(params.status);
  const ministry = one(params.ministry);
  const serviceType = one(params.serviceType);
  const sort = one(params.sort) || "attention";
  const filters = { q, status, ministry, serviceType, sort };

  const [settings, cases] = await Promise.all([
    getSettings(),
    listCases(filters),
  ]);
  const hasFilters = Boolean(q || status || ministry || serviceType);
  const total = cases.length;

  return (
    <div className="page-wrap">
      <header className="page-head">
        <div>
          <p className="eyebrow">{t(lang, "casesKicker")}</p>
          <h1 className="page-title">{t(lang, "casesTitle")}</h1>
          <p className="page-description mt-3">{t(lang, "casesDesc")}</p>
        </div>
        <div className="page-head-actions">
          <Link href="/cases/new" className="btn btn-primary">
            <Plus size={15} strokeWidth={1.9} />
            {t(lang, "newCase")}
          </Link>
        </div>
      </header>

      <form method="get" action="/cases" className="filters-bar">
        <div className="filter-search">
          <label htmlFor="case-search" className="field-label">
            {t(lang, "search")}
          </label>
          <div className="relative">
            <Search
              size={15}
              strokeWidth={1.7}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              id="case-search"
              name="q"
              defaultValue={q}
              placeholder={t(lang, "searchCases")}
              className="input input-search"
              maxLength={160}
            />
          </div>
        </div>
        <div>
          <label htmlFor="status-filter" className="field-label">
            {t(lang, "filterStatus")}
          </label>
          <select
            id="status-filter"
            name="status"
            defaultValue={status}
            className="select"
          >
            <option value="">{t(lang, "statusAll")}</option>
            {(
              ["in_progress", "waiting", "done", "success", "rejected"] as const
            ).map((value) => (
              <option key={value} value={value}>
                {settings.statusLabels[value][lang]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ministry-filter" className="field-label">
            {t(lang, "filterMinistry")}
          </label>
          <select
            id="ministry-filter"
            name="ministry"
            defaultValue={ministry}
            className="select"
          >
            <option value="">{t(lang, "ministryAll")}</option>
            {settings.ministries.map((option) => (
              <option key={option.id} value={option.id}>
                {option[lang]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="service-filter" className="field-label">
            {t(lang, "filterService")}
          </label>
          <select
            id="service-filter"
            name="serviceType"
            defaultValue={serviceType}
            className="select"
          >
            <option value="">{t(lang, "serviceAll")}</option>
            {settings.serviceTypes.map((option) => (
              <option key={option.id} value={option.id}>
                {option[lang]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sort-filter" className="field-label">
            {t(lang, "sortLabel")}
          </label>
          <select id="sort-filter" name="sort" defaultValue={sort} className="select">
            <option value="attention">{t(lang, "sortAttention")}</option>
            <option value="newest">{t(lang, "sortNewest")}</option>
            <option value="oldest">{t(lang, "sortOldest")}</option>
            <option value="days_open">{t(lang, "sortDaysOpen")}</option>
            <option value="client">{t(lang, "sortClient")}</option>
          </select>
        </div>
        <div className="flex items-center gap-2 self-end">
          <button type="submit" className="btn btn-secondary">
            {t(lang, "apply")}
          </button>
          {hasFilters || sort !== "attention" ? (
            <Link
              href="/cases"
              className="btn btn-icon btn-quiet"
              aria-label={t(lang, "clearFilters")}
              title={t(lang, "clearFilters")}
            >
              <FilterX size={16} strokeWidth={1.7} />
            </Link>
          ) : null}
        </div>
      </form>

      <div className="mb-2.5 flex items-center justify-between text-[0.72rem] text-muted">
        <span className="tnum">{t(lang, "casesCount", { count: total })}</span>
        {hasFilters ? (
          <Link href="/cases" className="inline-flex items-center gap-1 hover:text-ink">
            {t(lang, "resetFilters")}
          </Link>
        ) : null}
      </div>

      {total === 0 ? (
        hasFilters ? (
          <div className="surface-card empty-state">
            <span className="empty-icon">
              <FolderSearch size={22} strokeWidth={1.6} />
            </span>
            <h2 className="empty-title">{t(lang, "noResultsTitle")}</h2>
            <p className="empty-description">{t(lang, "noResultsDesc")}</p>
            <Link href="/cases" className="btn btn-secondary mt-4">
              <FilterX size={14} />
              {t(lang, "clearFilters")}
            </Link>
          </div>
        ) : (
          <div className="surface-card empty-state">
            <span className="empty-icon">
              <FolderOpen size={22} strokeWidth={1.6} />
            </span>
            <h2 className="empty-title">{t(lang, "emptyCasesTitle")}</h2>
            <p className="empty-description">{t(lang, "emptyCasesDesc")}</p>
            <Link href="/cases/new" className="btn btn-primary mt-4">
              <Plus size={14} />
              {t(lang, "newCase")}
            </Link>
          </div>
        )
      ) : (
        <div className="case-table-wrap">
          <table className="case-table">
            <thead>
              <tr>
                <th scope="col">{t(lang, "tableNo")}</th>
                <th scope="col">{t(lang, "tableClient")}</th>
                <th scope="col">{t(lang, "tableService")}</th>
                <th scope="col">{t(lang, "tableMinistry")}</th>
                <th scope="col">{t(lang, "tableStart")}</th>
                <th scope="col">{t(lang, "tableDaysOpen")}</th>
                <th scope="col">{t(lang, "tableStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((item, index) => {
                const tone = warningTone(
                  daysSince(item.lastActivityDate),
                  settings.warningOrangeDays,
                  settings.warningRedDays,
                );
                return (
                  <tr key={item.id}>
                    <td className="row-number tnum">
                      {String(index + 1).padStart(2, "0")}
                    </td>
                    <td>
                      <Link
                        href={`/cases/${item.id}`}
                        className="client-row group"
                      >
                        <span className="avatar">{initials(item.client)}</span>
                        <span className="min-w-0">
                          <span className="case-client block truncate group-hover:text-accent-strong">
                            {clientName(item.client, lang)}
                          </span>
                          {clientSecondaryName(item.client, lang) ? (
                            <span className="block truncate text-[0.68rem] font-normal text-muted">
                              {clientSecondaryName(item.client, lang)}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </td>
                    <td className="text-[0.78rem] text-ink-soft">
                      {optionLabel(item.serviceType, lang, settings.serviceTypes)}
                    </td>
                    <td className="text-[0.78rem] text-ink-soft">
                      {optionLabel(item.ministry, lang, settings.ministries)}
                    </td>
                    <td className="tnum text-[0.75rem] text-muted">
                      {formatDisplayDate(item.startDate, lang)}
                    </td>
                    <td>
                      <span
                        className={`warning-badge ${
                          tone === "normal" ? "" : ""
                        }`}
                        data-tone={tone}
                      >
                        <span className="tnum">{item.daysOpen}</span>
                        <span className="font-normal">{t(lang, "days")}</span>
                      </span>
                    </td>
                    <td>
                      <span className="chip" data-status={item.status}>
                        <span className="chip-dot" />
                        {statusLabel(item.status, lang, settings)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
