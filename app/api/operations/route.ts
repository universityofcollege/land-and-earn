import { adjustPurchaseOrder, approvePacket, correctExtractedField, createEmployer, createMouVersion, createPacket, decideClaim, decideEligibilityCheck, discardReminder, generateReminderDrafts, linkClaimSupportingDocument, linkDocumentToPacket, markPacketPaid, recordReminderCopy, resolveException, reviewExtractedField, reviewReminder, updateEmployer, updateProgramSettings, voidInvoice } from "../../../lib/data";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { action?: string; id?: string; packetId?: string; amount?: number; reason?: string; value?: string; [key: string]: unknown };
    if (body.action === "generate_reminders") return Response.json(await generateReminderDrafts());
    if (body.action === "create_employer") return Response.json(await createEmployer(body));
    if (body.action === "create_packet") return Response.json(await createPacket(body));
    if (body.action === "create_mou_version") return Response.json(await createMouVersion(body));
    if (body.action === "update_program_settings") return Response.json(await updateProgramSettings(body));
    if (!body.id) return Response.json({ error: "Record id is required." }, { status: 400 });
    if (body.action === "resolve_exception") return Response.json(await resolveException(body.id, String(body.reason ?? "")));
    if (body.action === "approve_packet") return Response.json(await approvePacket(body.id));
    if (body.action === "mark_paid") return Response.json(await markPacketPaid(body.id));
    if (body.action === "review_reminder") return Response.json(await reviewReminder(body.id, String(body.body ?? "")));
    if (body.action === "copy_reminder") return Response.json(await recordReminderCopy(body.id, String(body.body ?? "")));
    if (body.action === "discard_reminder") return Response.json(await discardReminder(body.id));
    if (body.action === "adjust_purchase_order") return Response.json(await adjustPurchaseOrder({ id: body.id, amount: body.amount, reason: body.reason }));
    if (body.action === "update_employer") return Response.json(await updateEmployer(body));
    if (body.action === "void_invoice") return Response.json(await voidInvoice(body.id, String(body.reason ?? "")));
    if (body.action === "correct_field") return Response.json(await correctExtractedField({ id: body.id, value: body.value, reason: body.reason }));
    if (body.action === "review_field") return Response.json(await reviewExtractedField(body.id));
    if (body.action === "decide_claim") return Response.json(await decideClaim({ id: body.id, decision: String(body.decision ?? ""), amountEligible: Number(body.amountEligible), reason: body.reason }));
    if (body.action === "decide_eligibility_check") return Response.json(await decideEligibilityCheck({ id: body.id, result: String(body.result ?? ""), reason: body.reason }));
    if (body.action === "link_claim_support") return Response.json(await linkClaimSupportingDocument({ id: body.id, documentId: String(body.documentId ?? "") }));
    if (body.action === "link_document") return Response.json(await linkDocumentToPacket({ id: body.id, packetId: body.packetId }));
    return Response.json({ error: "Unsupported operation." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Operation failed." }, { status: 409 });
  }
}
