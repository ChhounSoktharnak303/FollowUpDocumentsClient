import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  Phone,
  Plus,
  Search,
  UserRoundSearch,
  Users,
} from "lucide-react";
import {
  clientName,
  clientSecondaryName,
  formatDisplayDate,
  initials,
} from "@/lib/format";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/preferences";
import { listClients } from "@/lib/store";

export const metadata: Metadata = {
  title: "Clients",
};

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const lang = await getLang();
  const params = await searchParams;
  const rawQuery = params.q;
  const q = Array.isArray(rawQuery) ? (rawQuery[0] ?? "") : (rawQuery ?? "");
  const clients = await listClients(q);
  const hasQuery = q.trim().length > 0;

  return (
    <div className="page-wrap">
      <header className="page-head">
        <div>
          <p className="eyebrow">{t(lang, "clientsKicker")}</p>
          <h1 className="page-title">{t(lang, "clientsTitle")}</h1>
          <p className="page-description mt-3">{t(lang, "clientsDesc")}</p>
        </div>
        <div className="page-head-actions">
          <Link href="/clients/new" className="btn btn-primary">
            <Plus size={15} strokeWidth={1.9} />
            {t(lang, "addClient")}
          </Link>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <form method="get" action="/clients" className="w-full max-w-md">
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              name="q"
              defaultValue={q}
              className="input input-search"
              placeholder={t(lang, "searchClients")}
              aria-label={t(lang, "searchClients")}
              maxLength={160}
            />
          </div>
        </form>
        <span className="tnum text-[0.72rem] text-muted">
          {t(lang, "clientsCount", { count: clients.length })}
        </span>
      </div>

      {clients.length === 0 ? (
        hasQuery ? (
          <div className="surface-card empty-state">
            <span className="empty-icon">
              <UserRoundSearch size={22} strokeWidth={1.6} />
            </span>
            <h2 className="empty-title">{t(lang, "noResultsTitle")}</h2>
            <p className="empty-description">{t(lang, "noClientsMatch")}</p>
            <Link href="/clients" className="btn btn-secondary mt-4">
              {t(lang, "clearFilters")}
            </Link>
          </div>
        ) : (
          <div className="surface-card empty-state">
            <span className="empty-icon">
              <Users size={22} strokeWidth={1.6} />
            </span>
            <h2 className="empty-title">{t(lang, "noClientsTitle")}</h2>
            <p className="empty-description">{t(lang, "noClientsDesc")}</p>
            <Link href="/clients/new" className="btn btn-primary mt-4">
              <Plus size={14} />
              {t(lang, "addClient")}
            </Link>
          </div>
        )
      ) : (
        <div className="surface-card overflow-hidden">
          {clients.map((client, index) => {
            const primary = clientName(client, lang);
            const secondary = clientSecondaryName(client, lang);
            return (
              <div
                key={client.id}
                className={`grid gap-3 px-4 py-4 transition-colors hover:bg-paper-raised md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_auto] md:items-center ${
                  index > 0 ? "border-t border-line" : ""
                }`}
              >
                <div className="client-row min-w-0">
                  <span className="avatar !h-10 !w-10 !rounded-lg !text-[0.8rem]">
                    {initials(client)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[0.92rem] font-semibold">
                      {primary}
                    </div>
                    {secondary ? (
                      <div className="truncate text-[0.7rem] text-muted">
                        {secondary}
                      </div>
                    ) : null}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem] text-muted">
                      {client.phone ? (
                        <a
                          href={`tel:${client.phone.replace(/\s+/g, "")}`}
                          className="inline-flex items-center gap-1 tnum hover:text-accent-strong"
                        >
                          <Phone size={10} />
                          {client.phone}
                        </a>
                      ) : null}
                      <span>
                        {t(lang, "clientSince")}{" "}
                        <span className="tnum">
                          {formatDisplayDate(client.createdAt.slice(0, 10), lang)}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:justify-center">
                  <span className="chip" data-status="in_progress">
                    <span className="chip-dot" />
                    {t(lang, "clientCaseCount", { count: client.caseCount })}
                  </span>
                  <span className="hint">
                    {t(lang, "clientOpenCount", { count: client.openCaseCount })}
                  </span>
                  {client.latestCaseDate ? (
                    <span className="hint tnum">
                      {t(lang, "latestCase")}:{" "}
                      {formatDisplayDate(client.latestCaseDate, lang)}
                    </span>
                  ) : null}
                </div>

                <div className="md:text-right">
                  <Link
                    href={`/cases?q=${encodeURIComponent(
                      client.nameEn || client.nameKh,
                    )}`}
                    className="btn btn-sm btn-secondary"
                  >
                    {t(lang, "viewCases")}
                    <ArrowUpRight size={13} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
