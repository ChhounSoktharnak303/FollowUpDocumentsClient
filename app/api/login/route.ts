import { NextResponse } from "next/server";
import { signIn, verifyPassword } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  }
  const parsed = loginSchema.safeParse({
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  }

  try {
    const valid = await verifyPassword(parsed.data.password);
    if (!valid) {
      return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
    }
    await signIn();
  } catch (error) {
    console.error("[login]", error);
    return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  }

  return NextResponse.redirect(new URL("/", request.url), 303);
}
