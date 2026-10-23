import { NextResponse } from "next/server";
import { signOut } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  await signOut();
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
