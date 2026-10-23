import "server-only";

import { cookies } from "next/headers";
import type { Lang, Theme } from "@/lib/types";

export const LANG_COOKIE = "tracker_lang";
export const THEME_COOKIE = "tracker_theme";

export async function getUiPreferences(): Promise<{
  lang: Lang;
  theme: Theme;
}> {
  const store = await cookies();
  const langValue = store.get(LANG_COOKIE)?.value;
  const themeValue = store.get(THEME_COOKIE)?.value;
  const lang: Lang = langValue === "en" || langValue === "kh" ? langValue : "kh";
  const theme: Theme = themeValue === "dark" ? "dark" : "light";
  return { lang, theme };
}

export async function getLang(): Promise<Lang> {
  return (await getUiPreferences()).lang;
}
