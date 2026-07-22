"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardData, EligibilityCheck, EmployerSummary, PacketDocument, PacketSummary, ReimbursementClaim, ReminderDraft } from "../lib/types";

type View = "desk" | "packets" | "employers" | "intake" | "rules" | "reminders" | "setup";
type Operate = (action: string, id?: string, values?: Record<string, unknown>) => Promise<Record<string, unknown>>;

const navItems: { id: View; label: string; mark: string }[] = [
  { id: "desk", label: "Closeout desk", mark: "⌂" },
  { id: "packets", label: "Reimbursements", mark: "▤" },
  { id: "employers", label: "Employer funding", mark: "$" },
  { id: "intake", label: "Document intake", mark: "↑" },
  { id: "rules", label: "Eligibility rules", mark: "§" },
  { id: "reminders", label: "Reminder drafts", mark: "✉" },
  { id: "setup", label: "Program setup", mark: "⚙" },
];

const statusLabels: Record<string, string> = {
  follow_up_required: "Follow-up required",
  needs_review: "Needs review",
  ready_for_approval: "Ready for approval",
  invoice_not_received: "Invoice not received",
  approved: "Approved",
  paid: "Paid",
  processing: "Processing",
  reminder_draft_ready: "Reminder draft ready",
  extracted: "Extracted",
  reviewed: "Reviewed",
  duplicate: "Duplicate linked",
};

const activityColors: Record<string, string> = {
  "Job placement": "var(--pine)",
  "Community engagement": "var(--river)",
  Storytelling: "var(--gold)",
  "Soft skills": "var(--clay)",
};

function money(value: number, cents = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: cents ? 2 : 0,
  }).format(value);
}

