import { approvePacket, markPacketPaid, resolveException, reviewReminder } from "../../../lib/data";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { action?: string; id?: string };
    if (!body.id) return Response.json({ error: "Record id is required." }, { status: 400 });
    if (body.action === "resolve_exception") return Response.json(await resolveException(body.id));
    if (body.action === "approve_packet") return Response.json(await approvePacket(body.id));
    if (body.action === "mark_paid") return Response.json(await markPacketPaid(body.id));
    if (body.action === "review_reminder") return Response.json(await reviewReminder(body.id));
    return Response.json({ error: "Unsupported operation." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Operation failed." }, { status: 409 });
  }
}
