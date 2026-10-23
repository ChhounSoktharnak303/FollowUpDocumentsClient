import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewClientForm } from "@/components/new-client-form";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/preferences";

export const metadata: Metadata = {
  title: "New client",
};

export const dynamic = "force-dynamic";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const lang = await getLang();
  const params = await searchParams;
  const requested = Array.isArray(params.returnTo)
    ? params.returnTo[0]
    : params.returnTo;
  const returnTo =
    requested && requested.startsWith("/") && !requested.startsWith("//")
      ? requested
      : "/clients";

  return (
    <div className="page-wrap">
      <Link href={returnTo === "/cases/new" ? "/cases/new" : "/clients"} className="back-link">
        <ArrowLeft size={13} />
        {returnTo === "/cases/new" ? t(lang, "newCase") : t(lang, "clientsTitle")}
      </Link>
      <header className="page-head">
        <div>
          <p className="eyebrow">{t(lang, "addClient")}</p>
          <h1 className="page-title">{t(lang, "addClient")}</h1>
          <p className="page-description mt-3">{t(lang, "clientsDesc")}</p>
        </div>
      </header>
      <div className="max-w-3xl">
        <NewClientForm returnTo={returnTo} />
      </div>
    </div>
  );
}
