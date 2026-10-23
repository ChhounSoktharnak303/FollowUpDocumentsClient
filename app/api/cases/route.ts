import {
  jsonResponse,
  readJson,
  requireApiAuth,
  routeError,
  validationResponse,
} from "@/lib/http";
import { createCase } from "@/lib/store";
import { caseCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;
  try {
    const body = await readJson(request);
    const parsed = caseCreateSchema.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error.issues);
    const caseRecord = await createCase(parsed.data);
    return jsonResponse({ case: caseRecord }, 201);
  } catch (error) {
    return routeError(error);
  }
}
