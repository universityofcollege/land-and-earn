import { getDocumentOriginal } from "../../../lib/data";

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "Document id is required." }, { status: 400 });
    const file = await getDocumentOriginal(id);
    return new Response(file.body, {
      headers: {
        "content-type": file.contentType,
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "File unavailable." }, { status: 404 });
  }
}
