import {
  jsonResponse,
  readJson,
  requireApiAuth,
  routeError,
  validationResponse,
} from "@/lib/http";
import { deleteTemplate, updateTemplate } from "@/lib/store";
import { templateUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    const body = await readJson(request);
    const parsed = templateUpdateSchema.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error.issues);
    const template = await updateTemplate(id, parsed.data);
    return jsonResponse({ template });
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
    await deleteTemplate(id);
    return jsonResponse({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
