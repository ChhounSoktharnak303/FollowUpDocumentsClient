import {
  jsonResponse,
  readJson,
  requireApiAuth,
  routeError,
  validationResponse,
} from "@/lib/http";
import { updateCase } from "@/lib/store";
import { caseUpdateSchema } from "@/lib/validation";

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
    const parsed = caseUpdateSchema.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error.issues);
    const caseRecord = await updateCase(id, parsed.data);
    return jsonResponse({ case: caseRecord });
  } catch (error) {
    return routeError(error);
  }
}
