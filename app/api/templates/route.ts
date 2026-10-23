import {
  jsonResponse,
  readJson,
  requireApiAuth,
  routeError,
  validationResponse,
} from "@/lib/http";
import { createTemplate } from "@/lib/store";
import { templateCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;
  try {
    const body = await readJson(request);
    const parsed = templateCreateSchema.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error.issues);
    const template = await createTemplate(parsed.data);
    return jsonResponse({ template }, 201);
  } catch (error) {
    return routeError(error);
  }
}
