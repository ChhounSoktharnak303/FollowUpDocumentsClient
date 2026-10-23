import Image from "next/image";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { LanguageToggle, ThemeToggle } from "@/components/preference-toggles";
import { isAuthenticated } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getUiPreferences } from "@/lib/preferences";

export const metadata: Metadata = {
  title: "Sign in",
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isAuthenticated()) redirect("/");
  const { lang } = await getUiPreferences();
  const params = await searchParams;
  const hasError = Boolean(params.error);

  return (
    <main className="login-wrap">
      <aside className="login-story" aria-hidden="true">
        <div className="login-story-content">
          <Image
            src="/logo.png"
            alt={t(lang, "officeLabel")}
            width={800}
            height={182}
            priority
            className="login-logo"
          />
          <p className="eyebrow !text-[#6bc9bf]">{t(lang, "officeLabel")}</p>
          <h1 className="login-story-title mt-5">{t(lang, "loginTitle")}</h1>
          <p className="login-story-description">{t(lang, "loginSubtitle")}</p>
        </div>
        <div className="login-story-foot">
          <span className="h-px w-8 bg-white/20" />
          {t(lang, "officeLabel")}
        </div>
      </aside>

      <section className="login-panel">
        <div className="login-toolbar">
          <LanguageToggle compact />
          <ThemeToggle />
        </div>

        <div className="login-card">
          <div className="login-mobile-brand">
            <Image
              src="/logo.png"
              alt={t(lang, "officeLabel")}
              width={800}
              height={182}
              priority
              className="login-mobile-logo"
            />
          </div>
          <p className="eyebrow">{t(lang, "loginKicker")}</p>
          <h2 className="page-title !text-[clamp(1.7rem,3vw,2.2rem)] mt-2">
            {t(lang, "appName")}
          </h2>
          <p className="page-description mt-3">{t(lang, "sessionNote")}</p>

          {hasError ? (
            <div className="login-error mt-5" role="alert">
              {t(lang, "wrongPassword")}
            </div>
          ) : null}

          <form action="/api/login" method="post" className="login-form">
            <label htmlFor="password" className="field-label">
              {t(lang, "passwordLabel")}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              maxLength={300}
              placeholder={t(lang, "passwordPlaceholder")}
              className="input"
            />
            <button type="submit" className="btn btn-primary mt-4 w-full">
              <LockKeyhole size={15} strokeWidth={1.8} />
              {t(lang, "signIn")}
            </button>
          </form>

          <p className="login-note">{t(lang, "loginFootnote")}</p>
        </div>
      </section>
    </main>
  );
}
