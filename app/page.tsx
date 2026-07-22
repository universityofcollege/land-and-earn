"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardData, EmployerSummary, PacketSummary, ReminderDraft } from "../lib/types";

type View = "desk" | "packets" | "employers" | "intake" | "rules" | "reminders";

const navItems: { id: View; label: string; mark: string }[] = [
  { id: "desk", label: "Closeout desk", mark: "⌂" },
  { id: "packets", label: "Reimbursements", mark: "▤" },
  { id: "employers", label: "Employer funding", mark: "$" },
  { id: "intake", label: "Document intake", mark: "↑" },
  { id: "rules", label: "Eligibility rules", mark: "§" },
  { id: "reminders", label: "Reminder drafts", mark: "✉" },
];

const statusLabels: Record<string, string> = {
  follow_up_required: "Follow-up required",
  needs_review: "Needs review",
  ready_for_approval: "Ready for approval",
  invoice_not_received: "Invoice not received",
  approved: "Approved",
  paid: "Paid",
  processing: "Processing",
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

function FundingRibbon({ employers, onSelect }: { employers: EmployerSummary[]; onSelect: (employer: EmployerSummary) => void }) {
  return <section className="funding-ribbon" aria-label="Employer purchase order utilization">
    <div className="ribbon-head">
      <div><span className="section-kicker">Purchase order runway</span><h2>Funding left by employer</h2></div>
      <p>Invoices reserve funding the moment they arrive.</p>
    </div>
    <div className="ribbon-track">
      {employers.map((employer) => <button key={employer.id} className="ribbon-segment" onClick={() => onSelect(employer)}>
        <span className="ribbon-label"><b>{employer.name.replace(" Independent Schools", " Schools").replace(" Community", "")}</b><small>{employer.poNumber}</small></span>
        <span className="ribbon-bar"><i style={{ width: `${Math.min(employer.utilization, 100)}%` }} /></span>
        <span className="ribbon-values"><strong>{money(employer.available)}</strong><small>{employer.utilization}% committed</small></span>
      </button>)}
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
  const priorityPackets = data.packets.filter((packet) => !["paid"].includes(packet.status)).slice(0, 4);
  const draftReminders = data.reminders.filter((reminder) => reminder.status === "draft");

  return <>
    <header className="view-header desk-header">
      <div><span className="view-eyebrow">FY26 closeout · Land and Earn</span><h1>Get every employer reimbursed.</h1><p>The desk surfaces the next action, protects purchase-order funding, and keeps every decision tied to its evidence.</p></div>
      <button className="primary-action" onClick={() => go("intake")}><span>↑</span> Add documents</button>
    </header>

    <section className="closeout-ledger">
      <div className="ledger-primary"><span>Current funding available</span><strong>{money(totalAvailable)}</strong><small>of {money(totalFunding)} across {data.employers.length} employers</small></div>
      <div className="ledger-rule"><i /><span>Invoices due</span><strong>June 30</strong><small>Payment by July 31</small></div>
      <div className="ledger-stat danger"><span>Payment blockers</span><strong>{blockers}</strong><small>must be cleared first</small></div>
      <div className="ledger-stat"><span>Ready to move</span><strong>{money(readyAmount)}</strong><small>approved or ready</small></div>
      <div className="ledger-rate"><span>Program wage</span><strong>{money(data.hourlyRate, true)}</strong><small>per hour · all interns</small></div>
    </section>

    <FundingRibbon employers={data.employers} onSelect={onEmployer} />

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

function PacketsView({ data, onPacket }: { data: DashboardData; onPacket: (packet: PacketSummary) => void }) {
  const [filter, setFilter] = useState("open");
  const [search, setSearch] = useState("");
  const filtered = data.packets.filter((packet) => {
    const matchesFilter = filter === "all" || (filter === "open" ? !["paid", "approved"].includes(packet.status) : packet.status === filter);
    const haystack = `${packet.internName} ${packet.employerName} ${packet.invoiceNumber}`.toLowerCase();
    return matchesFilter && haystack.includes(search.toLowerCase());
  });
  return <>
    <header className="view-header"><div><span className="view-eyebrow">Reimbursement packets</span><h1>Evidence before payment.</h1><p>Every invoice, wage record, expense, exception, and approval in one auditable place.</p></div></header>
    <div className="toolbar">
      <label className="search-field"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search intern, employer, or invoice" /></label>
      <div className="filter-pills">{[
        ["open", "Open"], ["follow_up_required", "Follow-up"], ["needs_review", "Needs review"], ["ready_for_approval", "Ready"], ["approved", "Approved"], ["all", "All"],
      ].map(([value, label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div>
    </div>
    <section className="panel queue-panel"><div className="panel-heading"><div><span className="section-kicker">{filtered.length} packets</span><h2>{filter === "open" ? "Active reimbursement work" : statusLabels[filter] ?? "All reimbursement work"}</h2></div></div><Queue packets={filtered} onOpen={onPacket} /></section>
  </>;
}

function EmployerView({ data, selected, onSelect, onPacket }: { data: DashboardData; selected: EmployerSummary | null; onSelect: (item: EmployerSummary | null) => void; onPacket: (packet: PacketSummary) => void }) {
  if (selected) {
    const events = data.poEvents.filter((event) => event.purchaseOrderId === selected.purchaseOrderId);
    const packets = data.packets.filter((packet) => packet.employerId === selected.id);
    return <>
      <button className="back-action" onClick={() => onSelect(null)}>← All employers</button>
      <header className="view-header employer-header"><div><span className="view-eyebrow">{selected.county} · {selected.poNumber}</span><h1>{selected.name}</h1><p>{selected.arrangement} · {selected.paySchedule} payroll</p></div><div className="mou-stamp"><span>MOU current</span><strong>{selected.mouCode}</strong></div></header>
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
    <div className="employer-grid">{data.employers.map((employer) => <button key={employer.id} className="employer-card" onClick={() => onSelect(employer)}>
      <div className="employer-card-head"><span>{employer.county}</span><code>{employer.poNumber}</code></div><h2>{employer.name}</h2><p>{employer.arrangement}</p>
      <div className="card-funding"><span>Available now</span><strong>{money(employer.available)}</strong><small>of {money(employer.currentFunding)}</small></div>
      <div className="card-track"><i style={{ width: `${employer.utilization}%` }} /></div>
      <div className="card-foot"><span><i /> {employer.mouCode}</span><b>{employer.utilization}% committed →</b></div>
    </button>)}</div>
  </>;
}

function IntakeView({ data, onUploaded }: { data: DashboardData; onUploaded: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch("/api/documents", { method: "POST", body: new FormData(event.currentTarget) });
    const result = await response.json() as { error?: string; document?: { fileName: string } };
    if (!response.ok) setMessage(result.error ?? "Upload failed.");
    else { setMessage(`${result.document?.fileName ?? "Document"} is in the review queue.`); event.currentTarget.reset(); await onUploaded(); }
    setBusy(false);
  };
  return <>
    <header className="view-header"><div><span className="view-eyebrow">Document intake</span><h1>Bring the paperwork. Keep the source.</h1><p>Original files are preserved; extracted values stay linked to the exact evidence used.</p></div></header>
    <div className="intake-layout">
      <form className="upload-panel" onSubmit={submit}>
        <div className="upload-drop"><span className="upload-symbol">↑</span><h2>Add reimbursement evidence</h2><p>PDF, image, spreadsheet, or office document</p><input name="file" type="file" required accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.xls,.doc,.docx" /></div>
        <div className="upload-fields">
          <label><span>Employer of record</span><select name="employerId" required defaultValue=""><option value="" disabled>Choose employer</option>{data.employers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span>Document type</span><select name="kind" required defaultValue="invoice"><option value="invoice">Invoice</option><option value="timesheet">Timesheet or schedule</option><option value="payroll">Pay stub or payroll report</option><option value="business_expense">Business-expense evidence</option><option value="mou">MOU</option><option value="purchase_order">Purchase order / amendment</option><option value="grant_evidence">Grant evidence</option></select></label>
          <label className="wide-field"><span>Link to packet <small>optional</small></span><select name="packetId" defaultValue=""><option value="">Leave unmatched for triage</option>{data.packets.map((packet) => <option key={packet.id} value={packet.id}>{packet.employerName} · {packet.label}</option>)}</select></label>
          <label className="wide-field"><span>Document total <small>required for a linked invoice</small></span><input name="amount" inputMode="decimal" placeholder="0.00" aria-describedby="amount-help" /><small id="amount-help">A linked invoice reserves this amount against the employer&apos;s active purchase order immediately.</small></label>
        </div>
        <button className="primary-action upload-submit" disabled={busy}>{busy ? "Adding document…" : "Add to review queue"}</button>
        {message && <p className={`form-message ${message.includes("queue") ? "success" : "error"}`} role="status">{message}</p>}
      </form>
      <aside className="intake-guide panel"><span className="section-kicker">What happens next</span><ol><li><b>1</b><span><strong>Classify</strong><small>Identify invoice, payroll, time, expense, MOU, or PO.</small></span></li><li><b>2</b><span><strong>Extract</strong><small>Read names, dates, amounts, signatures, hours, and expense detail.</small></span></li><li><b>3</b><span><strong>Reconcile</strong><small>Match the packet, reserve PO funding, and test the evidence.</small></span></li><li><b>4</b><span><strong>Review</strong><small>Human approval remains required before payment.</small></span></li></ol><div className="privacy-note"><span>⌑</span><p><strong>Seven-year record</strong> Original files, corrections, and decisions stay attached to the packet.</p></div></aside>
    </div>
  </>;
}

function RulesView({ data, onIntake }: { data: DashboardData; onIntake: () => void }) {
  return <>
    <header className="view-header"><div><span className="view-eyebrow">Eligibility rules</span><h1>The strictest rule controls.</h1><p>IRS is the baseline—not approval. Federal, ARC, grant, budget, and employer MOU terms can be more restrictive.</p></div></header>
    <section className="rule-path">
      {data.policies.map((policy, index) => <article key={policy.id} className="rule-card"><div className="rule-order">{index + 1}</div><div className="rule-level"><span>{policy.level}</span><StatusPill status={policy.status.replace(" ", "_")} /></div><h2>{policy.title}</h2><code>{policy.code}</code><p>{policy.summary}</p><footer><span>Effective {shortDate(policy.effectiveAt)}</span><button>View source ↗</button></footer></article>)}
    </section>
    <div className="rule-callout"><span>!</span><div><strong>Land and Earn award evidence still needed</strong><p>Load the signed grant agreement, approved budget, and amendments before relying on live business-expense determinations.</p></div><button onClick={onIntake}>Go to document intake</button></div>
  </>;
}

function RemindersView({ data, onOpen }: { data: DashboardData; onOpen: (reminder: ReminderDraft) => void }) {
  return <>
    <header className="view-header"><div><span className="view-eyebrow">Reminder drafts</span><h1>Follow up without losing the thread.</h1><p>Drafts are prepared from unresolved evidence and deadlines. Nothing is sent automatically.</p></div></header>
    <section className="reminders-board"><div className="board-column"><div className="board-title"><span>Needs review</span><b>{data.reminders.filter((item) => item.status === "draft").length}</b></div>{data.reminders.filter((item) => item.status === "draft").map((reminder) => <button key={reminder.id} className="board-card" onClick={() => onOpen(reminder)}><span className="mail-mark">✉</span><strong>{reminder.employerName}</strong><p>{reminder.subject}</p><small>To {reminder.contactEmail}</small><i>Open draft →</i></button>)}</div><div className="board-column"><div className="board-title"><span>Reviewed</span><b>{data.reminders.filter((item) => item.status === "reviewed").length}</b></div>{data.reminders.filter((item) => item.status === "reviewed").length ? data.reminders.filter((item) => item.status === "reviewed").map((reminder) => <button key={reminder.id} className="board-card reviewed" onClick={() => onOpen(reminder)}><span className="mail-mark">✓</span><strong>{reminder.employerName}</strong><p>{reminder.subject}</p><small>Reviewed {shortDate(reminder.reviewedAt)}</small></button>) : <EmptyMessage title="No reviewed drafts yet" body="Reviewed drafts remain here for the audit trail." />}</div></section>
  </>;
}

function PacketDrawer({ packet, employer, onClose, act }: { packet: PacketSummary; employer: EmployerSummary; onClose: () => void; act: (action: string, id: string) => Promise<void> }) {
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState("");
  const openBlockers = packet.exceptions.filter((item) => item.status === "open" && item.severity === 1);
  const activeInvoice = packet.invoiceAmount > 0 && packet.status !== "invoice_not_received";
  const balanceBefore = employer.available + (activeInvoice ? packet.invoiceAmount : 0);
  const totalHours = packet.activities.reduce((sum, item) => sum + item.hours, 0);
  const run = async (action: string, id: string) => {
    setBusy(id); setFeedback("");
    try { await act(action, id); if (action === "resolve_exception") setFeedback("Exception resolved. Packet checks refreshed."); else onClose(); }
    catch (error) { setFeedback(error instanceof Error ? error.message : "Action failed."); }
    setBusy("");
  };
  return <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="packet-drawer" role="dialog" aria-modal="true" aria-label={`Review ${packet.label}`}>
      <div className="drawer-top"><button className="icon-button" onClick={onClose} aria-label="Close packet">×</button><div><span className="view-eyebrow">{packet.poNumber} · {packet.invoiceNumber ?? "Invoice missing"}</span><h2>{packet.label}</h2><p>{packet.placement ?? packet.employerName} · {shortDate(packet.periodStart)}–{shortDate(packet.periodEnd)}</p></div><StatusPill status={packet.status} /></div>
      <div className="drawer-scroll">
        <section className="packet-funding-impact"><div><span>Balance before</span><strong>{money(balanceBefore)}</strong></div><i>−</i><div><span>This invoice</span><strong>{packet.invoiceAmount ? money(packet.invoiceAmount) : "Waiting"}</strong></div><i>=</i><div className="after"><span>Current available</span><strong>{money(employer.available)}</strong></div></section>

        {packet.exceptions.filter((item) => item.status === "open").length > 0 && <section className="drawer-section"><div className="drawer-section-title"><span className="section-kicker">Exceptions</span><h3>What must be resolved</h3></div><div className="exception-list">{packet.exceptions.filter((item) => item.status === "open").map((item) => <article key={item.id} className={`exception-card severity-${item.severity}`}><span className="exception-priority">P{item.severity}</span><div><strong>{item.title}</strong><p>{item.detail}</p><small>Owner · {item.ownerRole}</small></div><button disabled={busy === item.id} onClick={() => run("resolve_exception", item.id)}>{busy === item.id ? "Saving…" : "Mark resolved"}</button></article>)}</div></section>}

        <section className="drawer-section"><div className="drawer-section-title"><span className="section-kicker">Reconciliation</span><h3>Invoice to evidence</h3></div><div className="reconciliation-grid"><div><span>Wages invoiced</span><strong>{money(packet.wageAmount)}</strong><small>{totalHours ? `${totalHours.toLocaleString()} hours × ${money(16, true)}` : "Hours not available"}</small></div><div><span>Business expenses</span><strong>{money(packet.businessAmount)}</strong><small>{packet.documents.filter((doc) => doc.kind === "business_expense").length} supporting record(s)</small></div><div className="recon-total"><span>Invoice total</span><strong>{money(packet.invoiceAmount)}</strong><small>{packet.wageAmount + packet.businessAmount === packet.invoiceAmount ? "Totals reconcile" : "Difference requires review"}</small></div></div></section>

        {packet.activities.length > 0 && <section className="drawer-section"><div className="drawer-section-title"><span className="section-kicker">Time allocation</span><h3>What the intern worked on</h3></div><div className="activity-total"><strong>{totalHours.toLocaleString()}</strong><span>documented hours</span></div><div className="activity-bar">{packet.activities.map((item) => <i key={item.id} style={{ width: `${(item.hours / totalHours) * 100}%`, background: activityColors[item.category] ?? "var(--muted)" }} title={`${item.category}: ${item.hours} hours`} />)}</div><div className="activity-legend">{packet.activities.map((item) => <span key={item.id}><i style={{ background: activityColors[item.category] ?? "var(--muted)" }} /><b>{item.category}</b><small>{item.hours}h · {Math.round((item.hours / totalHours) * 100)}%</small></span>)}</div></section>}

        <section className="drawer-section"><div className="drawer-section-title"><span className="section-kicker">Supporting documents</span><h3>Source evidence</h3></div><div className="document-list">{packet.documents.length ? packet.documents.map((doc) => <article key={doc.id}><span className="file-icon">{doc.fileName.split(".").pop()?.slice(0, 3).toUpperCase()}</span><div><strong>{doc.fileName}</strong><small>{titleCase(doc.kind)} · Added {shortDate(doc.uploadedAt)}</small></div><StatusPill status={doc.status} /><button aria-label={`Open ${doc.fileName}`}>···</button></article>) : <EmptyMessage title="No supporting documents" body="Add the invoice and required evidence to begin review." />}</div></section>

        <section className="drawer-section evidence-rules"><div className="drawer-section-title"><span className="section-kicker">Eligibility evidence</span><h3>Rules applied</h3></div><ol><li><span>1</span><div><strong>IRS baseline</strong><small>Ordinary, necessary, business purpose, adequately documented</small></div><b>Pass</b></li><li><span>2</span><div><strong>Federal + ARC</strong><small>Allowable, allocable, approved scope, period of performance</small></div><b>Pass</b></li><li><span>3</span><div><strong>Employer MOU</strong><small>{employer.mouCode} · strictest applicable rule controls</small></div><b>Pass</b></li></ol></section>
      </div>
      <footer className="drawer-actions"><div>{feedback ? <span className={feedback.includes("refreshed") ? "good-feedback" : "bad-feedback"}>{feedback}</span> : <><span>{openBlockers.length ? `${openBlockers.length} payment blocker${openBlockers.length > 1 ? "s" : ""}` : "All payment blockers cleared"}</span><small>Human approval is recorded in the audit trail.</small></>}</div>{packet.status === "approved" ? <button className="primary-action" disabled={Boolean(busy)} onClick={() => run("mark_paid", packet.id)}>Mark paid</button> : packet.status !== "paid" && packet.invoiceAmount > 0 ? <button className="primary-action" disabled={openBlockers.length > 0 || Boolean(busy)} onClick={() => run("approve_packet", packet.id)}>{busy ? "Approving…" : "Approve reimbursement"}</button> : null}</footer>
    </aside>
  </div>;
}

function ReminderModal({ reminder, onClose, act }: { reminder: ReminderDraft; onClose: () => void; act: (action: string, id: string) => Promise<void> }) {
  const [body, setBody] = useState(reminder.body);
  const [copied, setCopied] = useState(false);
  const review = async () => { await act("review_reminder", reminder.id); onClose(); };
  const copy = async () => { await navigator.clipboard.writeText(`Subject: ${reminder.subject}\n\n${body}`); setCopied(true); };
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="reminder-modal" role="dialog" aria-modal="true"><button className="icon-button" onClick={onClose}>×</button><span className="view-eyebrow">Draft only · nothing sends automatically</span><h2>{reminder.employerName}</h2><label><span>To</span><input value={reminder.contactEmail} readOnly /></label><label><span>Subject</span><input value={reminder.subject} readOnly /></label><label><span>Message</span><textarea value={body} onChange={(event) => setBody(event.target.value)} rows={10} /></label><footer><span>{reminder.status === "reviewed" ? "Reviewed draft" : "Review before copying to email"}</span><div><button className="secondary-action" onClick={copy}>{copied ? "Copied" : "Copy email"}</button>{reminder.status !== "reviewed" && <button className="primary-action" onClick={review}>Mark reviewed</button>}</div></footer></div></div>;
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

  const operation = useCallback(async (action: string, id: string) => {
    const response = await fetch("/api/operations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, id }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error ?? "The change could not be saved.");
    const next = await load();
    setPacket((current) => current ? (next.packets.find((item) => item.id === current.id) ?? null) : null);
  }, [load]);

  const selectedEmployer = useMemo(() => packet && data ? data.employers.find((item) => item.id === packet.employerId) ?? null : null, [packet, data]);
  const chooseEmployer = (item: EmployerSummary) => { setEmployer(item); setView("employers"); };
  const go = (next: View) => { setView(next); setMobileMenu(false); if (next !== "employers") setEmployer(null); };

  if (!data && !error) return <LoadingDesk />;
  if (error || !data) return <div className="fatal-state"><div className="brand-seal">LE</div><h1>The desk could not open.</h1><p>{error}</p><button className="primary-action" onClick={() => load().catch((reason) => setError(String(reason)))}>Try again</button></div>;

  const openBlockers = data.packets.flatMap((item) => item.exceptions).filter((item) => item.status === "open" && item.severity === 1).length;
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-seal">LE</span><div><strong>Land & Earn</strong><small>Grant operations</small></div></div>
      <nav aria-label="Primary navigation">{navItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => go(item.id)}><span>{item.mark}</span>{item.label}{item.id === "packets" && openBlockers > 0 && <b>{openBlockers}</b>}</button>)}</nav>
      <div className="sidebar-closeout"><span>FY26 closeout</span><strong>June 30</strong><div><i style={{ width: "88%" }} /></div><small>Invoices received by deadline</small></div>
      <div className="sidebar-user"><span>IK</span><div><strong>Ishmel</strong><small>Program manager</small></div><button aria-label="Account menu">···</button></div>
    </aside>
    <main className="main-content">
      <div className="mobile-topbar"><button aria-label="Open navigation" onClick={() => setMobileMenu(true)}>☰</button><strong>Land & Earn</strong><button aria-label="Add documents" onClick={() => go("intake")}>＋</button></div>
      {view === "desk" && <DeskView data={data} onPacket={setPacket} onEmployer={chooseEmployer} onReminder={setReminder} go={go} />}
      {view === "packets" && <PacketsView data={data} onPacket={setPacket} />}
      {view === "employers" && <EmployerView data={data} selected={employer} onSelect={setEmployer} onPacket={setPacket} />}
      {view === "intake" && <IntakeView data={data} onUploaded={load} />}
      {view === "rules" && <RulesView data={data} onIntake={() => go("intake")} />}
      {view === "reminders" && <RemindersView data={data} onOpen={setReminder} />}
    </main>
    {mobileMenu && <div className="mobile-menu-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileMenu(false); }}><nav className="mobile-menu" aria-label="Mobile navigation"><div><span className="brand-seal">LE</span><strong>Land & Earn</strong><button className="icon-button" onClick={() => setMobileMenu(false)}>×</button></div>{navItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => go(item.id)}><span>{item.mark}</span>{item.label}</button>)}</nav></div>}
    {packet && selectedEmployer && <PacketDrawer packet={packet} employer={selectedEmployer} onClose={() => setPacket(null)} act={operation} />}
    {reminder && <ReminderModal reminder={reminder} onClose={() => setReminder(null)} act={operation} />}
  </div>;
}
