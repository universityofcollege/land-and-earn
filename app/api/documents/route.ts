import { storeDocuments } from "../../../lib/data";
import { accessErrorResponse, requireIdentity } from "../../../lib/auth";

export async function POST(request: Request) {
  try {
    const identity = requireIdentity(request, "manage");
    return Response.json(await storeDocuments(await request.formData(), identity.actor), { status: 201 });
  } catch (error) {
    const response = accessErrorResponse(error, "Upload failed.");
    return response.status >= 500 ? new Response(response.body, { status: 400, headers: response.headers }) : response;
  }
}
