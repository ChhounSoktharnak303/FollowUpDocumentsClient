import "server-only";

import { isAuthenticated } from "@/lib/auth";
import {
  ExcelLockedError,
  StoreConflictError,
  StoreNotFoundError,
  StoreValidationError,
} from "@/lib/errors";

export function jsonResponse(
  body: unknown,
  status = 200,
  headers?: HeadersInit,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export function redirectResponse(location: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
    },
  });
}

export async function requireApiAuth(): Promise<Response | null> {
  if (!(await isAuthenticated())) {
    return jsonResponse({ error: "UNAUTHORIZED" }, 401);
  }
  return null;
}

export function routeError(error: unknown): Response {
  if (error instanceof ExcelLockedError) {
    return jsonResponse(
      { error: "EXCEL_LOCKED", message: "Close the Excel file and try again." },
      423,
    );
  }
  if (error instanceof StoreNotFoundError) {
    return jsonResponse({ error: "NOT_FOUND" }, 404);
  }
  if (error instanceof StoreConflictError) {
    return jsonResponse({ error: "CONFLICT" }, 409);
  }
  if (error instanceof StoreValidationError) {
    return jsonResponse({ error: "VALIDATION" }, 400);
  }
  console.error("[api]", error);
  return jsonResponse(
    { error: "INTERNAL", message: "The action could not be completed." },
    500,
  );
}

export async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  const text = await request.text();
  if (text.length > 1_000_000) {
    throw new StoreValidationError("Request too large");
  }
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new StoreValidationError("Invalid JSON");
  }
}

export function validationResponse(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): Response {
  return jsonResponse(
    {
      error: "VALIDATION",
      issues: issues.map((issue) => ({
        path: issue.path.map((part) => String(part)).join("."),
        message: issue.message,
      })),
    },
    400,
  );
}
