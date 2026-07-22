import { buildPacketArchive } from "../../../lib/data";
import { accessErrorResponse, requireIdentity } from "../../../lib/auth";

export async function GET(request: Request) {
  try {
    const packetId = new URL(request.url).searchParams.get("packetId");
    if (!packetId) return Response.json({ error: "Packet id is required." }, { status: 400 });
    const identity = requireIdentity(request);
    const packet = await buildPacketArchive(packetId, identity.actor);
    const body = new Uint8Array(packet.body.byteLength);
    body.set(packet.body);
    return new Response(body.buffer, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${packet.fileName}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    const response = accessErrorResponse(error, "Export unavailable.");
    return response.status >= 500 ? new Response(response.body, { status: 404, headers: response.headers }) : response;
  }
}
