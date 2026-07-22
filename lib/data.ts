import { env } from "cloudflare:workers";
import type { DashboardData } from "./types";

type Db = D1Database;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS employers (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, county TEXT NOT NULL,
    contact_name TEXT NOT NULL, contact_email TEXT NOT NULL,
    arrangement TEXT NOT NULL, mou_code TEXT NOT NULL,
    mou_status TEXT NOT NULL DEFAULT 'current', pay_schedule TEXT NOT NULL DEFAULT 'Biweekly'
  )`,
  `CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY, employer_id TEXT NOT NULL REFERENCES employers(id),
    po_number TEXT NOT NULL UNIQUE, original_amount_cents INTEGER NOT NULL,
    amendment_amount_cents INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active',
    issued_at TEXT NOT NULL, effective_end TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS interns (
    id TEXT PRIMARY KEY, employer_id TEXT NOT NULL REFERENCES employers(id),
    name TEXT NOT NULL, county TEXT NOT NULL, placement TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS packets (
    id TEXT PRIMARY KEY, employer_id TEXT NOT NULL REFERENCES employers(id),
    purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id), intern_id TEXT REFERENCES interns(id),
    label TEXT NOT NULL, period_start TEXT NOT NULL, period_end TEXT NOT NULL,
    status TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 2, due_date TEXT NOT NULL,
    invoice_number TEXT, invoice_amount_cents INTEGER NOT NULL DEFAULT 0,
    wage_amount_cents INTEGER NOT NULL DEFAULT 0, business_amount_cents INTEGER NOT NULL DEFAULT 0,
    confidence INTEGER NOT NULL DEFAULT 0, received_at TEXT, approved_at TEXT, paid_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY, employer_id TEXT NOT NULL REFERENCES employers(id),
    packet_id TEXT REFERENCES packets(id), kind TEXT NOT NULL, file_name TEXT NOT NULL,
    r2_key TEXT, status TEXT NOT NULL, amount_cents INTEGER,
    period_start TEXT, period_end TEXT, extracted_json TEXT NOT NULL DEFAULT '{}', uploaded_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS packet_exceptions (
    id TEXT PRIMARY KEY, packet_id TEXT NOT NULL REFERENCES packets(id), severity INTEGER NOT NULL,
    title TEXT NOT NULL, detail TEXT NOT NULL, owner_role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, resolved_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS activity_hours (
    id TEXT PRIMARY KEY, packet_id TEXT NOT NULL REFERENCES packets(id),
    category TEXT NOT NULL, hours REAL NOT NULL, source TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS reminder_drafts (
    id TEXT PRIMARY KEY, employer_id TEXT NOT NULL REFERENCES employers(id),
    packet_id TEXT REFERENCES packets(id), subject TEXT NOT NULL, body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL, reviewed_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS po_events (
    id TEXT PRIMARY KEY, purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id),
    packet_id TEXT REFERENCES packets(id), event_type TEXT NOT NULL,
    amount_cents INTEGER NOT NULL, reference TEXT NOT NULL, occurred_at TEXT NOT NULL, actor TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS policies (
    id TEXT PRIMARY KEY, level TEXT NOT NULL, title TEXT NOT NULL,
    code TEXT NOT NULL, status TEXT NOT NULL, summary TEXT NOT NULL, effective_at TEXT NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS purchase_orders_employer_idx ON purchase_orders(employer_id)",
  "CREATE INDEX IF NOT EXISTS packets_employer_idx ON packets(employer_id)",
  "CREATE INDEX IF NOT EXISTS documents_packet_idx ON documents(packet_id)",
  "CREATE INDEX IF NOT EXISTS packet_exceptions_packet_idx ON packet_exceptions(packet_id)",
  "CREATE INDEX IF NOT EXISTS po_events_po_idx ON po_events(purchase_order_id)",
];

function database() {
  if (!env.DB) throw new Error("The Land and Earn database is not connected.");
  return env.DB;
}

async function rows<T>(db: Db, sql: string, values: unknown[] = []) {
  const result = await db.prepare(sql).bind(...values).all<T>();
  return result.results;
}

export async function ensureDatabase() {
  const db = database();
  await db.batch(schemaStatements.map((sql) => db.prepare(sql)));
  const existing = await db.prepare("SELECT COUNT(*) AS count FROM employers").first<{ count: number }>();
  if (!existing?.count) await seedDatabase(db);
  return db;
}

async function seedDatabase(db: Db) {
  const statements: D1PreparedStatement[] = [];
  const add = (sql: string, ...values: unknown[]) => statements.push(db.prepare(sql).bind(...values));

  const employers = [
    ["emp-pineville", "Pineville Independent Schools", "Bell County", "Morgan Lewis", "morgan@pineville.example", "Employer of record and placement", "MOU-LAE-2026-01", "current", "Biweekly"],
    ["emp-bell", "Bell County Fiscal Court", "Bell County", "Tasha Mills", "tasha@bellcounty.example", "Employer of record; separate placements", "MOU-LAE-2026-02", "current", "Biweekly"],
    ["emp-cumberland", "Cumberland Hope Community", "Knox County", "Elena Brooks", "elena@cumberlandhope.example", "Employer of record and placement", "MOU-LAE-2026-03", "current", "Semimonthly"],
    ["emp-redbird", "Red Bird Mission", "Clay County", "Jonah Fields", "jonah@redbird.example", "Employer of record and placement", "MOU-LAE-2026-04", "current", "Biweekly"],
  ];
  for (const employer of employers) add("INSERT INTO employers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", ...employer);

  const pos = [
    ["po-pineville", "emp-pineville", "PO-26-1048", 18500000, 1500000, "active", "2025-07-01", "2026-07-31"],
    ["po-bell", "emp-bell", "PO-26-1102", 14500000, 0, "active", "2025-07-01", "2026-07-31"],
    ["po-cumberland", "emp-cumberland", "PO-26-1139", 9800000, 0, "active", "2025-07-01", "2026-07-31"],
    ["po-redbird", "emp-redbird", "PO-26-1177", 12600000, 1000000, "active", "2025-07-01", "2026-07-31"],
  ];
  for (const po of pos) add("INSERT INTO purchase_orders VALUES (?, ?, ?, ?, ?, ?, ?, ?)", ...po);

  const interns = [
    ["int-ava", "emp-pineville", "Ava Collins", "Bell County", "Pineville Family Resource Center"],
    ["int-marcus", "emp-bell", "Marcus Hale", "Bell County", "Bell County Tourism"],
    ["int-nia", "emp-cumberland", "Nia Turner", "Knox County", "Cumberland Hope Community"],
    ["int-eli", "emp-redbird", "Eli Baker", "Clay County", "Red Bird Mission Craft Store"],
    ["int-jada", "emp-pineville", "Jada Webb", "Knox County", "Pineville Summer Feeding Program"],
  ];
  for (const intern of interns) add("INSERT INTO interns VALUES (?, ?, ?, ?, ?)", ...intern);

  const packets = [
    ["pkt-104", "emp-pineville", "po-pineville", "int-ava", "June reimbursement · Ava Collins", "2026-06-01", "2026-06-14", "follow_up_required", 1, "2026-06-30", "INV-0626-14", 1876000, 1696000, 180000, 91, "2026-06-18", null, null],
    ["pkt-105", "emp-bell", "po-bell", "int-marcus", "June reimbursement · Marcus Hale", "2026-06-01", "2026-06-14", "needs_review", 1, "2026-06-30", "BC-4481", 1224000, 1216000, 8000, 78, "2026-06-20", null, null],
    ["pkt-106", "emp-cumberland", "po-cumberland", "int-nia", "June reimbursement · Nia Turner", "2026-06-01", "2026-06-15", "ready_for_approval", 2, "2026-06-30", "CHC-2026-19", 1008000, 960000, 48000, 96, "2026-06-21", null, null],
    ["pkt-107", "emp-redbird", "po-redbird", "int-eli", "June reimbursement · Eli Baker", "2026-06-01", "2026-06-14", "invoice_not_received", 2, "2026-06-30", null, 0, 0, 0, 0, null, null, null],
    ["pkt-098", "emp-pineville", "po-pineville", "int-jada", "May reimbursement · Jada Webb", "2026-05-16", "2026-05-31", "paid", 3, "2026-06-30", "INV-0526-09", 1624000, 1536000, 88000, 98, "2026-06-05", "2026-06-09", "2026-06-13"],
    ["pkt-099", "emp-bell", "po-bell", "int-marcus", "May reimbursement · Marcus Hale", "2026-05-16", "2026-05-31", "approved", 3, "2026-06-30", "BC-4418", 1440000, 1408000, 32000, 97, "2026-06-04", "2026-06-10", null],
  ];
  for (const packet of packets) add("INSERT INTO packets VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ...packet);

  const docs = [
    ["doc-104-inv", "emp-pineville", "pkt-104", "invoice", "Pineville_INV-0626-14.pdf", null, "needs_correction", 1876000, "2026-06-01", "2026-06-14", JSON.stringify({ invoiceNumber: "INV-0626-14", address: "104 S Walnut St", authorizedSignature: false }), "2026-06-18T13:40:00Z"],
    ["doc-104-pay", "emp-pineville", "pkt-104", "payroll", "Payroll_register_0614.pdf", null, "verified", 1696000, "2026-06-01", "2026-06-14", JSON.stringify({ paidHours: 1060, hourlyRate: 16, grossPay: 16960 }), "2026-06-18T13:41:00Z"],
    ["doc-104-time", "emp-pineville", "pkt-104", "timesheet", "Ava_Collins_timesheet.xlsx", null, "verified", null, "2026-06-01", "2026-06-14", JSON.stringify({ totalHours: 1060, internSigned: true, supervisorSigned: true }), "2026-06-18T13:41:30Z"],
    ["doc-104-exp", "emp-pineville", "pkt-104", "business_expense", "Uniforms_and_badges_receipt.pdf", null, "verified", 180000, "2026-06-01", "2026-06-14", JSON.stringify({ category: "Required work apparel", mouProvision: "4.2(c)", eligible: true }), "2026-06-18T13:42:00Z"],
    ["doc-105-inv", "emp-bell", "pkt-105", "invoice", "Bell_County_BC-4481.pdf", null, "verified", 1224000, "2026-06-01", "2026-06-14", JSON.stringify({ invoiceNumber: "BC-4481", authorizedSignature: true }), "2026-06-20T14:15:00Z"],
    ["doc-105-pay", "emp-bell", "pkt-105", "payroll", "Bell_payroll_0614.pdf", null, "needs_review", 1216000, "2026-06-01", "2026-06-14", JSON.stringify({ paidHours: 760, hourlyRate: 16, grossPay: 12160 }), "2026-06-20T14:16:00Z"],
    ["doc-105-time", "emp-bell", "pkt-105", "timesheet", "Marcus_Hale_digital_schedule.csv", null, "needs_review", null, "2026-06-01", "2026-06-14", JSON.stringify({ totalHours: 765, difference: 5 }), "2026-06-20T14:16:30Z"],
    ["doc-106-inv", "emp-cumberland", "pkt-106", "invoice", "CHC-2026-19.pdf", null, "verified", 1008000, "2026-06-01", "2026-06-15", JSON.stringify({ invoiceNumber: "CHC-2026-19", authorizedSignature: true }), "2026-06-21T09:20:00Z"],
    ["doc-106-pay", "emp-cumberland", "pkt-106", "payroll", "Nia_Turner_paystub.pdf", null, "verified", 960000, "2026-06-01", "2026-06-15", JSON.stringify({ paidHours: 600, hourlyRate: 16, grossPay: 9600 }), "2026-06-21T09:21:00Z"],
    ["doc-106-time", "emp-cumberland", "pkt-106", "timesheet", "Nia_Turner_timesheet.pdf", null, "verified", null, "2026-06-01", "2026-06-15", JSON.stringify({ totalHours: 600, internSigned: true, supervisorSigned: true }), "2026-06-21T09:21:30Z"],
    ["doc-106-exp", "emp-cumberland", "pkt-106", "business_expense", "Safety_training_invoice.pdf", null, "verified", 48000, "2026-06-01", "2026-06-15", JSON.stringify({ category: "Required training", mouProvision: "3.1(a)", eligible: true }), "2026-06-21T09:22:00Z"],
  ];
  for (const doc of docs) add("INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ...doc);

  const exceptions = [
    ["exc-104-sign", "pkt-104", 1, "Authorized signature missing", "Invoice INV-0626-14 names the signing authority but does not include a signature.", "Employer of record", "open", "2026-06-18T13:45:00Z", null],
    ["exc-105-hours", "pkt-105", 1, "Five paid hours are unsupported", "The digital schedule totals 765 hours; payroll evidence shows 760 paid hours. Resolve the five-hour difference.", "Program manager", "open", "2026-06-20T14:20:00Z", null],
    ["exc-105-activity", "pkt-105", 2, "Storytelling time needs classification", "One 4-hour shift is labeled “community project” and needs confirmation as storytelling or community engagement.", "Placement supervisor", "open", "2026-06-20T14:20:30Z", null],
  ];
  for (const item of exceptions) add("INSERT INTO packet_exceptions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", ...item);

  const activities = [
    ["act-104-job", "pkt-104", "Job placement", 780, "Ava_Collins_timesheet.xlsx"], ["act-104-community", "pkt-104", "Community engagement", 130, "Ava_Collins_timesheet.xlsx"], ["act-104-story", "pkt-104", "Storytelling", 90, "Ava_Collins_timesheet.xlsx"], ["act-104-soft", "pkt-104", "Soft skills", 60, "Ava_Collins_timesheet.xlsx"],
    ["act-105-job", "pkt-105", "Job placement", 560, "Marcus_Hale_digital_schedule.csv"], ["act-105-community", "pkt-105", "Community engagement", 105, "Marcus_Hale_digital_schedule.csv"], ["act-105-story", "pkt-105", "Storytelling", 40, "Marcus_Hale_digital_schedule.csv"], ["act-105-soft", "pkt-105", "Soft skills", 60, "Marcus_Hale_digital_schedule.csv"],
    ["act-106-job", "pkt-106", "Job placement", 440, "Nia_Turner_timesheet.pdf"], ["act-106-community", "pkt-106", "Community engagement", 70, "Nia_Turner_timesheet.pdf"], ["act-106-story", "pkt-106", "Storytelling", 50, "Nia_Turner_timesheet.pdf"], ["act-106-soft", "pkt-106", "Soft skills", 40, "Nia_Turner_timesheet.pdf"],
  ];
  for (const item of activities) add("INSERT INTO activity_hours VALUES (?, ?, ?, ?, ?)", ...item);

  const reminders = [
    ["rem-107", "emp-redbird", "pkt-107", "Land and Earn invoice needed by June 30", "Hi Jonah,\n\nWe have not yet received Red Bird Mission’s Land and Earn invoice and supporting documents for the June 1–14 pay period. Please send the signed invoice, pay stub or payroll report, and completed time record by June 30 so reimbursement can be processed by July 31.\n\nThis is a draft and has not been sent.", "draft", "2026-06-28T08:00:00Z", null],
    ["rem-104", "emp-pineville", "pkt-104", "Signature update needed for invoice INV-0626-14", "Hi Morgan,\n\nInvoice INV-0626-14 includes the required address and reimbursement detail, but the authorized signature is missing. Please return a signed copy so the $18,760 reimbursement can move forward.\n\nThis is a draft and has not been sent.", "draft", "2026-06-19T08:30:00Z", null],
  ];
  for (const item of reminders) add("INSERT INTO reminder_drafts VALUES (?, ?, ?, ?, ?, ?, ?, ?)", ...item);

  const events = [
    ["evt-pine-prior", "po-pineville", null, "invoice_received", 11366000, "Prior invoices through May 15", "2026-05-15", "Imported fiscal ledger"],
    ["evt-pine-098", "po-pineville", "pkt-098", "invoice_received", 1624000, "INV-0526-09", "2026-06-05", "Ishmel"],
    ["evt-pine-098a", "po-pineville", "pkt-098", "invoice_approved", 1624000, "INV-0526-09", "2026-06-09", "Fiscal reviewer"],
    ["evt-pine-098p", "po-pineville", "pkt-098", "invoice_paid", 1624000, "INV-0526-09", "2026-06-13", "Fiscal reviewer"],
    ["evt-pine-104", "po-pineville", "pkt-104", "invoice_received", 1876000, "INV-0626-14", "2026-06-18", "Ishmel"],
    ["evt-bell-prior", "po-bell", null, "invoice_received", 10472000, "Prior invoices through May 15", "2026-05-15", "Imported fiscal ledger"],
    ["evt-bell-099", "po-bell", "pkt-099", "invoice_received", 1440000, "BC-4418", "2026-06-04", "Ishmel"],
    ["evt-bell-099a", "po-bell", "pkt-099", "invoice_approved", 1440000, "BC-4418", "2026-06-10", "Fiscal reviewer"],
    ["evt-bell-105", "po-bell", "pkt-105", "invoice_received", 1224000, "BC-4481", "2026-06-20", "Ishmel"],
    ["evt-cumb-prior", "po-cumberland", null, "invoice_received", 5606000, "Prior invoices through May 31", "2026-05-31", "Imported fiscal ledger"],
    ["evt-cumb-106", "po-cumberland", "pkt-106", "invoice_received", 1008000, "CHC-2026-19", "2026-06-21", "Ishmel"],
    ["evt-red-prior", "po-redbird", null, "invoice_received", 9275000, "Prior invoices through May 31", "2026-05-31", "Imported fiscal ledger"],
  ];
  for (const event of events) add("INSERT INTO po_events VALUES (?, ?, ?, ?, ?, ?, ?, ?)", ...event);

  const policies = [
    ["pol-irs", "IRS baseline", "Ordinary and necessary business expenses", "IRC §162 / IRS Pub. 583", "current", "Expense must be ordinary, necessary, business-related, and supported by payee, amount, proof of payment, date, and description.", "2024-12-01"],
    ["pol-arc", "Federal + ARC", "ARC non-construction cost principles", "2 CFR 200 Subpart E", "current", "Cost must be allowable, reasonable, allocable, documented, within the approved scope and budget, and incurred during the period of performance.", "2025-12-01"],
    ["pol-grant", "Land and Earn", "Approved award and budget", "ARC-LAE-2024", "needs source", "The signed grant agreement, approved budget, and amendments control project-specific eligibility and must be loaded before live determinations.", "2024-07-01"],
    ["pol-mou", "Employer MOU", "Employer-specific expense terms", "MOU-LAE-2026", "current", "The effective employer MOU sets expense categories, limits, conditions, and required evidence. The strictest applicable rule controls.", "2025-07-01"],
  ];
  for (const policy of policies) add("INSERT INTO policies VALUES (?, ?, ?, ?, ?, ?, ?)", ...policy);

  await db.batch(statements);
}

export async function getDashboardData(): Promise<DashboardData> {
  const db = await ensureDatabase();
  const employerRows = await rows<Record<string, unknown>>(db, `
    SELECT e.*, po.id AS purchase_order_id, po.po_number, po.original_amount_cents,
      po.amendment_amount_cents,
      COALESCE(SUM(CASE WHEN pe.event_type IN ('invoice_received','invoice_adjustment','invoice_voided') THEN pe.amount_cents ELSE 0 END), 0) AS committed_cents,
      COALESCE(SUM(CASE WHEN pe.event_type = 'invoice_approved' THEN pe.amount_cents ELSE 0 END), 0) AS approved_cents,
      COALESCE(SUM(CASE WHEN pe.event_type = 'invoice_paid' THEN pe.amount_cents ELSE 0 END), 0) AS paid_cents
    FROM employers e JOIN purchase_orders po ON po.employer_id = e.id
    LEFT JOIN po_events pe ON pe.purchase_order_id = po.id
    WHERE po.status = 'active' GROUP BY e.id, po.id ORDER BY e.name
  `);
  const packetRows = await rows<Record<string, unknown>>(db, `
    SELECT p.*, e.name AS employer_name, po.po_number, i.name AS intern_name, i.placement
    FROM packets p JOIN employers e ON e.id = p.employer_id
    JOIN purchase_orders po ON po.id = p.purchase_order_id
    LEFT JOIN interns i ON i.id = p.intern_id
    ORDER BY p.priority, p.due_date, p.received_at DESC
  `);
  const exceptionRows = await rows<Record<string, unknown>>(db, "SELECT * FROM packet_exceptions ORDER BY severity, created_at");
  const documentRows = await rows<Record<string, unknown>>(db, "SELECT * FROM documents ORDER BY uploaded_at");
  const activityRows = await rows<Record<string, unknown>>(db, "SELECT * FROM activity_hours ORDER BY category");
  const reminderRows = await rows<Record<string, unknown>>(db, `SELECT r.*, e.name AS employer_name, e.contact_email FROM reminder_drafts r JOIN employers e ON e.id = r.employer_id ORDER BY r.created_at DESC`);
  const eventRows = await rows<Record<string, unknown>>(db, "SELECT * FROM po_events ORDER BY occurred_at DESC, id DESC");
  const policyRows = await rows<Record<string, unknown>>(db, "SELECT * FROM policies ORDER BY effective_at DESC");

  const cents = (value: unknown) => Number(value ?? 0) / 100;
  const employers = employerRows.map((row) => {
    const currentFunding = cents(row.original_amount_cents) + cents(row.amendment_amount_cents);
    const committed = cents(row.committed_cents);
    return {
      id: String(row.id), name: String(row.name), county: String(row.county),
      contactName: String(row.contact_name), contactEmail: String(row.contact_email),
      arrangement: String(row.arrangement), mouCode: String(row.mou_code), mouStatus: String(row.mou_status),
      paySchedule: String(row.pay_schedule), purchaseOrderId: String(row.purchase_order_id), poNumber: String(row.po_number),
      originalFunding: cents(row.original_amount_cents), amendmentFunding: cents(row.amendment_amount_cents),
      currentFunding, committed, available: currentFunding - committed,
      approved: cents(row.approved_cents), paid: cents(row.paid_cents),
      utilization: currentFunding ? Math.round((committed / currentFunding) * 100) : 0,
    };
  });
  const exceptionsFor = (packetId: string) => exceptionRows.filter((x) => x.packet_id === packetId).map((x) => ({
    id: String(x.id), severity: Number(x.severity), title: String(x.title), detail: String(x.detail),
    ownerRole: String(x.owner_role), status: String(x.status), createdAt: String(x.created_at),
    resolvedAt: x.resolved_at ? String(x.resolved_at) : null,
  }));
  const documentsFor = (packetId: string) => documentRows.filter((x) => x.packet_id === packetId).map((x) => ({
    id: String(x.id), kind: String(x.kind), fileName: String(x.file_name), status: String(x.status),
    amount: x.amount_cents == null ? null : cents(x.amount_cents), uploadedAt: String(x.uploaded_at),
    extracted: JSON.parse(String(x.extracted_json || "{}")) as Record<string, unknown>,
  }));
  const activitiesFor = (packetId: string) => activityRows.filter((x) => x.packet_id === packetId).map((x) => ({
    id: String(x.id), category: String(x.category), hours: Number(x.hours), source: String(x.source),
  }));
  const packets = packetRows.map((row) => ({
    id: String(row.id), employerId: String(row.employer_id), employerName: String(row.employer_name),
    purchaseOrderId: String(row.purchase_order_id), poNumber: String(row.po_number),
    internName: row.intern_name ? String(row.intern_name) : null, placement: row.placement ? String(row.placement) : null,
    label: String(row.label), periodStart: String(row.period_start), periodEnd: String(row.period_end),
    status: String(row.status), priority: Number(row.priority), dueDate: String(row.due_date),
    invoiceNumber: row.invoice_number ? String(row.invoice_number) : null,
    invoiceAmount: cents(row.invoice_amount_cents), wageAmount: cents(row.wage_amount_cents),
    businessAmount: cents(row.business_amount_cents), confidence: Number(row.confidence),
    receivedAt: row.received_at ? String(row.received_at) : null,
    approvedAt: row.approved_at ? String(row.approved_at) : null, paidAt: row.paid_at ? String(row.paid_at) : null,
    exceptions: exceptionsFor(String(row.id)), documents: documentsFor(String(row.id)), activities: activitiesFor(String(row.id)),
  }));
  return {
    generatedAt: new Date().toISOString(), hourlyRate: 16, fiscalYearEnd: "2026-06-30", paymentDeadline: "2026-07-31",
    employers, packets,
    reminders: reminderRows.map((row) => ({
      id: String(row.id), employerId: String(row.employer_id), employerName: String(row.employer_name),
      contactEmail: String(row.contact_email), packetId: row.packet_id ? String(row.packet_id) : null,
      subject: String(row.subject), body: String(row.body), status: String(row.status),
      createdAt: String(row.created_at), reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    })),
    poEvents: eventRows.map((row) => ({
      id: String(row.id), purchaseOrderId: String(row.purchase_order_id), packetId: row.packet_id ? String(row.packet_id) : null,
      eventType: String(row.event_type), amount: cents(row.amount_cents), reference: String(row.reference),
      occurredAt: String(row.occurred_at), actor: String(row.actor),
    })),
    policies: policyRows.map((row) => ({
      id: String(row.id), level: String(row.level), title: String(row.title), code: String(row.code),
      status: String(row.status), summary: String(row.summary), effectiveAt: String(row.effective_at),
    })),
  };
}

export async function resolveException(exceptionId: string) {
  const db = await ensureDatabase();
  const now = new Date().toISOString();
  await db.prepare("UPDATE packet_exceptions SET status = 'resolved', resolved_at = ? WHERE id = ?").bind(now, exceptionId).run();
  return { ok: true };
}

export async function approvePacket(packetId: string) {
  const db = await ensureDatabase();
  const blocker = await db.prepare("SELECT COUNT(*) AS count FROM packet_exceptions WHERE packet_id = ? AND severity = 1 AND status = 'open'").bind(packetId).first<{ count: number }>();
  if (blocker?.count) throw new Error("Resolve all payment blockers before approval.");
  const packet = await db.prepare("SELECT * FROM packets WHERE id = ?").bind(packetId).first<Record<string, unknown>>();
  if (!packet) throw new Error("Packet not found.");
  if (!Number(packet.invoice_amount_cents) || !packet.invoice_number) throw new Error("A detailed invoice is required before approval.");
  const funding = await db.prepare(`
    SELECT po.original_amount_cents + po.amendment_amount_cents AS funding_cents,
      COALESCE(SUM(CASE WHEN pe.event_type IN ('invoice_received','invoice_adjustment','invoice_voided') THEN pe.amount_cents ELSE 0 END), 0) AS committed_cents
    FROM purchase_orders po LEFT JOIN po_events pe ON pe.purchase_order_id = po.id
    WHERE po.id = ? AND po.status = 'active' GROUP BY po.id
  `).bind(packet.purchase_order_id).first<{ funding_cents: number; committed_cents: number }>();
  if (!funding) throw new Error("An active purchase order is required before approval.");
  if (Number(funding.committed_cents) > Number(funding.funding_cents)) {
    throw new Error("Approval blocked: received invoices exceed the purchase order's current funding.");
  }
  const duplicate = await db.prepare("SELECT id FROM po_events WHERE packet_id = ? AND event_type = 'invoice_approved'").bind(packetId).first();
  const now = new Date().toISOString();
  const operations = [db.prepare("UPDATE packets SET status = 'approved', approved_at = ? WHERE id = ?").bind(now, packetId)];
  if (!duplicate) operations.push(db.prepare("INSERT INTO po_events VALUES (?, ?, ?, 'invoice_approved', ?, ?, ?, 'Program manager')").bind(`evt-${crypto.randomUUID()}`, packet.purchase_order_id, packetId, packet.invoice_amount_cents, packet.invoice_number ?? packetId, now.slice(0, 10)));
  await db.batch(operations);
  return { ok: true };
}

export async function markPacketPaid(packetId: string) {
  const db = await ensureDatabase();
  const packet = await db.prepare("SELECT * FROM packets WHERE id = ? AND status = 'approved'").bind(packetId).first<Record<string, unknown>>();
  if (!packet) throw new Error("Only an approved packet can be marked paid.");
  const duplicate = await db.prepare("SELECT id FROM po_events WHERE packet_id = ? AND event_type = 'invoice_paid'").bind(packetId).first();
  const now = new Date().toISOString();
  const operations = [db.prepare("UPDATE packets SET status = 'paid', paid_at = ? WHERE id = ?").bind(now, packetId)];
  if (!duplicate) operations.push(db.prepare("INSERT INTO po_events VALUES (?, ?, ?, 'invoice_paid', ?, ?, ?, 'Fiscal reviewer')").bind(`evt-${crypto.randomUUID()}`, packet.purchase_order_id, packetId, packet.invoice_amount_cents, packet.invoice_number ?? packetId, now.slice(0, 10)));
  await db.batch(operations);
  return { ok: true };
}

export async function reviewReminder(reminderId: string) {
  const db = await ensureDatabase();
  await db.prepare("UPDATE reminder_drafts SET status = 'reviewed', reviewed_at = ? WHERE id = ?").bind(new Date().toISOString(), reminderId).run();
  return { ok: true };
}

export async function storeDocument(form: FormData) {
  const db = await ensureDatabase();
  const file = form.get("file");
  const employerId = String(form.get("employerId") ?? "");
  const packetId = String(form.get("packetId") ?? "") || null;
  const kind = String(form.get("kind") ?? "unknown");
  const amountText = String(form.get("amount") ?? "").trim().replace(/[$,]/g, "");
  const amount = amountText ? Number(amountText) : null;
  const amountCents = amount == null || !Number.isFinite(amount) ? null : Math.round(amount * 100);
  if (!(file instanceof File) || !employerId) throw new Error("Choose a file and employer.");
  if (amountText && amountCents == null) throw new Error("Enter a valid document amount.");
  const packet = packetId
    ? await db.prepare("SELECT * FROM packets WHERE id = ?").bind(packetId).first<Record<string, unknown>>()
    : null;
  if (packetId && !packet) throw new Error("The selected reimbursement packet no longer exists.");
  if (packet && String(packet.employer_id) !== employerId) throw new Error("The packet must belong to the selected employer.");
  if (kind === "invoice" && packet && (!amountCents || amountCents <= 0)) {
    throw new Error("Enter the invoice total so the purchase-order balance can be updated.");
  }
  const id = `doc-${crypto.randomUUID()}`;
  const key = `${employerId}/${new Date().toISOString().slice(0, 10)}/${id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  if (env.FILES) await env.FILES.put(key, file.stream(), { httpMetadata: { contentType: file.type || "application/octet-stream" } });
  const extracted = { fileSize: file.size, contentType: file.type, classification: kind, confidence: 62, note: "Uploaded successfully; extracted fields require review." };
  const now = new Date().toISOString();
  const operations: D1PreparedStatement[] = [db.prepare(`INSERT INTO documents (id, employer_id, packet_id, kind, file_name, r2_key, status, amount_cents, extracted_json, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, 'needs_review', ?, ?, ?)`)
    .bind(id, employerId, packetId, kind, file.name, env.FILES ? key : null, amountCents, JSON.stringify(extracted), now)];
  if (kind === "invoice" && packet && amountCents) {
    const priorAmount = Number(packet.invoice_amount_cents ?? 0);
    const received = await db.prepare("SELECT id FROM po_events WHERE packet_id = ? AND event_type = 'invoice_received'").bind(packetId).first();
    const eventType = received ? "invoice_adjustment" : "invoice_received";
    const ledgerAmount = received ? amountCents - priorAmount : amountCents;
    operations.push(db.prepare(`UPDATE packets SET invoice_amount_cents = ?, received_at = COALESCE(received_at, ?),
      status = CASE WHEN status = 'invoice_not_received' THEN 'needs_review' ELSE status END WHERE id = ?`)
      .bind(amountCents, now, packetId));
    if (ledgerAmount !== 0) operations.push(db.prepare(`INSERT INTO po_events
      (id, purchase_order_id, packet_id, event_type, amount_cents, reference, occurred_at, actor)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Document intake')`)
      .bind(`evt-${crypto.randomUUID()}`, packet.purchase_order_id, packetId, eventType, ledgerAmount,
        packet.invoice_number ?? file.name, now.slice(0, 10)));
  }
  await db.batch(operations);
  return { ok: true, document: { id, fileName: file.name, kind, status: "needs_review" } };
}
