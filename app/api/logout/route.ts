import { signOut } from "@/lib/auth";
import { redirectResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  await signOut();
  return redirectResponse("/login");
}
