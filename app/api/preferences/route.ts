import { cookies } from "next/headers";
import { jsonResponse } from "@/lib/http";
import { LANG_COOKIE, THEME_COOKIE } from "@/lib/preferences";
import { preferencesSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "VALIDATION" }, 400);
  }
  const parsed = preferencesSchema.safeParse(body);
  if (!parsed.success || (!parsed.data.lang && !parsed.data.theme)) {
    return jsonResponse({ error: "VALIDATION" }, 400);
  }
  const store = await cookies();
  const cookieOptions = {
    path: "/",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
  };
  if (parsed.data.lang) {
    store.set(LANG_COOKIE, parsed.data.lang, cookieOptions);
  }
  if (parsed.data.theme) {
    store.set(THEME_COOKIE, parsed.data.theme, cookieOptions);
  }
  return jsonResponse({ ok: true });
}
