import Image from "next/image";
import { FileX2 } from "lucide-react";
import { ShareActions } from "@/components/share-actions";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/preferences";

export default async function SharedCaseNotFound() {
  const lang = await getLang();

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
            <div className="truncate text-[0.8rem] font-semibold">
              {t(lang, "appName")}
            </div>
          </div>
          <ShareActions />
        </div>
        <div className="share-body empty-state !py-16">
          <span className="empty-icon">
            <FileX2 size={22} strokeWidth={1.6} />
          </span>
          <h1 className="empty-title">{t(lang, "shareNotFoundTitle")}</h1>
          <p className="empty-description max-w-md">
            {t(lang, "shareNotFoundDesc")}
          </p>
        </div>
        <footer className="share-footer">{t(lang, "sharePoweredBy")}</footer>
      </div>
    </div>
  );
}