function shortDate(value: string | null) {
  if (!value) return "Not received";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill status-${status}`}>{statusLabels[status] ?? titleCase(status)}</span>;
}

function LoadingDesk() {
  return <div className="loading-desk" role="status" aria-label="Loading Land and Earn">
    <div className="loading-brand"><span>LE</span><i /></div>
    <p>Opening the reimbursement desk…</p>
  </div>;
}

function EmptyMessage({ title, body }: { title: string; body: string }) {
  return <div className="empty-message"><span>○</span><strong>{title}</strong><p>{body}</p></div>;
}

function FundingRibbon({ employers, warningPercent, onSelect }: { employers: EmployerSummary[]; warningPercent: number; onSelect: (employer: EmployerSummary) => void }) {
  return <section className="funding-ribbon" aria-label="Employer purchase order utilization">
    <div className="ribbon-head">
      <div><span className="section-kicker">Purchase order runway</span><h2>Funding left by employer</h2></div>
      <p>Invoices reserve funding the moment they arrive.</p>
    </div>
    <div className="ribbon-track">
      {employers.map((employer) => { const low = employer.currentFunding > 0 && (employer.available / employer.currentFunding) * 100 <= warningPercent; return <button key={employer.id} className={`ribbon-segment ${low ? "funding-low" : ""}`} onClick={() => onSelect(employer)}>
        <span className="ribbon-label"><b>{employer.name.replace(" Independent Schools", " Schools").replace(" Community", "")}</b><small>{employer.poNumber}</small></span>
        <span className="ribbon-bar"><i style={{ width: `${Math.min(employer.utilization, 100)}%` }} /></span>
        <span className="ribbon-values"><strong>{money(employer.available)}</strong><small>{employer.utilization}% committed{low ? " · low funding" : ""}</small></span>
      </button>; })}
    </div>
  </section>;
}

function PacketRow({ packet, onOpen }: { packet: PacketSummary; onOpen: (packet: PacketSummary) => void }) {
  const openBlockers = packet.exceptions.filter((item) => item.status === "open" && item.severity === 1).length;
  return <button className="packet-row" onClick={() => onOpen(packet)}>
    <span className={`priority-mark priority-${packet.priority}`}>{packet.priority === 1 ? "P1" : packet.priority === 2 ? "P2" : "P3"}</span>
    <span className="packet-person"><strong>{packet.internName ?? packet.employerName}</strong><small>{packet.employerName}</small></span>
    <span className="packet-period"><strong>{shortDate(packet.periodStart)}–{shortDate(packet.periodEnd)}</strong><small>{packet.invoiceNumber ?? "Invoice missing"}</small></span>
    <span className="packet-proof"><strong>{packet.documents.length || "—"}</strong><small>documents</small></span>
    <span className="packet-amount"><strong>{packet.invoiceAmount ? money(packet.invoiceAmount) : "—"}</strong><small>{openBlockers ? `${openBlockers} blocker${openBlockers > 1 ? "s" : ""}` : `${packet.confidence}% confidence`}</small></span>
    <StatusPill status={packet.status} />
    <span className="row-arrow">→</span>
  </button>;
}

function Queue({ packets, onOpen, compact = false }: { packets: PacketSummary[]; onOpen: (packet: PacketSummary) => void; compact?: boolean }) {
  return <div className={`queue ${compact ? "queue-compact" : ""}`}>
    <div className="queue-labels" aria-hidden="true"><span>Priority</span><span>Intern / employer</span><span>Coverage</span><span>Evidence</span><span>Amount</span><span>Status</span><span /></div>
    {packets.length ? packets.map((packet) => <PacketRow key={packet.id} packet={packet} onOpen={onOpen} />) : <EmptyMessage title="No packets match" body="Change the filter or add a reimbursement packet." />}
  </div>;
}

function DeskView({ data, onPacket, onEmployer, onReminder, go }: { data: DashboardData; onPacket: (packet: PacketSummary) => void; onEmployer: (employer: EmployerSummary) => void; onReminder: (reminder: ReminderDraft) => void; go: (view: View) => void }) {
  const totalFunding = data.employers.reduce((sum, item) => sum + item.currentFunding, 0);
  const totalAvailable = data.employers.reduce((sum, item) => sum + item.available, 0);
  const blockers = data.packets.flatMap((packet) => packet.exceptions).filter((item) => item.status === "open" && item.severity === 1).length;
  const readyAmount = data.packets.filter((packet) => ["ready_for_approval", "approved"].includes(packet.status)).reduce((sum, packet) => sum + packet.invoiceAmount, 0);
  const priorityPackets = data.packets.filter((packet) => !["paid", "archived", "retention_deleted"].includes(packet.status)).slice(0, 4);
  const draftReminders = data.reminders.filter((reminder) => reminder.status === "draft");

  return <>
    <header className="view-header desk-header">
      <div><span className="view-eyebrow">FY{data.settings.fiscalYearEnd.slice(2, 4)} closeout · Land and Earn</span><h1>Get every employer reimbursed.</h1><p>The desk surfaces the next action, protects purchase-order funding, and keeps every decision tied to its evidence.</p></div>
      <button className="primary-action" onClick={() => go("intake")}><span>↑</span> Add documents</button>
    </header>

    <section className="closeout-ledger">
      <div className="ledger-primary"><span>Current funding available</span><strong>{money(totalAvailable)}</strong><small>of {money(totalFunding)} across {data.employers.length} employers</small></div>
      <div className="ledger-rule"><i /><span>Invoices due</span><strong>{shortDate(data.settings.invoiceDeadline)}</strong><small>Payment by {shortDate(data.settings.paymentDeadline)}</small></div>
      <div className="ledger-stat danger"><span>Payment blockers</span><strong>{blockers}</strong><small>must be cleared first</small></div>
      <div className="ledger-stat"><span>Ready to move</span><strong>{money(readyAmount)}</strong><small>approved or ready</small></div>
      <div className="ledger-rate"><span>Program wage</span><strong>{money(data.hourlyRate, true)}</strong><small>per hour · all interns</small></div>
    </section>

    <FundingRibbon employers={data.employers} warningPercent={data.settings.poWarningPercent} onSelect={onEmployer} />

    <div className="desk-grid">
      <section className="work-queue panel">
        <div className="panel-heading"><div><span className="section-kicker">Do next</span><h2>Closeout queue</h2></div><button className="text-action" onClick={() => go("packets")}>See all reimbursements →</button></div>
        <Queue packets={priorityPackets} onOpen={onPacket} compact />
      </section>
      <aside className="reminder-stack panel">
        <div className="panel-heading"><div><span className="section-kicker">Never auto-sent</span><h2>Reminder drafts</h2></div><span className="count-badge">{draftReminders.length}</span></div>
        {draftReminders.length ? draftReminders.map((reminder) => <button key={reminder.id} className="reminder-card" onClick={() => onReminder(reminder)}>
          <span className="mail-mark">✉</span><span><strong>{reminder.employerName}</strong><small>{reminder.subject}</small></span><i>Review</i>
        </button>) : <EmptyMessage title="No drafts waiting" body="New deadline and exception drafts will appear here." />}
      </aside>
    </div>
  </>;
}

function PacketsView({ data, onPacket, operate }: { data: DashboardData; onPacket: (packet: PacketSummary) => void; operate: Operate }) {
  const [filter, setFilter] = useState("open");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false); const [message, setMessage] = useState("");
  const create = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); try { await operate("create_packet", undefined, values); setCreating(false); setMessage("Reimbursement packet created and missing-evidence checks added."); } catch (error) { setMessage(error instanceof Error ? error.message : "Packet creation failed."); } };
  const filtered = data.packets.filter((packet) => {
    const matchesFilter = filter === "all" || (filter === "open" ? !["paid", "approved", "archived", "retention_deleted"].includes(packet.status) : filter === "deadline_risk" ? !["paid", "archived", "retention_deleted"].includes(packet.status) && packet.dueDate <= data.settings.invoiceDeadline : packet.status === filter);
    const haystack = `${packet.internName} ${packet.employerName} ${packet.invoiceNumber} ${packet.poNumber} ${packet.county} ${packet.fiscalYear} ${packet.periodStart} ${packet.periodEnd} ${packet.status} ${packet.exceptions.map((item) => item.title).join(" ")}`.toLowerCase();
    return matchesFilter && haystack.includes(search.toLowerCase());
  });
  return <>
    <header className="view-header"><div><span className="view-eyebrow">Reimbursement packets</span><h1>Evidence before payment.</h1><p>Every invoice, wage record, expense, exception, and approval in one auditable place.</p></div><button className="primary-action" onClick={() => setCreating((value) => !value)}>New packet</button></header>
    {creating && <form className="panel new-packet-form" onSubmit={create}><div><span className="section-kicker">Start reimbursement work</span><h2>New employer reimbursement packet</h2></div><label><span>Employer of record</span><select name="employerId" required defaultValue=""><option value="" disabled>Choose employer</option>{data.employers.map((employer) => <option key={employer.id} value={employer.id}>{employer.name}</option>)}</select></label><label><span>Intern</span><input name="internName" required /></label><label><span>County</span><input name="county" required /></label><label><span>Placement business</span><input name="placement" required /></label><label><span>Placement supervisor</span><input name="supervisorName" /></label><label><span>Supervisor email</span><input name="supervisorEmail" type="email" /></label><label><span>Period start</span><input name="periodStart" type="date" required /></label><label><span>Period end</span><input name="periodEnd" type="date" required /></label><button className="primary-action">Create packet</button></form>}
    {message && <p className={`form-message ${message.includes("created") ? "success" : "error"}`} role="status">{message}</p>}
    <div className="toolbar">
      <label className="search-field"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search intern, employer, PO, invoice, county, FY, period, status, or missing item" /></label>
      <div className="filter-pills">{[
        ["open", "Open"], ["deadline_risk", "At risk"], ["follow_up_required", "Follow-up"], ["needs_review", "Needs review"], ["ready_for_approval", "Ready"], ["approved", "Approved"], ["all", "All"],
      ].map(([value, label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div>
    </div>
    <section className="panel queue-panel"><div className="panel-heading"><div><span className="section-kicker">{filtered.length} packets</span><h2>{filter === "open" ? "Active reimbursement work" : statusLabels[filter] ?? "All reimbursement work"}</h2></div></div><Queue packets={filtered} onOpen={onPacket} /></section>
  </>;
}

function EmployerView({ data, selected, onSelect, onPacket, operate }: { data: DashboardData; selected: EmployerSummary | null; onSelect: (item: EmployerSummary | null) => void; onPacket: (packet: PacketSummary) => void; operate: Operate }) {
  const [amendmentOpen, setAmendmentOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const submitAmendment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!selected) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try { await operate("adjust_purchase_order", selected.purchaseOrderId, { amount: Number(values.amount), reason: String(values.reason) }); setMessage("Purchase-order amendment recorded."); setAmendmentOpen(false); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Amendment failed."); }
  };
  const submitEmployer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!selected) return;
    try { await operate("update_employer", selected.id, Object.fromEntries(new FormData(event.currentTarget))); setMessage("Employer and purchase-order details updated."); setEditing(false); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Employer update failed."); }
  };
  if (selected) {
    const events = data.poEvents.filter((event) => event.purchaseOrderId === selected.purchaseOrderId);
    const packets = data.packets.filter((packet) => packet.employerId === selected.id);
    return <>
      <button className="back-action" onClick={() => onSelect(null)}>← All employers</button>
      <header className="view-header employer-header"><div><span className="view-eyebrow">{selected.county} · {selected.poNumber}</span><h1>{selected.name}</h1><p>{selected.arrangement} · {selected.paySchedule} payroll</p></div><div className="header-actions"><button className="secondary-action" onClick={() => setEditing((open) => !open)}>Edit employer / PO</button><button className="secondary-action" onClick={() => setAmendmentOpen((open) => !open)}>Record PO amendment</button><div className="mou-stamp"><span>MOU current</span><strong>{selected.mouCode}</strong></div></div></header>
      {editing && <form className="inline-operation employer-edit panel" onSubmit={submitEmployer}>
        <div><span className="section-kicker">Audited record update</span><h2>Employer and active purchase order</h2><p>Funding changes remain separate append-only amendments.</p></div>
        <label><span>Employer name</span><input name="name" required defaultValue={selected.name} /></label><label><span>County</span><input name="county" required defaultValue={selected.county} /></label>
        <label><span>Contact name</span><input name="contactName" required defaultValue={selected.contactName} /></label><label><span>Contact email</span><input name="contactEmail" type="email" required defaultValue={selected.contactEmail} /></label>
        <label><span>Arrangement</span><select name="arrangement" defaultValue={selected.arrangement}><option>Employer of record and placement</option><option>Employer of record; separate placements</option></select></label><label><span>Payroll schedule</span><select name="paySchedule" defaultValue={selected.paySchedule}><option>Biweekly</option><option>Semimonthly</option><option>Monthly</option><option>Employer-specific</option></select></label>
        <label><span>PO number</span><input name="poNumber" required defaultValue={selected.poNumber} /></label><label><span>Effective start</span><input name="issuedAt" type="date" required defaultValue={selected.poIssuedAt} /></label><label><span>Effective end</span><input name="effectiveEnd" type="date" required defaultValue={selected.poEffectiveEnd} /></label>
        <label><span>Purchase-order source</span><select name="poDocumentId" defaultValue=""><option value="">{selected.poDocumentName ? `Keep ${selected.poDocumentName}` : "Choose an uploaded PO…"}</option>{data.unmatchedDocuments.filter((document) => document.employerId === selected.id && document.kind === "purchase_order").map((document) => <option key={document.id} value={document.id}>{document.fileName}</option>)}</select></label>
        <button className="primary-action">Save audited update</button>
      </form>}
      {amendmentOpen && <form className="inline-operation panel" onSubmit={submitAmendment}><div><span className="section-kicker">Append-only funding change</span><h2>Record an approved amendment</h2><p>Use a negative amount for an approved reduction. Active invoice commitments can never exceed the revised authorization.</p></div><label><span>Amount</span><input name="amount" type="number" step="0.01" required placeholder="15000.00" /></label><label><span>Reason / source</span><input name="reason" required placeholder="Approved amendment dated…" /></label><button className="primary-action">Post amendment</button></form>}
      {message && <p className={`form-message ${message.includes("recorded") ? "success" : "error"}`} role="status">{message}</p>}
      <section className="employer-balance">
        <div className="balance-main"><span>Current funding available</span><strong>{money(selected.available)}</strong><div className="large-funding-bar"><i style={{ width: `${selected.utilization}%` }} /></div><small>{money(selected.committed)} committed of {money(selected.currentFunding)}</small></div>
        <div><span>Original PO</span><strong>{money(selected.originalFunding)}</strong><small>Issued funding</small></div>
        <div><span>Amendments</span><strong>{selected.amendmentFunding ? `+${money(selected.amendmentFunding)}` : "—"}</strong><small>Approved changes</small></div>
        <div><span>Approved</span><strong>{money(selected.approved)}</strong><small>Validated invoices</small></div>
        <div><span>Paid</span><strong>{money(selected.paid)}</strong><small>Recorded payments</small></div>
      </section>
      <div className="employer-detail-grid">
        <section className="panel"><div className="panel-heading"><div><span className="section-kicker">Funding ledger</span><h2>Purchase order activity</h2></div><code>{selected.poNumber}</code></div>
          <div className="ledger-list">{events.map((event) => <div key={event.id} className="ledger-event"><span className={`event-mark event-${event.eventType}`}>{event.eventType === "invoice_received" ? "−" : event.eventType === "invoice_paid" ? "✓" : "+"}</span><span><strong>{event.reference}</strong><small>{titleCase(event.eventType)} · {event.actor}</small></span><time>{shortDate(event.occurredAt)}</time><b>{money(event.amount)}</b></div>)}</div>
        </section>
        <aside className="panel contact-panel"><span className="section-kicker">Primary contact</span><div className="contact-avatar">{selected.contactName.split(" ").map((part) => part[0]).join("")}</div><h3>{selected.contactName}</h3><a href={`mailto:${selected.contactEmail}`}>{selected.contactEmail}</a><dl><div><dt>Payroll cycle</dt><dd>{selected.paySchedule}</dd></div><div><dt>Structure</dt><dd>{selected.arrangement}</dd></div></dl></aside>
      </div>
      <section className="panel employer-packets"><div className="panel-heading"><div><span className="section-kicker">Linked work</span><h2>Reimbursement packets</h2></div></div><Queue packets={packets} onOpen={onPacket} compact /></section>
    </>;
  }
  return <>
    <header className="view-header"><div><span className="view-eyebrow">Employer funding</span><h1>Every commitment, in view.</h1><p>Purchase orders are the guardrail. Received invoices reserve funding; corrections leave an audit trail.</p></div></header>
    <div className="employer-grid">{data.employers.map((employer) => { const low = employer.currentFunding > 0 && (employer.available / employer.currentFunding) * 100 <= data.settings.poWarningPercent; return <button key={employer.id} className={`employer-card ${low ? "funding-low" : ""}`} onClick={() => onSelect(employer)}>
      <div className="employer-card-head"><span>{employer.county}</span><code>{employer.poNumber}</code></div><h2>{employer.name}</h2><p>{employer.arrangement}</p>
      <div className="card-funding"><span>Available now</span><strong>{money(employer.available)}</strong><small>of {money(employer.currentFunding)}</small></div>
      <div className="card-track"><i style={{ width: `${employer.utilization}%` }} /></div>
      <div className="card-foot"><span><i /> {employer.mouCode}</span><b>{low ? "Low funding · " : ""}{employer.utilization}% committed →</b></div>
    </button>; })}</div>
  </>;
}

function IntakeView({ data, onUploaded, operate }: { data: DashboardData; onUploaded: () => Promise<unknown>; operate: Operate }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage("");
    if (!data.session.canManage) { setMessage("Fiscal reviewer access is read-only. A program manager must upload documents."); setBusy(false); return; }
    const form = event.currentTarget;
    const response = await fetch("/api/documents", { method: "POST", body: new FormData(form) });
    const result = await response.json() as { error?: string; documents?: Array<{ fileName: string; duplicate?: boolean; confidence?: number; provider?: string }> };
    if (!response.ok) setMessage(result.error ?? "Upload failed.");
    else {
      const documents = result.documents ?? [];
      const duplicates = documents.filter((item) => item.duplicate).length;
      setMessage(`${documents.length} document${documents.length === 1 ? "" : "s"} processed${duplicates ? ` · ${duplicates} duplicate${duplicates === 1 ? "" : "s"} linked without double-counting` : ""}.`);
      form.reset(); await onUploaded();
    }
    setBusy(false);
  };
  const link = async (event: FormEvent<HTMLFormElement>, documentId: string) => {
    event.preventDefault(); setMessage(""); const values = Object.fromEntries(new FormData(event.currentTarget));
    try { await operate("link_document", documentId, { packetId: String(values.packetId) }); setMessage("Document linked and packet checks refreshed."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Document could not be linked."); }
  };
  return <>
    <header className="view-header"><div><span className="view-eyebrow">Document intake</span><h1>Bring the paperwork. Keep the source.</h1><p>Original files are preserved; extracted values stay linked to the exact evidence used.</p></div></header>
    <div className="intake-layout">
      <form className="upload-panel" onSubmit={submit}>
        <div className="upload-drop"><span className="upload-symbol">↑</span><h2>Add reimbursement evidence</h2><p>Upload several PDF, image, spreadsheet, or office files at once</p><input name="files" type="file" multiple required accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.tsv,.xlsx,.xls,.doc,.docx,.txt,.rtf" /></div>
        <div className="upload-fields">
          <label><span>Employer of record</span><select name="employerId" required defaultValue=""><option value="" disabled>Choose employer</option>{data.employers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span>Expected document type</span><select name="kind" required defaultValue="unknown"><option value="unknown">Detect from each file</option><option value="invoice">Invoice</option><option value="timesheet">Timesheet or schedule</option><option value="payroll">Pay stub or payroll report</option><option value="business_expense">Business-expense evidence</option><option value="mou">MOU</option><option value="purchase_order">Purchase order / amendment</option><option value="grant_evidence">Grant evidence</option></select></label>
          <label className="wide-field"><span>Link to packet <small>optional</small></span><select name="packetId" defaultValue=""><option value="">Leave unmatched for triage</option>{data.packets.map((packet) => <option key={packet.id} value={packet.id}>{packet.employerName} · {packet.label}</option>)}</select></label>
          <label className="wide-field"><span>Invoice total override <small>optional when the amount is readable</small></span><input name="amount" inputMode="decimal" placeholder="0.00" aria-describedby="amount-help" /><small id="amount-help">When provided, this is the amount reserved against the employer&apos;s active purchase order. Otherwise, the extracted invoice total is used.</small></label>
        </div>
        <button className="primary-action upload-submit" disabled={busy || !data.session.canManage}>{busy ? "Adding document…" : data.session.canManage ? "Add to review queue" : "Read-only access"}</button>
        {message && <p className={`form-message ${message.includes("processed") ? "success" : "error"}`} role="status">{message}</p>}
      </form>
      <aside className="intake-guide panel"><span className="section-kicker">What happens next</span><ol><li><b>1</b><span><strong>Classify</strong><small>Identify invoice, payroll, time, expense, MOU, or PO.</small></span></li><li><b>2</b><span><strong>Extract</strong><small>Read names, dates, amounts, signatures, hours, and expense detail.</small></span></li><li><b>3</b><span><strong>Reconcile</strong><small>Match the packet, reserve PO funding, and test the evidence.</small></span></li><li><b>4</b><span><strong>Review</strong><small>Human approval remains required before payment.</small></span></li></ol><div className="privacy-note"><span>⌑</span><p><strong>Seven-year record</strong> Original files, corrections, and decisions stay attached to the packet.</p></div></aside>
    </div>
    <section className="panel triage-panel"><div className="panel-heading"><div><span className="section-kicker">Unmatched evidence</span><h2>Triage queue</h2></div><span className="count-badge">{data.unmatchedDocuments.length}</span></div>{data.unmatchedDocuments.length ? <div className="triage-list">{data.unmatchedDocuments.map((document) => <form key={document.id} onSubmit={(event) => link(event, document.id)}><span className="file-icon">{document.fileName.split(".").pop()?.slice(0, 3).toUpperCase()}</span><div><strong>{document.fileName}</strong><small>{titleCase(document.kind)} · {document.confidence}% confidence · {document.employerName}</small></div><select name="packetId" required defaultValue=""><option value="" disabled>Choose packet</option>{data.packets.filter((packet) => packet.employerId === document.employerId).map((packet) => <option key={packet.id} value={packet.id}>{packet.label}</option>)}</select><button className="secondary-action">Link</button></form>)}</div> : <EmptyMessage title="Nothing waiting for triage" body="Files uploaded without a packet appear here." />}</section>
  </>;
}

function RulesView({ data, onIntake, operate }: { data: DashboardData; onIntake: () => void; operate: Operate }) {
  const [message, setMessage] = useState("");
  const linkSource = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setMessage("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try { await operate("update_policy_source", String(values.policyId ?? ""), values); setMessage("Governing source linked and recorded in the audit history."); event.currentTarget.reset(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "The governing source could not be linked."); }
  };
  const grantEvidenceNeeded = data.policies.some((policy) => policy.id === "pol-grant" && policy.status !== "verified");
  return <>
    <header className="view-header"><div><span className="view-eyebrow">Eligibility rules</span><h1>The strictest rule controls.</h1><p>IRS is the baseline—not approval. Federal, ARC, grant, budget, and employer MOU terms can be more restrictive.</p></div></header>
    <section className="rule-path">
      {data.policies.map((policy, index) => <article key={policy.id} className="rule-card"><div className="rule-order">{index + 1}</div><div className="rule-level"><span>{policy.level}</span><StatusPill status={policy.status.replace(" ", "_")} /></div><h2>{policy.title}</h2><code>{policy.code} · v{policy.version}</code><p>{policy.summary}</p><footer><span>Effective {shortDate(policy.effectiveAt)}{policy.effectiveEnd ? `–${shortDate(policy.effectiveEnd)}` : ""}</span>{policy.sourceDocumentId ? <a href={`/api/files?id=${encodeURIComponent(policy.sourceDocumentId)}`} target="_blank" rel="noreferrer">{policy.sourceDocumentName ?? "View source"} ↗</a> : <span>Source not linked</span>}</footer></article>)}
    </section>
    {grantEvidenceNeeded && <div className="rule-callout"><span>!</span><div><strong>Land and Earn award evidence still needed</strong><p>Load the signed grant agreement, approved budget, and amendments before relying on live business-expense determinations.</p></div><button onClick={onIntake}>Go to document intake</button></div>}
    {data.session.canManage && <form className="panel policy-source-form" onSubmit={linkSource}><div><span className="section-kicker">Versioned governing evidence</span><h2>Link an authoritative source</h2><p>Connect an uploaded grant, budget, amendment, federal, or ARC record to the rule it supports.</p></div><label><span>Rule</span><select name="policyId" required defaultValue=""><option value="" disabled>Choose rule</option>{data.policies.map((policy) => <option key={policy.id} value={policy.id}>{policy.level} · {policy.title}</option>)}</select></label><label><span>Uploaded source</span><select name="documentId" required defaultValue=""><option value="" disabled>Choose grant evidence</option>{data.unmatchedDocuments.filter((document) => document.kind === "grant_evidence").map((document) => <option key={document.id} value={document.id}>{document.fileName}</option>)}</select></label><label><span>Version</span><input name="version" required placeholder="2026.1" /></label><label><span>Effective start</span><input name="effectiveAt" type="date" required /></label><label><span>Effective end <small>optional</small></span><input name="effectiveEnd" type="date" /></label><button className="primary-action">Link source</button></form>}
    {message && <p className={`form-message policy-message ${message.includes("linked") ? "success" : "error"}`} role="status">{message}</p>}
  </>;
}

function RemindersView({ data, onOpen, operate }: { data: DashboardData; onOpen: (reminder: ReminderDraft) => void; operate: Operate }) {
  const [message, setMessage] = useState("");
  const generate = async () => {
    try { const result = await operate("generate_reminders"); const created = Number(result.created ?? 0); const refreshed = Number(result.refreshed ?? 0); setMessage(`${created} new draft${created === 1 ? "" : "s"} prepared${refreshed ? ` · ${refreshed} existing draft${refreshed === 1 ? "" : "s"} refreshed` : ""}. Nothing was sent.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Draft generation failed."); }
  };
  return <>
    <header className="view-header"><div><span className="view-eyebrow">Reminder drafts</span><h1>Follow up without losing the thread.</h1><p>Drafts are prepared from unresolved evidence and deadlines. Nothing is sent automatically.</p></div><button className="primary-action" onClick={generate}>Prepare outstanding drafts</button></header>
    {message && <p className="form-message success" role="status">{message}</p>}
    <section className="reminders-board"><div className="board-column"><div className="board-title"><span>Needs review</span><b>{data.reminders.filter((item) => item.status === "draft").length}</b></div>{data.reminders.filter((item) => item.status === "draft").map((reminder) => <button key={reminder.id} className="board-card" onClick={() => onOpen(reminder)}><span className="mail-mark">✉</span><strong>{reminder.employerName}</strong><p>{reminder.subject}</p><small>To {reminder.contactEmail}</small><i>Open draft →</i></button>)}</div><div className="board-column"><div className="board-title"><span>Reviewed</span><b>{data.reminders.filter((item) => item.status === "reviewed").length}</b></div>{data.reminders.filter((item) => item.status === "reviewed").length ? data.reminders.filter((item) => item.status === "reviewed").map((reminder) => <button key={reminder.id} className="board-card reviewed" onClick={() => onOpen(reminder)}><span className="mail-mark">✓</span><strong>{reminder.employerName}</strong><p>{reminder.subject}</p><small>Reviewed {shortDate(reminder.reviewedAt)}</small></button>) : <EmptyMessage title="No reviewed drafts yet" body="Reviewed drafts remain here for the audit trail." />}</div></section>
  </>;
}

