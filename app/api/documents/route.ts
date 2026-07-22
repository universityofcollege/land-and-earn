import { storeDocument } from "../../../lib/data";

export async function POST(request: Request) {
  try {
    return Response.json(await storeDocument(await request.formData()), { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}
