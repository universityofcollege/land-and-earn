import { getDocumentOriginal } from "../../../lib/data";
import { accessErrorResponse, requireIdentity } from "../../../lib/auth";

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "Document id is required." }, { status: 400 });
    const identity = requireIdentity(request);
    const file = await getDocumentOriginal(id, identity.actor);
    return new Response(file.body, {
      headers: {
        "content-type": file.contentType,
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    const response = accessErrorResponse(error, "File unavailable.");
    return response.status >= 500 ? new Response(response.body, { status: 404, headers: response.headers }) : response;
  }
}