function SetupView({ data, operate }: { data: DashboardData; operate: Operate }) {
  const [message, setMessage] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>, action: string) => {
    event.preventDefault(); setMessage(""); const values = Object.fromEntries(new FormData(event.currentTarget));
    try { await operate(action, undefined, values); setMessage(action === "create_employer" ? "Employer, purchase order, and MOU created." : "Program settings updated."); if (action === "create_employer") event.currentTarget.reset(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "The setup change could not be saved."); }
  };
  const dispose = async (event: FormEvent<HTMLFormElement>, packetId: string) => {
    event.preventDefault(); setMessage(""); const values = Object.fromEntries(new FormData(event.currentTarget));
    try { await operate("dispose_packet", packetId, values); setMessage("Post-retention disposition completed and recorded."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Retention disposition could not be completed."); }
  };
  return <>
    <header className="view-header"><div><span className="view-eyebrow">Program setup</span><h1>Make the rules explicit.</h1><p>Program dates, wage rate, employer contacts, purchase orders, and MOU terms drive every reimbursement check.</p></div></header>
    {message && <p className={`form-message ${message.includes("created") || message.includes("updated") ? "success" : "error"}`} role="status">{message}</p>}
    <div className="setup-grid">
      <form className="panel setup-form" onSubmit={(event) => submit(event, "update_program_settings")}><div className="panel-heading"><div><span className="section-kicker">Program terms</span><h2>Land and Earn</h2></div></div><div className="form-grid">
        <label><span>Hourly rate</span><input name="hourlyRate" type="number" step="0.01" required defaultValue={data.settings.hourlyRate} /></label>
        <label><span>Retention years</span><input name="retentionYears" type="number" min="7" required defaultValue={data.settings.retentionYears} /></label>
        <label><span>Grant closeout / retention anchor</span><input name="retentionAnchorDate" type="date" defaultValue={data.settings.retentionAnchorDate ?? ""} /><small>Disposition is calculated from this confirmed program-level date.</small></label>
        <label><span>Fiscal year starts</span><input name="fiscalYearStart" type="date" required defaultValue={data.settings.fiscalYearStart} /></label>
        <label><span>Fiscal year ends</span><input name="fiscalYearEnd" type="date" required defaultValue={data.settings.fiscalYearEnd} /></label>
        <label><span>Invoice deadline</span><input name="invoiceDeadline" type="date" required defaultValue={data.settings.invoiceDeadline} /></label>
        <label><span>Payment deadline</span><input name="paymentDeadline" type="date" required defaultValue={data.settings.paymentDeadline} /></label>
        <label className="wide-field"><span>PO low-funding warning</span><input name="poWarningPercent" type="number" min="0" max="100" required defaultValue={data.settings.poWarningPercent} /><small>Warn when available funding falls below this percentage.</small></label>
        <label className="wide-field retention-confirm"><input name="retentionPolicyConfirmed" type="checkbox" defaultChecked={data.settings.retentionPolicyConfirmed} /><span>Fiscal staff confirmed this retention basis</span><small>{data.settings.retentionPolicyConfirmed ? `Confirmed by ${data.settings.retentionConfirmedBy ?? "authorized staff"} · disposition eligible ${data.settings.retentionEligibleAt ?? "after the configured period"}` : "Deletion remains disabled until this policy and anchor date are explicitly confirmed."}</small></label>
      </div><button className="primary-action">Save program terms</button></form>
      <form className="panel setup-form" onSubmit={(event) => submit(event, "create_employer")}><div className="panel-heading"><div><span className="section-kicker">Employer onboarding</span><h2>Add employer + funding</h2></div></div><div className="form-grid">
        <label><span>Legal/display name</span><input name="name" required /></label><label><span>County</span><input name="county" required /></label>
        <label><span>Primary contact</span><input name="contactName" required /></label><label><span>Contact email</span><input name="contactEmail" type="email" required /></label>
        <label><span>Arrangement</span><select name="arrangement" defaultValue="Employer of record and placement"><option>Employer of record and placement</option><option>Employer of record; separate placements</option></select></label><label><span>Payroll schedule</span><select name="paySchedule" defaultValue="Biweekly"><option>Biweekly</option><option>Semimonthly</option><option>Monthly</option><option>Employer-specific</option></select></label>
        <label><span>PO number</span><input name="poNumber" required /></label><label><span>Original PO funding</span><input name="originalFunding" type="number" min="0.01" step="0.01" required /></label>
        <label><span>MOU code</span><input name="mouCode" required /></label><label><span>Effective start</span><input name="effectiveStart" type="date" required defaultValue={data.settings.fiscalYearStart} /></label>
        <label><span>Effective end</span><input name="effectiveEnd" type="date" required defaultValue={data.settings.fiscalYearEnd} /></label><label><span>Allowed business expenses</span><input name="allowedExpenses" placeholder="Training, required apparel, supplies" /></label>
      </div><button className="primary-action">Create employer record</button></form>
    </div>
    <form className="panel mou-version-form" onSubmit={(event) => submit(event, "create_mou_version")}><div className="panel-heading"><div><span className="section-kicker">Append-only MOU update</span><h2>Add a new governing version</h2></div><p>The prior current version is retained as superseded.</p></div><div className="form-grid"><label><span>Employer</span><select name="employerId" required defaultValue=""><option value="" disabled>Choose employer</option>{data.employers.map((employer) => <option key={employer.id} value={employer.id}>{employer.name}</option>)}</select></label><label><span>MOU code</span><input name="code" required /></label><label><span>Version</span><input name="version" required placeholder="2" /></label><label><span>Effective start</span><input name="effectiveStart" type="date" required /></label><label><span>Effective end</span><input name="effectiveEnd" type="date" required /></label><label><span>Allowed expense categories</span><input name="allowedExpenses" placeholder="Required training, safety equipment" /></label><label><span>Limits JSON</span><input name="limits" placeholder='{"Required training": 1500}' /></label><label><span>Conditions <small>separate with ;</small></span><input name="conditions" /></label><label className="wide-field"><span>Evidence requirements <small>comma-separated</small></span><input name="evidenceRequirements" placeholder="Itemized receipt, proof of payment, business purpose" /></label><label><span>Signed MOU source</span><select name="documentId" defaultValue=""><option value="">Choose an uploaded MOU…</option>{data.unmatchedDocuments.filter((document) => document.kind === "mou").map((document) => <option key={document.id} value={document.id}>{document.employerName} · {document.fileName}</option>)}</select></label></div><button className="primary-action">Create MOU version</button></form>
    <section className="panel mou-register"><div className="panel-heading"><div><span className="section-kicker">Versioned governing evidence</span><h2>Employer MOU register</h2></div></div><table><thead><tr><th>Employer</th><th>MOU / version</th><th>Effective period</th><th>Allowed expense categories</th><th>Status</th></tr></thead><tbody>{data.mous.map((mou) => <tr key={mou.id}><td>{data.employers.find((employer) => employer.id === mou.employerId)?.name ?? mou.employerId}</td><td><strong>{mou.code}</strong><small>Version {mou.version}</small>{mou.documentId && <a href={`/api/files?id=${encodeURIComponent(mou.documentId)}`} target="_blank" rel="noreferrer">{mou.documentName ?? "Open signed source"}</a>}</td><td>{shortDate(mou.effectiveStart)}–{shortDate(mou.effectiveEnd)}</td><td>{mou.allowedExpenses.length ? mou.allowedExpenses.join(", ") : "Requires fiscal mapping"}</td><td><StatusPill status={mou.status} /></td></tr>)}</tbody></table></section>
    <section className="panel retention-panel"><div className="panel-heading"><div><span className="section-kicker">Defensible deletion</span><h2>Post-retention disposition</h2></div><p>Paid packets must be archived first. Shared evidence stays available to every other packet.</p></div>{data.retentionCandidates.length ? <div className="retention-list">{data.retentionCandidates.map((candidate) => { const eligible = Boolean(data.settings.retentionPolicyConfirmed && candidate.eligibleAt && candidate.eligibleAt <= new Date().toISOString().slice(0, 10)); return <form key={candidate.id} onSubmit={(event) => dispose(event, candidate.id)}><div><strong>{candidate.label}</strong><small>{candidate.employerName} · {candidate.documentCount} document(s) · {candidate.eligibleAt ? `eligible ${candidate.eligibleAt}` : "retention date unconfigured"}</small></div><input name="reason" required minLength={12} placeholder="Disposition reason" aria-label={`Disposition reason for ${candidate.id}`} /><input name="confirmation" required placeholder={`Type ${candidate.id}`} aria-label={`Type ${candidate.id} to confirm`} /><button className="danger-action" disabled={!eligible}>{eligible ? "Delete retained content" : "Retention active"}</button></form>; })}</div> : <EmptyMessage title="No archived packets awaiting disposition" body="Paid packets can be archived from their packet review. Deletion remains unavailable until the confirmed retention period has elapsed." />}</section>
  </>;
}

function ExtractedEvidence({ document, act }: { document: PacketDocument; act: Operate }) {
  const [editing, setEditing] = useState(""); const [value, setValue] = useState(""); const [reason, setReason] = useState(""); const [message, setMessage] = useState("");
  const warnings = Array.isArray(document.extracted.warnings) ? document.extracted.warnings.map(String) : [];
  const sensitive = document.extracted.sensitiveDataDetected === true;
  const save = async (fieldId: string) => { try { await act("correct_field", fieldId, { value, reason }); setEditing(""); setMessage("Correction recorded in the audit trail."); } catch (error) { setMessage(error instanceof Error ? error.message : "Correction failed."); } };
  return <details className="extracted-evidence"><summary><span>{document.fieldEvidence.length} extracted field{document.fieldEvidence.length === 1 ? "" : "s"}</span><small>{document.classificationConfidence}% classification · {document.extractionProvider}</small></summary>{sensitive && <p className="extraction-warning">Sensitive identifiers may be present in the protected original. They were not extracted or displayed.</p>}{warnings.map((warning) => <p key={warning} className="extraction-warning">{warning}</p>)}{message && <p className="field-message">{message}</p>}<div className="field-table">{document.fieldEvidence.map((field) => <div key={field.id} className="field-row"><span><b>{titleCase(field.name)}</b><small>{field.source}</small></span>{editing === field.id ? <><input value={value} onChange={(event) => setValue(event.target.value)} aria-label={`Correct ${field.name}`} /><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for correction" aria-label="Correction reason" /><button disabled={!value || !reason} onClick={() => save(field.id)}>Save</button><button onClick={() => setEditing("")}>Cancel</button></> : <><strong>{String(field.value) || "Not found"}</strong><i>{field.status === "reviewed" || field.status === "corrected" ? titleCase(field.status) : `${field.confidence}%`}</i><span className="field-actions"><button onClick={() => { setEditing(field.id); setValue(String(field.value)); setReason(""); }}>Correct</button>{field.status === "extracted" && String(field.value).trim() !== "" && <button onClick={async () => { await act("review_field", field.id); setMessage("Field verified by the program manager."); }}>Accept</button>}</span></>}</div>)}</div></details>;
}

function DocumentPacketLink({ document, packets, act }: { document: PacketDocument; packets: PacketSummary[]; act: Operate }) {
  const [packetId, setPacketId] = useState(""); const [message, setMessage] = useState("");
  const link = async () => { try { await act("link_document", document.id, { packetId }); setMessage("Linked without copying the original."); setPacketId(""); } catch (error) { setMessage(error instanceof Error ? error.message : "Link failed."); } };
  return <div className="document-linker"><select value={packetId} onChange={(event) => setPacketId(event.target.value)} aria-label={`Link ${document.fileName} to another packet`}><option value="">Link to another packet…</option>{packets.map((packet) => <option key={packet.id} value={packet.id}>{packet.label}</option>)}</select><button disabled={!packetId} onClick={link}>Link evidence</button>{message && <small>{message}</small>}</div>;
}

function ClaimReview({ claim, documents, act }: { claim: ReimbursementClaim; documents: PacketDocument[]; act: Operate }) {
  const [decision, setDecision] = useState(claim.status === "eligible" || claim.status === "ineligible" ? claim.status : "eligible");
  const [amount, setAmount] = useState(String(claim.amountEligible ?? claim.amountRequested)); const [supportId, setSupportId] = useState(claim.supportingDocumentId ?? ""); const [reason, setReason] = useState(""); const [message, setMessage] = useState("");
  const save = async () => { try { await act("decide_claim", claim.id, { decision, amountEligible: Number(amount), reason }); setMessage("Eligibility decision recorded."); } catch (error) { setMessage(error instanceof Error ? error.message : "Decision failed."); } };
  const support = async () => { try { await act("link_claim_support", claim.id, { documentId: supportId }); setMessage("Supporting evidence linked to this expense line."); } catch (error) { setMessage(error instanceof Error ? error.message : "Evidence link failed."); } };
  const supportingDocuments = documents.filter((document) => ["business_expense", "unknown"].includes(document.kind));
  return <article className="claim-card"><header><div><strong>{claim.description}</strong><small>{claim.category} · source {claim.source}</small></div><b>{money(claim.amountRequested, true)}</b></header><div className="claim-support"><label><span>Supporting document</span><select value={supportId} onChange={(event) => setSupportId(event.target.value)}><option value="">Choose receipt or expense record…</option>{supportingDocuments.map((document) => <option key={document.id} value={document.id}>{document.fileName}</option>)}</select></label><button disabled={!supportId || supportId === claim.supportingDocumentId} onClick={support}>{claim.supportingDocumentId ? "Change link" : "Link evidence"}</button>{claim.supportingDocumentName && <small>Linked: {claim.supportingDocumentName}</small>}</div><ol>{claim.checks.map((check, index) => <EligibilityCheckRow key={check.id} check={check} index={index} act={act} />)}</ol><div className="claim-decision"><select value={decision} onChange={(event) => setDecision(event.target.value)}><option value="eligible">Eligible</option><option value="ineligible">Ineligible</option></select><input type="number" min="0" max={claim.amountRequested} step="0.01" value={decision === "ineligible" ? "0" : amount} disabled={decision === "ineligible"} onChange={(event) => setAmount(event.target.value)} aria-label="Eligible amount" /><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Final decision reason" aria-label="Eligibility decision reason" /><button onClick={save} disabled={!reason}>Record decision</button></div>{message && <p className="field-message">{message}</p>}</article>;
}

function EligibilityCheckRow({ check, index, act }: { check: EligibilityCheck; index: number; act: Operate }) {
  const [open, setOpen] = useState(false); const [result, setResult] = useState(check.result === "fail" ? "fail" : "pass"); const [reason, setReason] = useState(check.reviewedAt ? check.reason : ""); const [message, setMessage] = useState("");
  const save = async () => { try { await act("decide_eligibility_check", check.id, { result, reason }); setMessage("Recorded"); setOpen(false); } catch (error) { setMessage(error instanceof Error ? error.message : "Review failed"); } };
  return <li className="eligibility-check-row"><span>{index + 1}</span><div><strong>{check.authorityLevel}</strong><small>{check.reason}</small>{check.sourceDocumentId ? <a className="check-source" href={`/api/files?id=${encodeURIComponent(check.sourceDocumentId)}`} target="_blank" rel="noreferrer">{check.policyCode}{check.policyVersion ? ` v${check.policyVersion}` : ""} · {check.sourceDocumentName} ↗</a> : <em className="check-source-missing">Specific governing source not linked</em>}{message && <em>{message}</em>}{open && <div className="check-review"><select value={result} onChange={(event) => setResult(event.target.value)}><option value="pass">Pass</option><option value="fail">Fail</option></select><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Specific evidence or controlling rule" /><button disabled={!reason} onClick={save}>Save</button></div>}</div><button className={`check-result check-${check.result}`} onClick={() => setOpen((value) => !value)}>{check.reviewedAt ? titleCase(check.result) : "Review"}</button></li>;
}

function PacketDrawer({ packet, employer, employerPackets, hourlyRate, onClose, act }: { packet: PacketSummary; employer: EmployerSummary; employerPackets: PacketSummary[]; hourlyRate: number; onClose: () => void; act: Operate }) {
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState("");
  const [releaseReason, setReleaseReason] = useState("");
  const [previewId, setPreviewId] = useState("");
  const openBlockers = packet.exceptions.filter((item) => item.status === "open" && item.severity === 1);
  const activeInvoice = packet.invoiceAmount > 0 && packet.status !== "invoice_not_received";
  const balanceBefore = employer.available + (activeInvoice ? packet.invoiceAmount : 0);
  const totalHours = packet.activities.reduce((sum, item) => sum + item.hours, 0);
  const previewDocument = packet.documents.find((document) => document.id === previewId);
  const run = async (action: string, id: string, values?: Record<string, unknown>) => {
    setBusy(id); setFeedback("");
    try { await act(action, id, values); if (["resolve_exception", "correct_field"].includes(action)) setFeedback("Change recorded. Packet checks refreshed."); else onClose(); }
    catch (error) { setFeedback(error instanceof Error ? error.message : "Action failed."); }
    setBusy("");
  };
  return <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="packet-drawer" role="dialog" aria-modal="true" aria-label={`Review ${packet.label}`}>
      <div className="drawer-top"><button className="icon-button" onClick={onClose} aria-label="Close packet">×</button><div><span className="view-eyebrow">{packet.poNumber} · {packet.invoiceNumber ?? "Invoice missing"}</span><h2>{packet.label}</h2><p>{packet.placement ?? packet.employerName} · {shortDate(packet.periodStart)}–{shortDate(packet.periodEnd)}</p></div><StatusPill status={packet.status} /></div>
      <div className="drawer-scroll">
        <section className="packet-funding-impact"><div><span>Balance before</span><strong>{money(balanceBefore)}</strong></div><i>−</i><div><span>This invoice</span><strong>{packet.invoiceAmount ? money(packet.invoiceAmount) : "Waiting"}</strong></div><i>=</i><div className="after"><span>Current available</span><strong>{money(employer.available)}</strong></div></section>
        {activeInvoice && !["paid"].includes(packet.status) && <section className="release-commitment"><label><span>Correction, rejection, or withdrawal</span><input value={releaseReason} onChange={(event) => setReleaseReason(event.target.value)} placeholder="Reason for releasing this invoice commitment" /></label><button className="secondary-action" disabled={!releaseReason || Boolean(busy)} onClick={() => run("void_invoice", packet.id, { reason: releaseReason })}>Release committed funding</button></section>}

        {packet.exceptions.filter((item) => item.status === "open").length > 0 && <section className="drawer-section"><div className="drawer-section-title"><span className="section-kicker">Exceptions</span><h3>What must be resolved</h3></div><div className="exception-list">{packet.exceptions.filter((item) => item.status === "open").map((item) => <article key={item.id} className={`exception-card severity-${item.severity}`}><span className="exception-priority">P{item.severity}</span><div><strong>{item.title}</strong><p>{item.detail}</p><small>Owner · {item.ownerRole}</small></div>{item.severity === 1 ? <span className="evidence-required">Evidence required</span> : <button disabled={busy === item.id} onClick={() => { const reason = window.prompt("Document the authorized override or resolution reason. This is retained in the audit history."); if (reason?.trim()) run("resolve_exception", item.id, { reason }); }}>{busy === item.id ? "Saving…" : "Resolve with reason"}</button>}</article>)}</div></section>}

        <section className="drawer-section"><div className="drawer-section-title"><span className="section-kicker">Reconciliation</span><h3>Invoice to evidence</h3></div><div className="reconciliation-grid"><div><span>Wages invoiced</span><strong>{money(packet.wageAmount)}</strong><small>{totalHours ? `${totalHours.toLocaleString()} hours × ${money(hourlyRate, true)}` : "Hours not available"}</small></div><div><span>Business expenses</span><strong>{money(packet.businessAmount)}</strong><small>{packet.documents.filter((doc) => doc.kind === "business_expense").length} supporting record(s)</small></div><div className="recon-total"><span>Invoice total</span><strong>{money(packet.invoiceAmount)}</strong><small>{packet.wageAmount + packet.businessAmount === packet.invoiceAmount ? "Totals reconcile" : "Difference requires review"}</small></div></div></section>

        {packet.activities.length > 0 && <section className="drawer-section"><div className="drawer-section-title"><span className="section-kicker">Time allocation</span><h3>What the intern worked on</h3></div><div className="activity-total"><strong>{totalHours.toLocaleString()}</strong><span>documented hours</span></div><div className="activity-bar">{packet.activities.map((item) => <i key={item.id} style={{ width: `${(item.hours / totalHours) * 100}%`, background: activityColors[item.category] ?? "var(--muted)" }} title={`${item.category}: ${item.hours} hours`} />)}</div><div className="activity-legend">{packet.activities.map((item) => <span key={item.id}><i style={{ background: activityColors[item.category] ?? "var(--muted)" }} /><b>{item.category}</b><small>{item.hours}h · {Math.round((item.hours / totalHours) * 100)}%</small></span>)}</div></section>}

        <section className="drawer-section"><div className="drawer-section-title"><span className="section-kicker">Supporting documents</span><h3>Source evidence</h3></div>{previewDocument && <div className="source-preview"><header><strong>{previewDocument.fileName}</strong><span>Protected original · extracted fields remain below</span><button onClick={() => setPreviewId("")} aria-label="Close source preview">×</button></header><iframe title={`Original ${previewDocument.fileName}`} src={`/api/files?id=${encodeURIComponent(previewDocument.id)}`} /></div>}<div className="document-list">{packet.documents.length ? packet.documents.map((doc) => <div key={doc.id} className="document-record"><article><span className="file-icon">{doc.fileName.split(".").pop()?.slice(0, 3).toUpperCase()}</span><div><strong>{doc.fileName}</strong><small>{titleCase(doc.kind)} · Added {shortDate(doc.uploadedAt)}</small></div><StatusPill status={doc.status} />{doc.hasOriginal ? <span className="document-open-actions"><button onClick={() => setPreviewId(doc.id)}>Preview</button><a href={`/api/files?id=${encodeURIComponent(doc.id)}`} target="_blank" rel="noreferrer" aria-label={`Open ${doc.fileName} in a new tab`}>Open</a></span> : <span />}</article><ExtractedEvidence document={doc} act={act} /><DocumentPacketLink document={doc} packets={employerPackets.filter((item) => item.id !== packet.id)} act={act} /></div>) : <EmptyMessage title="No supporting documents" body="Add the invoice and required evidence to begin review." />}</div></section>

        <section className="drawer-section evidence-rules"><div className="drawer-section-title"><span className="section-kicker">Eligibility evidence</span><h3>Claim-by-claim rule checks</h3></div>{packet.claims.filter((claim) => claim.type === "business_expense").length ? packet.claims.filter((claim) => claim.type === "business_expense").map((claim) => <ClaimReview key={claim.id} claim={claim} documents={packet.documents} act={act} />) : <EmptyMessage title="No extracted business-expense claims" body="Expense lines appear here after invoice extraction." />}</section>
        <section className="drawer-section"><div className="drawer-section-title"><span className="section-kicker">Audit history</span><h3>Material actions</h3></div>{packet.history.length ? <div className="history-list">{packet.history.map((event) => <div key={event.id}><span>{shortDate(event.occurredAt)}</span><strong>{titleCase(event.action)}</strong><small>{event.actor}{event.reason ? ` · ${event.reason}` : ""}</small></div>)}</div> : <EmptyMessage title="No recorded actions yet" body="Uploads, corrections, reminders, approvals, exports, and payments appear here." />}</section>
      </div>
      <footer className="drawer-actions"><div>{feedback ? <span className={feedback.includes("recorded") || feedback.includes("refreshed") ? "good-feedback" : "bad-feedback"}>{feedback}</span> : <><span>{openBlockers.length ? `${openBlockers.length} payment blocker${openBlockers.length > 1 ? "s" : ""}` : packet.status === "ready_for_approval" ? "All checks complete" : "Human review still required"}</span><small>Human approval is recorded in the audit trail.</small></>}</div><div className="drawer-action-buttons"><a className="secondary-action" href={`/api/export?packetId=${encodeURIComponent(packet.id)}`}>Export audit archive</a>{packet.status === "approved" ? <button className="primary-action" disabled={Boolean(busy)} onClick={() => run("mark_paid", packet.id)}>Mark paid</button> : packet.status === "paid" ? <button className="primary-action" disabled={Boolean(busy)} onClick={() => run("archive_packet", packet.id)}>Archive for retention</button> : packet.status !== "archived" && packet.status !== "retention_deleted" && packet.invoiceAmount > 0 ? <button className="primary-action" disabled={packet.status !== "ready_for_approval" || Boolean(busy)} onClick={() => run("approve_packet", packet.id)}>{busy ? "Approving…" : packet.status === "ready_for_approval" ? "Approve reimbursement" : "Complete review first"}</button> : null}</div></footer>
    </aside>
  </div>;
}

function ReminderModal({ reminder, onClose, act }: { reminder: ReminderDraft; onClose: () => void; act: Operate }) {
  const [body, setBody] = useState(reminder.body);
  const [copied, setCopied] = useState(false);
  const review = async () => { await act("review_reminder", reminder.id, { body }); onClose(); };
  const copy = async () => { await navigator.clipboard.writeText(`Subject: ${reminder.subject}\n\n${body}`); await act("copy_reminder", reminder.id, { body }); setCopied(true); };
  const discard = async () => { await act("discard_reminder", reminder.id); onClose(); };
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="reminder-modal" role="dialog" aria-modal="true"><button className="icon-button" onClick={onClose}>×</button><span className="view-eyebrow">Draft only · nothing sends automatically</span><h2>{reminder.employerName}</h2><p>{reminder.recipientRole}{reminder.recipientName ? ` · ${reminder.recipientName}` : ""}</p><label><span>To</span><input value={reminder.contactEmail} readOnly /></label><label><span>Subject</span><input value={reminder.subject} readOnly /></label><label><span>Message</span><textarea value={body} onChange={(event) => setBody(event.target.value)} rows={10} /></label><footer><span>{reminder.status === "reviewed" ? "Reviewed draft" : "Review before copying to email"}</span><div><button className="danger-action" onClick={discard}>Discard</button><button className="secondary-action" onClick={copy}>{copied ? "Copied" : "Copy email"}</button>{reminder.status !== "reviewed" && <button className="primary-action" onClick={review}>Mark reviewed</button>}</div></footer></div></div>;
}

export default function LandAndEarnApp() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("desk");
  const [packet, setPacket] = useState<PacketSummary | null>(null);
  const [employer, setEmployer] = useState<EmployerSummary | null>(null);
  const [reminder, setReminder] = useState<ReminderDraft | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    const result = await response.json() as DashboardData & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "The reimbursement desk could not open.");
    setData(result); setError("");
    return result;
  }, []);

  // The dashboard is hydrated from the durable D1-backed API after the client mounts.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load().catch((reason) => setError(reason instanceof Error ? reason.message : "The reimbursement desk could not open.")); }, [load]);

  const operation = useCallback(async (action: string, id?: string, values: Record<string, unknown> = {}) => {
    if (data && !data.session.canManage) throw new Error("Fiscal reviewer access is read-only. A program manager must perform this action.");
    const response = await fetch("/api/operations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, id, ...values }) });
    const result = await response.json() as Record<string, unknown> & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "The change could not be saved.");
    const next = await load();
    setPacket((current) => current ? (next.packets.find((item) => item.id === current.id) ?? null) : null);
    setEmployer((current) => current ? (next.employers.find((item) => item.id === current.id) ?? null) : null);
    setReminder((current) => current ? (next.reminders.find((item) => item.id === current.id) ?? null) : null);
    return result;
  }, [data, load]);

  const selectedEmployer = useMemo(() => packet && data ? data.employers.find((item) => item.id === packet.employerId) ?? null : null, [packet, data]);
  const chooseEmployer = (item: EmployerSummary) => { setEmployer(item); setView("employers"); };
  const go = (next: View) => { setView(next); setMobileMenu(false); if (next !== "employers") setEmployer(null); };

  if (!data && !error) return <LoadingDesk />;
  if (error || !data) return <div className="fatal-state"><div className="brand-seal">LE</div><h1>The desk could not open.</h1><p>{error}</p><button className="primary-action" onClick={() => load().catch((reason) => setError(String(reason)))}>Try again</button></div>;

  const openBlockers = data.packets.flatMap((item) => item.exceptions).filter((item) => item.status === "open" && item.severity === 1).length;
  const receivedPercent = data.packets.length ? Math.round((data.packets.filter((item) => Boolean(item.receivedAt)).length / data.packets.length) * 100) : 0;
  const initials = data.session.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "LE";
  return <div className={`app-shell ${data.session.canManage ? "" : "read-only-session"}`}>
    <aside className="sidebar">
      <div className="brand"><span className="brand-seal">LE</span><div><strong>Land & Earn</strong><small>Grant operations</small></div></div>
      <nav aria-label="Primary navigation">{navItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => go(item.id)}><span>{item.mark}</span>{item.label}{item.id === "packets" && openBlockers > 0 && <b>{openBlockers}</b>}</button>)}</nav>
      <div className="sidebar-closeout"><span>FY{data.settings.fiscalYearEnd.slice(2, 4)} closeout</span><strong>{shortDate(data.settings.invoiceDeadline)}</strong><div><i style={{ width: `${receivedPercent}%` }} /></div><small>{receivedPercent}% of packet invoices received</small></div>
      <div className="sidebar-user"><span>{initials}</span><div><strong>{data.session.name}</strong><small>{data.session.role === "program_manager" ? "Program manager" : "Fiscal reviewer · read only"}</small></div></div>
    </aside>
    <main className="main-content">
      <div className="mobile-topbar"><button aria-label="Open navigation" onClick={() => setMobileMenu(true)}>☰</button><strong>Land & Earn</strong><button aria-label="Add documents" onClick={() => go("intake")}>＋</button></div>
      {!data.session.canManage && <div className="access-banner" role="status"><strong>Fiscal review mode</strong><span>You can inspect records, open originals, search, and export packets. Changes require a program manager.</span></div>}
      {view === "desk" && <DeskView data={data} onPacket={setPacket} onEmployer={chooseEmployer} onReminder={setReminder} go={go} />}
      {view === "packets" && <PacketsView data={data} onPacket={setPacket} operate={operation} />}
      {view === "employers" && <EmployerView data={data} selected={employer} onSelect={setEmployer} onPacket={setPacket} operate={operation} />}
      {view === "intake" && <IntakeView data={data} onUploaded={load} operate={operation} />}
      {view === "rules" && <RulesView data={data} onIntake={() => go("intake")} operate={operation} />}
      {view === "reminders" && <RemindersView data={data} onOpen={setReminder} operate={operation} />}
      {view === "setup" && <SetupView data={data} operate={operation} />}
    </main>
    {mobileMenu && <div className="mobile-menu-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileMenu(false); }}><nav className="mobile-menu" aria-label="Mobile navigation"><div><span className="brand-seal">LE</span><strong>Land & Earn</strong><button className="icon-button" onClick={() => setMobileMenu(false)}>×</button></div>{navItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => go(item.id)}><span>{item.mark}</span>{item.label}</button>)}</nav></div>}
    {packet && selectedEmployer && <PacketDrawer packet={packet} employer={selectedEmployer} employerPackets={data.packets.filter((item) => item.employerId === selectedEmployer.id)} hourlyRate={data.hourlyRate} onClose={() => setPacket(null)} act={operation} />}
    {reminder && <ReminderModal reminder={reminder} onClose={() => setReminder(null)} act={operation} />}
  </div>;
}
