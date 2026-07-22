import { buildPacketArchive } from "../../../lib/data";

export async function GET(request: Request) {
  try {
    const packetId = new URL(request.url).searchParams.get("packetId");
    if (!packetId) return Response.json({ error: "Packet id is required." }, { status: 400 });
    const packet = await buildPacketArchive(packetId);
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
    return Response.json({ error: error instanceof Error ? error.message : "Export unavailable." }, { status: 404 });
  }
}
