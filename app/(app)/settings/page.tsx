import type { Metadata } from "next";
import { Settings2 } from "lucide-react";
import { SettingsForm } from "@/components/settings-form";
import { TemplatesManager } from "@/components/templates-manager";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/preferences";
import { getSettings, listTemplates } from "@/lib/store";

export const metadata: Metadata = {
  title: "Settings",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const lang = await getLang();
  const [settings, templates] = await Promise.all([
    getSettings(),
    listTemplates(),
  ]);

  return (
    <div className="page-wrap">
      <header className="page-head">
        <div>
          <p className="eyebrow inline-flex items-center gap-1.5">
            <Settings2 size={12} />
            {t(lang, "settingsKicker")}
          </p>
          <h1 className="page-title">{t(lang, "settingsTitle")}</h1>
          <p className="page-description mt-3">{t(lang, "settingsDesc")}</p>
        </div>
      </header>

      <div className="max-w-5xl space-y-6">
        <SettingsForm initialSettings={settings} />
        <TemplatesManager initialTemplates={templates} />
      </div>
    </div>
  );
}
