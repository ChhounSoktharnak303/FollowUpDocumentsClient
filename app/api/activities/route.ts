import {
  jsonResponse,
  readJson,
  requireApiAuth,
  routeError,
  validationResponse,
} from "@/lib/http";
import { createActivity } from "@/lib/store";
import { activityCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;
  try {
    const body = await readJson(request);
    const parsed = activityCreateSchema.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error.issues);
    const activity = await createActivity(parsed.data);
    return jsonResponse({ activity }, 201);
  } catch (error) {
    return routeError(error);
  }
}
