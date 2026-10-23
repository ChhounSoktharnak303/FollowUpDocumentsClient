import type { TranslationKey } from "@/lib/i18n";

export class ApiRequestError extends Error {
  readonly code: string;
  readonly issues: Array<{ path: string; message: string }>;

  constructor(
    code: string,
    issues: Array<{ path: string; message: string }> = [],
  ) {
    super(code);
    this.name = "ApiRequestError";
    this.code = code;
    this.issues = issues;
  }
}

export async function sendJson<T>(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data: unknown = null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    data = await response.json().catch(() => null);
  }
  if (!response.ok) {
    const payload = (data ?? {}) as {
      error?: string;
      issues?: Array<{ path?: string; message?: string }>;
    };
    const issues = Array.isArray(payload.issues)
      ? payload.issues.map((issue) => ({
          path: issue.path ?? "",
          message: issue.message ?? "",
        }))
      : [];
    throw new ApiRequestError(payload.error ?? "INTERNAL", issues);
  }
  return data as T;
}

export function apiErrorKey(error: unknown): TranslationKey {
  if (error instanceof ApiRequestError) {
    if (error.code === "EXCEL_LOCKED") return "errorLocked";
    if (error.code === "UNAUTHORIZED") return "errorUnauthorized";
    if (error.code === "VALIDATION") return "errorValidation";
    if (error.code === "NOT_FOUND") return "errorNotFound";
  }
  return "errorGeneric";
}
