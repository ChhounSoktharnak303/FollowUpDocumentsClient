import {
  jsonResponse,
  readJson,
  requireApiAuth,
  routeError,
  validationResponse,
} from "@/lib/http";
import { deleteActivity, updateActivity } from "@/lib/store";
import { activityUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    const body = await readJson(request);
    const parsed = activityUpdateSchema.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error.issues);
    const activity = await updateActivity(id, parsed.data);
    return jsonResponse({ activity });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    await deleteActivity(id);
    return jsonResponse({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
