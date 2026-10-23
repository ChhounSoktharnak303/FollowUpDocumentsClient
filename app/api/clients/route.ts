import {
  jsonResponse,
  readJson,
  requireApiAuth,
  routeError,
  validationResponse,
} from "@/lib/http";
import { createClient } from "@/lib/store";
import { clientCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;
  try {
    const body = await readJson(request);
    const parsed = clientCreateSchema.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error.issues);
    const client = await createClient(parsed.data);
    return jsonResponse({ client }, 201);
  } catch (error) {
    return routeError(error);
  }
}
