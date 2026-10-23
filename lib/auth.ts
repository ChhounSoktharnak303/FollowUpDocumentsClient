import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getIronSession, type SessionOptions } from "iron-session";

export interface SessionData {
  authenticated?: boolean;
  signedInAt?: string;
}

export const SESSION_COOKIE_NAME = "casefile_session";

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or too short. Add a 32+ character value to .env.",
    );
  }
  return secret;
}

function options(): SessionOptions {
  return {
    cookieName: SESSION_COOKIE_NAME,
    password: sessionSecret(),
    ttl: 60 * 60 * 24 * 14,
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.SESSION_COOKIE_SECURE === "true",
      path: "/",
    },
  };
}

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, options());
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session.authenticated === true;
}

export async function requirePageAuth(): Promise<void> {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }
}

export async function signIn(): Promise<void> {
  const session = await getSession();
  session.authenticated = true;
  session.signedInAt = new Date().toISOString();
  await session.save();
}

export async function signOut(): Promise<void> {
  const session = await getSession();
  session.destroy();
}

export async function verifyPassword(input: string): Promise<boolean> {
  const configured = process.env.APP_PASSWORD;
  if (!configured) {
    throw new Error("APP_PASSWORD is missing. Add it to .env.");
  }
  const inputHash = createHash("sha256").update(input).digest();
  const configuredHash = createHash("sha256").update(configured).digest();
  return timingSafeEqual(inputHash, configuredHash);
}
