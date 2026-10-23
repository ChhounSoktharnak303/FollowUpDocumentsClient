import {
  jsonResponse,
  readJson,
  requireApiAuth,
  routeError,
  validationResponse,
} from "@/lib/http";
import { updateSettings } from "@/lib/store";
import { settingsUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PUT(request: Request): Promise<Response> {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;
  try {
    const body = await readJson(request);
    const parsed = settingsUpdateSchema.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error.issues);
    const settings = await updateSettings(parsed.data);
    return jsonResponse({ settings });
  } catch (error) {
    return routeError(error);
  }
}
