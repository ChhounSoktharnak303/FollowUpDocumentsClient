import {
  jsonResponse,
  requireApiAuth,
  routeError,
} from "@/lib/http";
import { regenerateShareToken } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    const token = await regenerateShareToken(id);
    return jsonResponse({ token });
  } catch (error) {
    return routeError(error);
  }
}
