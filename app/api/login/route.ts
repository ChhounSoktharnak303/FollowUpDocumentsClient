import { signIn, verifyPassword } from "@/lib/auth";
import { redirectResponse } from "@/lib/http";
import { loginSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return redirectResponse("/login?error=1");
  }
  const parsed = loginSchema.safeParse({
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return redirectResponse("/login?error=1");
  }

  try {
    const valid = await verifyPassword(parsed.data.password);
    if (!valid) {
      return redirectResponse("/login?error=1");
    }
    await signIn();
  } catch (error) {
    console.error("[login]", error);
    return redirectResponse("/login?error=1");
  }

  return redirectResponse("/");
}
