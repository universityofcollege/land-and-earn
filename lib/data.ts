import { env } from "cloudflare:workers";
import { strToU8, zipSync } from "fflate";
import type { DashboardData } from "./types";
import { extractDocument, sha256, type DocumentExtraction } from "./extraction";

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
    issued_at TEXT NOT NULL, effective_end TEXT NOT NULL, document_id TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS interns (
    id TEXT PRIMARY KEY, employer_id TEXT NOT NULL REFERENCES employers(id),
    name TEXT NOT NULL, county TEXT NOT NULL, placement TEXT NOT NULL,
    supervisor_name TEXT, supervisor_email TEXT
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
    period_start TEXT, period_end TEXT, extracted_json TEXT NOT NULL DEFAULT '{}',
    content_hash TEXT, classification_confidence INTEGER NOT NULL DEFAULT 0,
    extraction_provider TEXT NOT NULL DEFAULT 'local', uploader TEXT NOT NULL DEFAULT 'Program manager',
    source TEXT NOT NULL DEFAULT 'web_upload', processed_at TEXT, error_message TEXT, uploaded_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS packet_exceptions (
    id TEXT PRIMARY KEY, packet_id TEXT NOT NULL REFERENCES packets(id), severity INTEGER NOT NULL,
    title TEXT NOT NULL, detail TEXT NOT NULL, owner_role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, resolved_at TEXT,
    resolution_type TEXT, resolution_reason TEXT, resolved_by TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS activity_hours (
    id TEXT PRIMARY KEY, packet_id TEXT NOT NULL REFERENCES packets(id),
    document_id TEXT REFERENCES documents(id), category TEXT NOT NULL, hours REAL NOT NULL, source TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS reminder_drafts (
    id TEXT PRIMARY KEY, employer_id TEXT NOT NULL REFERENCES employers(id),
    packet_id TEXT REFERENCES packets(id), subject TEXT NOT NULL, body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL, reviewed_at TEXT,
    recipient_name TEXT, recipient_email TEXT, recipient_role TEXT NOT NULL DEFAULT 'Employer of record'
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
  `CREATE TABLE IF NOT EXISTS program_settings (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, hourly_rate_cents INTEGER NOT NULL,
    fiscal_year_start TEXT NOT NULL, fiscal_year_end TEXT NOT NULL,
    invoice_deadline TEXT NOT NULL, payment_deadline TEXT NOT NULL,
    retention_years INTEGER NOT NULL DEFAULT 7, po_warning_percent INTEGER NOT NULL DEFAULT 15
  )`,
  `CREATE TABLE IF NOT EXISTS mous (
    id TEXT PRIMARY KEY, employer_id TEXT NOT NULL REFERENCES employers(id), code TEXT NOT NULL,
    version TEXT NOT NULL, effective_start TEXT NOT NULL, effective_end TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'current', allowed_expenses_json TEXT NOT NULL DEFAULT '[]',
    limits_json TEXT NOT NULL DEFAULT '{}', conditions_json TEXT NOT NULL DEFAULT '[]',
    evidence_requirements_json TEXT NOT NULL DEFAULT '[]', document_id TEXT REFERENCES documents(id),
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS document_packet_links (
    id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id),
    packet_id TEXT NOT NULL REFERENCES packets(id), is_primary INTEGER NOT NULL DEFAULT 0,
    linked_at TEXT NOT NULL, actor TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS document_field_evidence (
    id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id), field_name TEXT NOT NULL,
    value_json TEXT NOT NULL, confidence INTEGER NOT NULL, source_locator TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'extracted', corrected_value_json TEXT,
    reviewed_at TEXT, reviewer TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS reimbursement_claims (
    id TEXT PRIMARY KEY, packet_id TEXT NOT NULL REFERENCES packets(id),
    document_id TEXT NOT NULL REFERENCES documents(id), claim_type TEXT NOT NULL,
    description TEXT NOT NULL, business_purpose TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Unclassified', amount_requested_cents INTEGER NOT NULL,
    amount_eligible_cents INTEGER, status TEXT NOT NULL DEFAULT 'needs_review',
    mou_id TEXT REFERENCES mous(id), supporting_document_id TEXT REFERENCES documents(id),
    source_locator TEXT NOT NULL, confidence INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS eligibility_checks (
    id TEXT PRIMARY KEY, claim_id TEXT NOT NULL REFERENCES reimbursement_claims(id),
    authority_level TEXT NOT NULL, policy_id TEXT REFERENCES policies(id), result TEXT NOT NULL,
    reason TEXT NOT NULL, confidence INTEGER NOT NULL, reviewer TEXT, reviewed_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
    action TEXT NOT NULL, actor TEXT NOT NULL, occurred_at TEXT NOT NULL,
    before_json TEXT, after_json TEXT, reason TEXT
  )`,
  "CREATE INDEX IF NOT EXISTS purchase_orders_employer_idx ON purchase_orders(employer_id)",
  "CREATE INDEX IF NOT EXISTS packets_employer_idx ON packets(employer_id)",
  "CREATE INDEX IF NOT EXISTS documents_packet_idx ON documents(packet_id)",
  "CREATE INDEX IF NOT EXISTS packet_exceptions_packet_idx ON packet_exceptions(packet_id)",
  "CREATE INDEX IF NOT EXISTS po_events_po_idx ON po_events(purchase_order_id)",
  "CREATE INDEX IF NOT EXISTS mous_employer_idx ON mous(employer_id)",
  "CREATE INDEX IF NOT EXISTS document_links_document_idx ON document_packet_links(document_id)",
  "CREATE INDEX IF NOT EXISTS document_links_packet_idx ON document_packet_links(packet_id)",
  "CREATE INDEX IF NOT EXISTS field_evidence_document_idx ON document_field_evidence(document_id)",
  "CREATE INDEX IF NOT EXISTS claims_packet_idx ON reimbursement_claims(packet_id)",
  "CREATE INDEX IF NOT EXISTS eligibility_claim_idx ON eligibility_checks(claim_id)",
  "CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit_events(entity_type, entity_id)",
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
  await ensureDocumentColumns(db);
  await ensureColumns(db, "interns", [["supervisor_name", "TEXT"], ["supervisor_email", "TEXT"]]);
  await ensureColumns(db, "reminder_drafts", [["recipient_name", "TEXT"], ["recipient_email", "TEXT"], ["recipient_role", "TEXT NOT NULL DEFAULT 'Employer of record'"]]);
  await ensureColumns(db, "packet_exceptions", [["resolution_type", "TEXT"], ["resolution_reason", "TEXT"], ["resolved_by", "TEXT"]]);
  await ensureColumns(db, "reimbursement_claims", [["supporting_document_id", "TEXT REFERENCES documents(id)"]]);
  await ensureColumns(db, "activity_hours", [["document_id", "TEXT REFERENCES documents(id)"]]);
  await ensureColumns(db, "purchase_orders", [["document_id", "TEXT"]]);
  await db.prepare("CREATE INDEX IF NOT EXISTS documents_hash_idx ON documents(content_hash)").run();
  const existing = await db.prepare("SELECT COUNT(*) AS count FROM employers").first<{ count: number }>();
  if (!existing?.count) await seedDatabase(db);
  await ensureOperationalDefaults(db);
  return db;
}

async function ensureOperationalDefaults(db: Db) {
  await db.prepare(`INSERT OR IGNORE INTO program_settings VALUES
    ('program-land-earn', 'Land and Earn', 1600, '2025-07-01', '2026-06-30', '2026-06-30', '2026-07-31', 7, 15)`).run();
  const employers = await rows<{ id: string; mou_code: string }>(db, "SELECT id, mou_code FROM employers");
  const statements: D1PreparedStatement[] = [];
  for (const employer of employers) statements.push(db.prepare(`INSERT OR IGNORE INTO mous
    (id, employer_id, code, version, effective_start, effective_end, status, allowed_expenses_json,
     limits_json, conditions_json, evidence_requirements_json, document_id, created_at)
    VALUES (?, ?, ?, '1', '2025-07-01', '2026-06-30', 'current', '[]', '{}', '[]',
      '["Itemized receipt","Proof of payment","Business purpose"]', NULL, '2025-07-01')`)
    .bind(`mou-${employer.id}-v1`, employer.id, employer.mou_code));
  if (statements.length) await db.batch(statements);
}

async function ensureDocumentColumns(db: Db) {
  const additions: Array<[string, string]> = [
    ["content_hash", "TEXT"], ["classification_confidence", "INTEGER NOT NULL DEFAULT 0"],
    ["extraction_provider", "TEXT NOT NULL DEFAULT 'local'"], ["uploader", "TEXT NOT NULL DEFAULT 'Program manager'"],
    ["source", "TEXT NOT NULL DEFAULT 'web_upload'"], ["processed_at", "TEXT"], ["error_message", "TEXT"],
  ];
  await ensureColumns(db, "documents", additions);
}

async function ensureColumns(db: Db, table: string, additions: Array<[string, string]>) {
  const existing = await rows<{ name: string }>(db, `PRAGMA table_info(${table})`);
  const names = new Set(existing.map((column) => column.name));
  const missing = additions.filter(([name]) => !names.has(name));
  if (missing.length) await db.batch(missing.map(([name, definition]) => db.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`)));
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
  for (const po of pos) add(`INSERT INTO purchase_orders
    (id, employer_id, po_number, original_amount_cents, amendment_amount_cents, status, issued_at, effective_end)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, ...po);

  const interns = [
    ["int-ava", "emp-pineville", "Ava Collins", "Bell County", "Pineville Family Resource Center"],
    ["int-marcus", "emp-bell", "Marcus Hale", "Bell County", "Bell County Tourism"],
    ["int-nia", "emp-cumberland", "Nia Turner", "Knox County", "Cumberland Hope Community"],
    ["int-eli", "emp-redbird", "Eli Baker", "Clay County", "Red Bird Mission Craft Store"],
    ["int-jada", "emp-pineville", "Jada Webb", "Knox County", "Pineville Summer Feeding Program"],
  ];
  for (const intern of interns) add("INSERT INTO interns (id, employer_id, name, county, placement) VALUES (?, ?, ?, ?, ?)", ...intern);

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
  for (const doc of docs) add(`INSERT INTO documents
    (id, employer_id, packet_id, kind, file_name, r2_key, status, amount_cents, period_start, period_end, extracted_json, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ...doc);

  const exceptions = [
    ["exc-104-sign", "pkt-104", 1, "Authorized signature missing", "Invoice INV-0626-14 names the signing authority but does not include a signature.", "Employer of record", "open", "2026-06-18T13:45:00Z", null],
    ["exc-105-hours", "pkt-105", 1, "Five paid hours are unsupported", "The digital schedule totals 765 hours; payroll evidence shows 760 paid hours. Resolve the five-hour difference.", "Program manager", "open", "2026-06-20T14:20:00Z", null],
    ["exc-105-activity", "pkt-105", 2, "Storytelling time needs classification", "One 4-hour shift is labeled “community project” and needs confirmation as storytelling or community engagement.", "Placement supervisor", "open", "2026-06-20T14:20:30Z", null],
  ];
  for (const item of exceptions) add(`INSERT INTO packet_exceptions
    (id, packet_id, severity, title, detail, owner_role, status, created_at, resolved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, ...item);

  const activities = [
    ["act-104-job", "pkt-104", "Job placement", 780, "Ava_Collins_timesheet.xlsx"], ["act-104-community", "pkt-104", "Community engagement", 130, "Ava_Collins_timesheet.xlsx"], ["act-104-story", "pkt-104", "Storytelling", 90, "Ava_Collins_timesheet.xlsx"], ["act-104-soft", "pkt-104", "Soft skills", 60, "Ava_Collins_timesheet.xlsx"],
    ["act-105-job", "pkt-105", "Job placement", 560, "Marcus_Hale_digital_schedule.csv"], ["act-105-community", "pkt-105", "Community engagement", 105, "Marcus_Hale_digital_schedule.csv"], ["act-105-story", "pkt-105", "Storytelling", 40, "Marcus_Hale_digital_schedule.csv"], ["act-105-soft", "pkt-105", "Soft skills", 60, "Marcus_Hale_digital_schedule.csv"],
    ["act-106-job", "pkt-106", "Job placement", 440, "Nia_Turner_timesheet.pdf"], ["act-106-community", "pkt-106", "Community engagement", 70, "Nia_Turner_timesheet.pdf"], ["act-106-story", "pkt-106", "Storytelling", 50, "Nia_Turner_timesheet.pdf"], ["act-106-soft", "pkt-106", "Soft skills", 40, "Nia_Turner_timesheet.pdf"],
  ];
  for (const item of activities) add("INSERT INTO activity_hours (id, packet_id, category, hours, source) VALUES (?, ?, ?, ?, ?)", ...item);

  const reminders = [
    ["rem-107", "emp-redbird", "pkt-107", "Land and Earn invoice needed by June 30", "Hi Jonah,\n\nWe have not yet received Red Bird Mission’s Land and Earn invoice and supporting documents for the June 1–14 pay period. Please send the signed invoice, pay stub or payroll report, and completed time record by June 30 so reimbursement can be processed by July 31.\n\nThis is a draft and has not been sent.", "draft", "2026-06-28T08:00:00Z", null],
    ["rem-104", "emp-pineville", "pkt-104", "Signature update needed for invoice INV-0626-14", "Hi Morgan,\n\nInvoice INV-0626-14 includes the required address and reimbursement detail, but the authorized signature is missing. Please return a signed copy so the $18,760 reimbursement can move forward.\n\nThis is a draft and has not been sent.", "draft", "2026-06-19T08:30:00Z", null],
  ];
  for (const item of reminders) add("INSERT INTO reminder_drafts (id, employer_id, packet_id, subject, body, status, created_at, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", ...item);

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

  add("INSERT INTO program_settings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", "program-land-earn", "Land and Earn", 1600, "2025-07-01", "2026-06-30", "2026-06-30", "2026-07-31", 7, 15);
  const mouRecords = [
    ["mou-pineville-v1", "emp-pineville", "MOU-LAE-2026-01", "1", "2025-07-01", "2026-06-30", "current", JSON.stringify(["Required work apparel", "Required training", "Program supplies"]), JSON.stringify({ "Required work apparel": 2500, "Required training": 1500 }), JSON.stringify(["Expense must directly support the intern placement"]), JSON.stringify(["Itemized receipt", "Proof of payment", "Business purpose"]), null, "2025-07-01"],
    ["mou-bell-v1", "emp-bell", "MOU-LAE-2026-02", "1", "2025-07-01", "2026-06-30", "current", JSON.stringify(["Required training", "Program supplies"]), JSON.stringify({ "Required training": 2000 }), JSON.stringify(["Expense must be within the approved program period"]), JSON.stringify(["Invoice or receipt", "Proof of payment", "Business purpose"]), null, "2025-07-01"],
    ["mou-cumberland-v1", "emp-cumberland", "MOU-LAE-2026-03", "1", "2025-07-01", "2026-06-30", "current", JSON.stringify(["Required training", "Safety equipment", "Program supplies"]), JSON.stringify({ "Required training": 2500 }), JSON.stringify(["Expense must be necessary for the placement"]), JSON.stringify(["Itemized receipt", "Proof of payment", "Business purpose"]), null, "2025-07-01"],
    ["mou-redbird-v1", "emp-redbird", "MOU-LAE-2026-04", "1", "2025-07-01", "2026-06-30", "current", JSON.stringify(["Required work apparel", "Required training", "Program supplies"]), JSON.stringify({}), JSON.stringify(["Expense must be approved by the employer contact"]), JSON.stringify(["Itemized receipt", "Proof of payment", "Business purpose"]), null, "2025-07-01"],
  ];
  for (const mou of mouRecords) add("INSERT INTO mous VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ...mou);

  await db.batch(statements);
}

export async function getDashboardData(): Promise<DashboardData> {
  const db = await ensureDatabase();
  const employerRows = await rows<Record<string, unknown>>(db, `
    SELECT e.*, po.id AS purchase_order_id, po.po_number, po.original_amount_cents,
      po.amendment_amount_cents, po.issued_at, po.effective_end, po.document_id,
      COALESCE(SUM(CASE WHEN pe.event_type IN ('invoice_received','invoice_adjustment','invoice_voided') THEN pe.amount_cents ELSE 0 END), 0) AS committed_cents,
      COALESCE(SUM(CASE WHEN pe.event_type = 'invoice_approved' THEN pe.amount_cents ELSE 0 END), 0) AS approved_cents,
      COALESCE(SUM(CASE WHEN pe.event_type = 'invoice_paid' THEN pe.amount_cents ELSE 0 END), 0) AS paid_cents
    FROM employers e JOIN purchase_orders po ON po.employer_id = e.id
    LEFT JOIN po_events pe ON pe.purchase_order_id = po.id
    WHERE po.status = 'active' GROUP BY e.id, po.id ORDER BY e.name
  `);
  const packetRows = await rows<Record<string, unknown>>(db, `
    SELECT p.*, e.name AS employer_name, po.po_number, i.name AS intern_name, i.county AS intern_county,
      i.placement, i.supervisor_name, i.supervisor_email
    FROM packets p JOIN employers e ON e.id = p.employer_id
    JOIN purchase_orders po ON po.id = p.purchase_order_id
    LEFT JOIN interns i ON i.id = p.intern_id
    ORDER BY p.priority, p.due_date, p.received_at DESC
  `);
  const exceptionRows = await rows<Record<string, unknown>>(db, "SELECT * FROM packet_exceptions ORDER BY severity, created_at");
  const documentRows = await rows<Record<string, unknown>>(db, "SELECT * FROM documents ORDER BY uploaded_at");
  const documentLinkRows = await rows<Record<string, unknown>>(db, "SELECT document_id, packet_id FROM document_packet_links");
  const fieldRows = await rows<Record<string, unknown>>(db, "SELECT * FROM document_field_evidence ORDER BY field_name");
  const activityRows = await rows<Record<string, unknown>>(db, "SELECT * FROM activity_hours ORDER BY category");
  const reminderRows = await rows<Record<string, unknown>>(db, `SELECT r.*, e.name AS employer_name,
    COALESCE(r.recipient_email, e.contact_email) AS contact_email FROM reminder_drafts r JOIN employers e ON e.id = r.employer_id ORDER BY r.created_at DESC`);
  const eventRows = await rows<Record<string, unknown>>(db, "SELECT * FROM po_events ORDER BY occurred_at DESC, id DESC");
  const policyRows = await rows<Record<string, unknown>>(db, "SELECT * FROM policies ORDER BY effective_at DESC");
  const claimRows = await rows<Record<string, unknown>>(db, "SELECT * FROM reimbursement_claims WHERE status <> 'superseded' ORDER BY id");
  const checkRows = await rows<Record<string, unknown>>(db, "SELECT * FROM eligibility_checks ORDER BY authority_level");
  const auditRows = await rows<Record<string, unknown>>(db, "SELECT * FROM audit_events ORDER BY occurred_at DESC");
  const mouRows = await rows<Record<string, unknown>>(db, "SELECT * FROM mous ORDER BY employer_id, effective_start DESC");
  const settingsRow = await db.prepare("SELECT * FROM program_settings WHERE id = 'program-land-earn'").first<Record<string, unknown>>();

  const cents = (value: unknown) => Number(value ?? 0) / 100;
  const employers = employerRows.map((row) => {
    const currentFunding = cents(row.original_amount_cents) + cents(row.amendment_amount_cents);
    const committed = cents(row.committed_cents);
    return {
      id: String(row.id), name: String(row.name), county: String(row.county),
      contactName: String(row.contact_name), contactEmail: String(row.contact_email),
      arrangement: String(row.arrangement), mouCode: String(row.mou_code), mouStatus: String(row.mou_status),
      paySchedule: String(row.pay_schedule), purchaseOrderId: String(row.purchase_order_id), poNumber: String(row.po_number),
      poIssuedAt: String(row.issued_at), poEffectiveEnd: String(row.effective_end),
      poDocumentId: row.document_id ? String(row.document_id) : null,
      poDocumentName: row.document_id ? String(documentRows.find((document) => document.id === row.document_id)?.file_name ?? "Purchase-order source") : null,
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
    resolutionType: x.resolution_type ? String(x.resolution_type) : null,
    resolutionReason: x.resolution_reason ? String(x.resolution_reason) : null,
    resolvedBy: x.resolved_by ? String(x.resolved_by) : null,
  }));
  const documentsFor = (packetId: string) => documentRows.filter((x) => x.packet_id === packetId || documentLinkRows.some((link) => link.document_id === x.id && link.packet_id === packetId)).map((x) => ({
    id: String(x.id), kind: String(x.kind), fileName: String(x.file_name), status: String(x.status),
    amount: x.amount_cents == null ? null : cents(x.amount_cents), uploadedAt: String(x.uploaded_at),
    classificationConfidence: Number(x.classification_confidence ?? 0), extractionProvider: String(x.extraction_provider ?? "local"),
    hasOriginal: Boolean(x.r2_key),
    fieldEvidence: fieldRows.filter((field) => field.document_id === x.id).map((field) => ({
      id: String(field.id), name: String(field.field_name),
      value: JSON.parse(String(field.corrected_value_json ?? field.value_json ?? "null")) as unknown,
      confidence: Number(field.confidence), source: String(field.source_locator), status: String(field.status),
    })),
    extracted: JSON.parse(String(x.extracted_json || "{}")) as Record<string, unknown>,
  }));
  const activitiesFor = (packetId: string) => {
    const timeDocuments = documentRows.filter((document) => document.kind === "timesheet" && (document.packet_id === packetId || documentLinkRows.some((link) => link.document_id === document.id && link.packet_id === packetId)));
    const latestTimeDocument = timeDocuments.at(-1);
    let relevant = latestTimeDocument ? activityRows.filter((activity) => activity.packet_id === packetId && activity.document_id === latestTimeDocument.id) : [];
    if (!relevant.length) relevant = activityRows.filter((activity) => activity.packet_id === packetId && !activity.document_id);
    return relevant.map((x) => ({ id: String(x.id), documentId: x.document_id ? String(x.document_id) : null, category: String(x.category), hours: Number(x.hours), source: String(x.source) }));
  };
  const claimsFor = (packetId: string) => claimRows.filter((claim) => claim.packet_id === packetId).map((claim) => ({
    id: String(claim.id), documentId: String(claim.document_id), type: String(claim.claim_type),
    description: String(claim.description), businessPurpose: String(claim.business_purpose), category: String(claim.category),
    amountRequested: cents(claim.amount_requested_cents), amountEligible: claim.amount_eligible_cents == null ? null : cents(claim.amount_eligible_cents),
    status: String(claim.status), supportingDocumentId: claim.supporting_document_id ? String(claim.supporting_document_id) : null,
    supportingDocumentName: claim.supporting_document_id ? String(documentRows.find((document) => document.id === claim.supporting_document_id)?.file_name ?? "Supporting document") : null,
    source: String(claim.source_locator), confidence: Number(claim.confidence),
    checks: checkRows.filter((check) => check.claim_id === claim.id).map((check) => ({ id: String(check.id), authorityLevel: String(check.authority_level), result: String(check.result), reason: String(check.reason), confidence: Number(check.confidence), reviewedAt: check.reviewed_at ? String(check.reviewed_at) : null })),
  }));
  const historyFor = (packetId: string) => auditRows.filter((event) => event.entity_id === packetId || (event.entity_type === "document" && documentsFor(packetId).some((document) => document.id === event.entity_id))).map((event) => ({
    id: String(event.id), entityType: String(event.entity_type), entityId: String(event.entity_id), action: String(event.action), actor: String(event.actor), occurredAt: String(event.occurred_at),
    before: event.before_json ? JSON.parse(String(event.before_json)) as unknown : null,
    after: event.after_json ? JSON.parse(String(event.after_json)) as unknown : null, reason: event.reason ? String(event.reason) : null,
  }));
  const packets = packetRows.map((row) => ({
    id: String(row.id), employerId: String(row.employer_id), employerName: String(row.employer_name),
    purchaseOrderId: String(row.purchase_order_id), poNumber: String(row.po_number),
    internName: row.intern_name ? String(row.intern_name) : null, placement: row.placement ? String(row.placement) : null,
    supervisorName: row.supervisor_name ? String(row.supervisor_name) : null, supervisorEmail: row.supervisor_email ? String(row.supervisor_email) : null,
    county: row.intern_county ? String(row.intern_county) : null,
    fiscalYear: `FY${String(row.period_end).slice(2, 4)}`,
    label: String(row.label), periodStart: String(row.period_start), periodEnd: String(row.period_end),
    status: String(row.status), priority: Number(row.priority), dueDate: String(row.due_date),
    invoiceNumber: row.invoice_number ? String(row.invoice_number) : null,
    invoiceAmount: cents(row.invoice_amount_cents), wageAmount: cents(row.wage_amount_cents),
    businessAmount: cents(row.business_amount_cents), confidence: Number(row.confidence),
    receivedAt: row.received_at ? String(row.received_at) : null,
    approvedAt: row.approved_at ? String(row.approved_at) : null, paidAt: row.paid_at ? String(row.paid_at) : null,
    exceptions: exceptionsFor(String(row.id)), documents: documentsFor(String(row.id)), activities: activitiesFor(String(row.id)),
    claims: claimsFor(String(row.id)), history: historyFor(String(row.id)),
  }));
  if (!settingsRow) throw new Error("Program settings are missing.");
  return {
    generatedAt: new Date().toISOString(), hourlyRate: cents(settingsRow.hourly_rate_cents), fiscalYearEnd: String(settingsRow.fiscal_year_end), paymentDeadline: String(settingsRow.payment_deadline),
    employers, packets,
    reminders: reminderRows.map((row) => ({
      id: String(row.id), employerId: String(row.employer_id), employerName: String(row.employer_name),
      contactEmail: String(row.contact_email), packetId: row.packet_id ? String(row.packet_id) : null,
      recipientName: row.recipient_name ? String(row.recipient_name) : null,
      recipientRole: String(row.recipient_role ?? "Employer of record"),
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
    settings: { id: String(settingsRow.id), name: String(settingsRow.name), hourlyRate: cents(settingsRow.hourly_rate_cents), fiscalYearStart: String(settingsRow.fiscal_year_start), fiscalYearEnd: String(settingsRow.fiscal_year_end), invoiceDeadline: String(settingsRow.invoice_deadline), paymentDeadline: String(settingsRow.payment_deadline), retentionYears: Number(settingsRow.retention_years), poWarningPercent: Number(settingsRow.po_warning_percent) },
    mous: mouRows.map((row) => ({ id: String(row.id), employerId: String(row.employer_id), code: String(row.code), version: String(row.version), effectiveStart: String(row.effective_start), effectiveEnd: String(row.effective_end), status: String(row.status), allowedExpenses: JSON.parse(String(row.allowed_expenses_json || "[]")) as string[], limits: JSON.parse(String(row.limits_json || "{}")) as Record<string, number>, conditions: JSON.parse(String(row.conditions_json || "[]")) as string[], evidenceRequirements: JSON.parse(String(row.evidence_requirements_json || "[]")) as string[], documentId: row.document_id ? String(row.document_id) : null, documentName: row.document_id ? String(documentRows.find((document) => document.id === row.document_id)?.file_name ?? "MOU source") : null })),
    unmatchedDocuments: documentRows.filter((row) => !row.packet_id && !documentLinkRows.some((link) => link.document_id === row.id) && !mouRows.some((mou) => mou.document_id === row.id) && !employerRows.some((employer) => employer.document_id === row.id)).map((row) => ({ id: String(row.id), employerId: String(row.employer_id), employerName: String(employerRows.find((employer) => employer.id === row.employer_id)?.name ?? "Unknown employer"), kind: String(row.kind), fileName: String(row.file_name), status: String(row.status), uploadedAt: String(row.uploaded_at), confidence: Number(row.classification_confidence ?? 0), provider: String(row.extraction_provider ?? "local"), hasOriginal: Boolean(row.r2_key) })),
  };
}

export async function resolveException(exceptionId: string, reason: string) {
  const db = await ensureDatabase();
  if (!reason.trim()) throw new Error("Document the authorized override reason before resolving a payment exception.");
  const now = new Date().toISOString();
  const before = await db.prepare("SELECT * FROM packet_exceptions WHERE id = ?").bind(exceptionId).first<Record<string, unknown>>();
  if (!before) throw new Error("Exception not found.");
  if (before.status !== "open") throw new Error("This review item is already resolved.");
  if (Number(before.severity) === 1) throw new Error("Priority 1 payment blockers require corrected evidence or a governing review decision; they cannot be manually overridden under the current pilot policy.");
  await db.batch([
    db.prepare("UPDATE packet_exceptions SET status = 'resolved', resolved_at = ?, resolution_type = 'authorized_override', resolution_reason = ?, resolved_by = 'Program manager' WHERE id = ?").bind(now, reason.trim(), exceptionId),
    db.prepare("INSERT INTO audit_events VALUES (?, 'packet', ?, 'exception_overridden', 'Program manager', ?, ?, ?, ?)")
      .bind(`audit-${crypto.randomUUID()}`, before.packet_id, now, JSON.stringify(before), JSON.stringify({ ...before, status: "resolved", resolved_at: now, resolution_type: "authorized_override", resolution_reason: reason.trim(), resolved_by: "Program manager" }), reason.trim()),
  ]);
  return { ok: true };
}

export async function approvePacket(packetId: string) {
  const db = await ensureDatabase();
  await reconcilePacket(db, packetId);
  const blocker = await db.prepare("SELECT COUNT(*) AS count FROM packet_exceptions WHERE packet_id = ? AND severity = 1 AND status = 'open'").bind(packetId).first<{ count: number }>();
  if (blocker?.count) throw new Error("Resolve all payment blockers before approval.");
  const packet = await db.prepare("SELECT * FROM packets WHERE id = ?").bind(packetId).first<Record<string, unknown>>();
  if (!packet) throw new Error("Packet not found.");
  if (!Number(packet.invoice_amount_cents) || !packet.invoice_number) throw new Error("A detailed invoice is required before approval.");
  const documents = await rows<{ kind: string; extracted_json: string }>(db, `SELECT DISTINCT d.kind, d.extracted_json FROM documents d LEFT JOIN document_packet_links l ON l.document_id = d.id WHERE d.packet_id = ? OR l.packet_id = ?`, [packetId, packetId]);
  for (const kind of ["invoice", "timesheet", "payroll"]) if (!documents.some((document) => document.kind === kind)) throw new Error(`Approval blocked: required ${kind} evidence is missing.`);
  const unreviewed = await db.prepare(`SELECT COUNT(*) AS count FROM document_field_evidence f JOIN documents d ON d.id = f.document_id
    LEFT JOIN document_packet_links l ON l.document_id = d.id WHERE (d.packet_id = ? OR l.packet_id = ?) AND f.confidence < 80 AND f.status = 'extracted'`).bind(packetId, packetId).first<{ count: number }>();
  if (unreviewed?.count) throw new Error(`Approval blocked: ${unreviewed.count} low-confidence extracted field${unreviewed.count === 1 ? " requires" : "s require"} human review.`);
  const claims = await rows<{ claim_type: string; amount_requested_cents: number; amount_eligible_cents: number | null; status: string; supporting_document_id: string | null }>(db, "SELECT claim_type, amount_requested_cents, amount_eligible_cents, status, supporting_document_id FROM reimbursement_claims WHERE packet_id = ? AND status <> 'superseded'", [packetId]);
  const expenses = claims.filter((claim) => claim.claim_type === "business_expense");
  if (expenses.some((claim) => !claim.supporting_document_id)) throw new Error("Approval blocked: every business-expense line must be linked to its supporting document.");
  if (expenses.some((claim) => !["eligible", "ineligible"].includes(claim.status))) throw new Error("Approval blocked: every business-expense line requires a documented eligibility decision.");
  const unresolvedChecks = await db.prepare(`SELECT COUNT(*) AS count FROM eligibility_checks c JOIN reimbursement_claims r ON r.id = c.claim_id
    WHERE r.packet_id = ? AND r.status = 'eligible' AND c.result <> 'pass'`).bind(packetId).first<{ count: number }>();
  if (unresolvedChecks?.count) throw new Error("Approval blocked: an eligible business expense still has unresolved or failed governing-rule checks.");
  if (claims.length) {
    const payable = claims.filter((claim) => claim.claim_type === "intern_wages").reduce((sum, claim) => sum + Number(claim.amount_requested_cents), 0) + expenses.reduce((sum, claim) => sum + Number(claim.amount_eligible_cents ?? 0), 0);
    if (payable !== Number(packet.invoice_amount_cents)) throw new Error("Approval blocked: validated wages and eligible expenses do not equal the invoice total.");
  }
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
  operations.push(db.prepare("INSERT INTO audit_events VALUES (?, 'packet', ?, 'reimbursement_approved', 'Program manager', ?, ?, ?, NULL)")
    .bind(`audit-${crypto.randomUUID()}`, packetId, now, JSON.stringify(packet), JSON.stringify({ ...packet, status: "approved", approved_at: now })));
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
  operations.push(db.prepare("INSERT INTO audit_events VALUES (?, 'packet', ?, 'payment_recorded', 'Fiscal reviewer', ?, ?, ?, NULL)")
    .bind(`audit-${crypto.randomUUID()}`, packetId, now, JSON.stringify(packet), JSON.stringify({ ...packet, status: "paid", paid_at: now })));
  await db.batch(operations);
  return { ok: true };
}

export async function reviewReminder(reminderId: string, body?: string) {
  const db = await ensureDatabase();
  const before = await db.prepare("SELECT * FROM reminder_drafts WHERE id = ?").bind(reminderId).first<Record<string, unknown>>();
  if (!before) throw new Error("Reminder draft not found.");
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("UPDATE reminder_drafts SET body = COALESCE(?, body), status = 'reviewed', reviewed_at = ? WHERE id = ?").bind(body?.trim() || null, now, reminderId),
    db.prepare("INSERT INTO audit_events VALUES (?, 'packet', ?, 'reminder_reviewed', 'Program manager', ?, ?, ?, NULL)")
      .bind(`audit-${crypto.randomUUID()}`, before.packet_id ?? before.employer_id, now, JSON.stringify(before), JSON.stringify({ ...before, status: "reviewed", reviewed_at: now })),
  ]);
  return { ok: true };
}

export async function recordReminderCopy(reminderId: string, body?: string) {
  const db = await ensureDatabase();
  const reminder = await db.prepare("SELECT * FROM reminder_drafts WHERE id = ?").bind(reminderId).first<Record<string, unknown>>();
  if (!reminder) throw new Error("Reminder draft not found.");
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("UPDATE reminder_drafts SET body = COALESCE(?, body) WHERE id = ?").bind(body?.trim() || null, reminderId),
    db.prepare("INSERT INTO audit_events VALUES (?, 'packet', ?, 'reminder_copied', 'Program manager', ?, NULL, ?, NULL)").bind(`audit-${crypto.randomUUID()}`, reminder.packet_id ?? reminder.employer_id, now, JSON.stringify({ reminderId, subject: reminder.subject })),
  ]);
  return { ok: true };
}

export async function discardReminder(reminderId: string) {
  const db = await ensureDatabase();
  const reminder = await db.prepare("SELECT * FROM reminder_drafts WHERE id = ?").bind(reminderId).first<Record<string, unknown>>();
  if (!reminder) throw new Error("Reminder draft not found.");
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("UPDATE reminder_drafts SET status = 'discarded', reviewed_at = ? WHERE id = ?").bind(now, reminderId),
    db.prepare("INSERT INTO audit_events VALUES (?, 'packet', ?, 'reminder_discarded', 'Program manager', ?, ?, ?, NULL)").bind(`audit-${crypto.randomUUID()}`, reminder.packet_id ?? reminder.employer_id, now, JSON.stringify(reminder), JSON.stringify({ ...reminder, status: "discarded" })),
  ]);
  return { ok: true };
}

export async function generateReminderDrafts() {
  const db = await ensureDatabase();
  const settings = await db.prepare("SELECT invoice_deadline, payment_deadline FROM program_settings WHERE id = 'program-land-earn'").first<{ invoice_deadline: string; payment_deadline: string }>();
  const packets = await rows<Record<string, unknown>>(db, `SELECT p.*, e.name AS employer_name, e.contact_name, e.contact_email,
      i.supervisor_name, i.supervisor_email
    FROM packets p JOIN employers e ON e.id = p.employer_id LEFT JOIN interns i ON i.id = p.intern_id
    WHERE p.status NOT IN ('approved','paid','archived') ORDER BY p.priority, p.due_date`);
  const now = new Date().toISOString();
  let created = 0;
  let refreshed = 0;
  for (const packet of packets) {
    const issues = await rows<{ title: string; owner_role: string }>(db, "SELECT title, owner_role FROM packet_exceptions WHERE packet_id = ? AND status = 'open' ORDER BY severity, created_at", [packet.id]);
    if (!issues.length) continue;
    const invoiceMissing = issues.some((issue) => issue.title === "Detailed employer invoice missing");
    const supervisorIssues = issues.filter((issue) => issue.owner_role === "Placement supervisor").map((issue) => issue.title.toLowerCase());
    const employerIssues = [
      ...issues.filter((issue) => !["Placement supervisor", "Program manager"].includes(issue.owner_role)).map((issue) => issue.title.toLowerCase()),
      ...(!packet.supervisor_email ? supervisorIssues.map((issue) => `${issue} (please coordinate with the placement supervisor)`) : []),
    ];
    const groups = [
      { role: "Employer of record", name: String(packet.contact_name), email: String(packet.contact_email), items: employerIssues },
      { role: "Placement supervisor", name: String(packet.supervisor_name ?? ""), email: String(packet.supervisor_email ?? ""), items: supervisorIssues },
    ].filter((group) => group.items.length && group.email);
    for (const group of groups) {
      const subject = invoiceMissing && group.role === "Employer of record" ? `Land and Earn invoice needed for ${packet.period_start}–${packet.period_end}` : `Updates needed for ${packet.invoice_number ?? "Land and Earn reimbursement"}`;
      const body = `Hi ${group.name},\n\nTo keep ${packet.employer_name}'s Land and Earn reimbursement on schedule, please provide or correct the following for ${packet.period_start} through ${packet.period_end}:\n\n${group.items.map((item) => `• ${item}`).join("\n")}\n\nPlease send the updated records by ${settings?.invoice_deadline ?? "the configured invoice deadline"} so payment can be completed by ${settings?.payment_deadline ?? "the configured payment deadline"}. This draft does not include sensitive payroll values and has not been sent.\n\nThank you,\nLand and Earn`;
      const existing = await db.prepare("SELECT id, status FROM reminder_drafts WHERE packet_id = ? AND recipient_role = ? AND status IN ('draft','reviewed') ORDER BY created_at DESC LIMIT 1").bind(packet.id, group.role).first<{ id: string; status: string }>();
      if (existing?.status === "reviewed") continue;
      if (existing) {
        await db.batch([
          db.prepare("UPDATE reminder_drafts SET subject = ?, body = ?, recipient_name = ?, recipient_email = ? WHERE id = ?").bind(subject, body, group.name, group.email, existing.id),
          db.prepare("INSERT INTO audit_events VALUES (?, 'packet', ?, 'reminder_draft_refreshed', 'System', ?, NULL, ?, NULL)").bind(`audit-${crypto.randomUUID()}`, packet.id, now, JSON.stringify({ reminderId: existing.id, subject, recipientRole: group.role })),
        ]);
        refreshed += 1;
        continue;
      }
      const id = `rem-${crypto.randomUUID()}`;
      await db.batch([
        db.prepare(`INSERT INTO reminder_drafts
          (id, employer_id, packet_id, subject, body, status, created_at, reviewed_at, recipient_name, recipient_email, recipient_role)
          VALUES (?, ?, ?, ?, ?, 'draft', ?, NULL, ?, ?, ?)`)
          .bind(id, packet.employer_id, packet.id, subject, body, now, group.name, group.email, group.role),
        db.prepare("UPDATE packets SET status = 'reminder_draft_ready' WHERE id = ? AND status NOT IN ('approved','paid')").bind(packet.id),
        db.prepare("INSERT INTO audit_events VALUES (?, 'packet', ?, 'reminder_draft_created', 'System', ?, NULL, ?, NULL)").bind(`audit-${crypto.randomUUID()}`, packet.id, now, JSON.stringify({ reminderId: id, subject, recipientRole: group.role })),
      ]);
      created += 1;
    }
  }
  return { ok: true, created, refreshed };
}

export async function adjustPurchaseOrder(input: { id: string; amount?: number; reason?: string }) {
  const db = await ensureDatabase();
  const amountCents = Math.round(Number(input.amount ?? 0) * 100);
  if (!amountCents || !input.reason?.trim()) throw new Error("Enter a non-zero amendment amount and reason.");
  const po = await db.prepare("SELECT * FROM purchase_orders WHERE id = ? AND status = 'active'").bind(input.id).first<Record<string, unknown>>();
  if (!po) throw new Error("Active purchase order not found.");
  const committed = await db.prepare(`SELECT COALESCE(SUM(CASE WHEN event_type IN ('invoice_received','invoice_adjustment','invoice_voided') THEN amount_cents ELSE 0 END),0) AS total FROM po_events WHERE purchase_order_id = ?`).bind(input.id).first<{ total: number }>();
  const revisedFunding = Number(po.original_amount_cents) + Number(po.amendment_amount_cents) + amountCents;
  if (revisedFunding < Number(committed?.total ?? 0)) throw new Error("This amendment would reduce authorized funding below active invoice commitments.");
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("UPDATE purchase_orders SET amendment_amount_cents = amendment_amount_cents + ? WHERE id = ?").bind(amountCents, input.id),
    db.prepare("INSERT INTO po_events VALUES (?, ?, NULL, 'po_amendment', ?, ?, ?, 'Program manager')").bind(`evt-${crypto.randomUUID()}`, input.id, amountCents, input.reason.trim(), now.slice(0, 10)),
    db.prepare("INSERT INTO audit_events VALUES (?, 'purchase_order', ?, 'funding_amended', 'Program manager', ?, ?, ?, ?)")
      .bind(`audit-${crypto.randomUUID()}`, input.id, now, JSON.stringify(po), JSON.stringify({ amendmentDeltaCents: amountCents, revisedFundingCents: revisedFunding }), input.reason.trim()),
  ]);
  return { ok: true };
}

export async function voidInvoice(packetId: string, reason: string) {
  const db = await ensureDatabase();
  if (!reason.trim()) throw new Error("A reason is required to release invoice funding.");
  const packet = await db.prepare("SELECT * FROM packets WHERE id = ?").bind(packetId).first<Record<string, unknown>>();
  if (!packet) throw new Error("Packet not found.");
  if (packet.status === "paid") throw new Error("A paid invoice cannot be voided from this workflow.");
  const net = await db.prepare(`SELECT COALESCE(SUM(CASE WHEN event_type IN ('invoice_received','invoice_adjustment','invoice_voided') THEN amount_cents ELSE 0 END),0) AS total FROM po_events WHERE packet_id = ?`).bind(packetId).first<{ total: number }>();
  if (!net?.total) throw new Error("This invoice has no active funding commitment.");
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("INSERT INTO po_events VALUES (?, ?, ?, 'invoice_voided', ?, ?, ?, 'Program manager')").bind(`evt-${crypto.randomUUID()}`, packet.purchase_order_id, packetId, -Number(net.total), `${packet.invoice_number ?? packetId} · ${reason.trim()}`, now.slice(0, 10)),
    db.prepare("UPDATE packets SET status = 'follow_up_required' WHERE id = ?").bind(packetId),
    db.prepare("INSERT INTO audit_events VALUES (?, 'packet', ?, 'invoice_commitment_released', 'Program manager', ?, ?, ?, ?)")
      .bind(`audit-${crypto.randomUUID()}`, packetId, now, JSON.stringify(packet), JSON.stringify({ releasedCents: Number(net.total), status: "follow_up_required" }), reason.trim()),
  ]);
  return { ok: true };
}

export async function correctExtractedField(input: { id: string; value?: string; reason?: string }) {
  const db = await ensureDatabase();
  if (input.value == null || !input.reason?.trim()) throw new Error("A corrected value and reason are required.");
  const field = await db.prepare("SELECT * FROM document_field_evidence WHERE id = ?").bind(input.id).first<Record<string, unknown>>();
  if (!field) throw new Error("Extracted field not found.");
  const document = await db.prepare("SELECT * FROM documents WHERE id = ?").bind(field.document_id).first<Record<string, unknown>>();
  if (!document) throw new Error("Source document not found.");
  const extraction = JSON.parse(String(document.extracted_json || "{}")) as DocumentExtraction;
  const target = extraction.fields?.find((item) => item.name === field.field_name);
  if (target) { target.value = input.value; target.confidence = 100; target.source = `${target.source} · corrected by reviewer`; }
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("UPDATE document_field_evidence SET corrected_value_json = ?, status = 'corrected', reviewed_at = ?, reviewer = 'Program manager' WHERE id = ?").bind(JSON.stringify(input.value), now, input.id),
    db.prepare("UPDATE documents SET extracted_json = ?, status = 'reviewed' WHERE id = ?").bind(JSON.stringify(extraction), field.document_id),
    db.prepare("INSERT INTO audit_events VALUES (?, 'document', ?, 'extracted_field_corrected', 'Program manager', ?, ?, ?, ?)")
      .bind(`audit-${crypto.randomUUID()}`, field.document_id, now, JSON.stringify({ field: field.field_name, value: JSON.parse(String(field.value_json)) }), JSON.stringify({ field: field.field_name, value: input.value }), input.reason.trim()),
  ]);
  await reconcileDocumentPackets(db, String(document.id));
  return { ok: true };
}

export async function reviewExtractedField(fieldId: string) {
  const db = await ensureDatabase();
  const field = await db.prepare("SELECT * FROM document_field_evidence WHERE id = ?").bind(fieldId).first<Record<string, unknown>>();
  if (!field) throw new Error("Extracted field not found.");
  const value = JSON.parse(String(field.corrected_value_json ?? field.value_json ?? "null")) as unknown;
  if (value == null || String(value).trim() === "") throw new Error("A missing value cannot be verified. Enter a reviewer correction instead.");
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("UPDATE document_field_evidence SET status = 'reviewed', reviewed_at = ?, reviewer = 'Program manager' WHERE id = ?").bind(now, fieldId),
    db.prepare("INSERT INTO audit_events VALUES (?, 'document', ?, 'extracted_field_verified', 'Program manager', ?, NULL, ?, NULL)").bind(`audit-${crypto.randomUUID()}`, field.document_id, now, JSON.stringify({ field: field.field_name, value: JSON.parse(String(field.value_json)) })),
  ]);
  await reconcileDocumentPackets(db, String(field.document_id));
  return { ok: true };
}

export async function decideClaim(input: { id: string; decision?: string; amountEligible?: number; reason?: string }) {
  const db = await ensureDatabase();
  if (!input.reason?.trim() || !["eligible", "ineligible"].includes(String(input.decision))) throw new Error("Choose eligible or ineligible and document the reason.");
  const claim = await db.prepare("SELECT * FROM reimbursement_claims WHERE id = ? AND status <> 'superseded'").bind(input.id).first<Record<string, unknown>>();
  if (!claim) throw new Error("Reimbursement claim not found.");
  const checks = await rows<{ result: string }>(db, "SELECT result FROM eligibility_checks WHERE claim_id = ?", [input.id]);
  if (input.decision === "eligible" && (!checks.length || checks.some((check) => check.result !== "pass"))) throw new Error("Every IRS, federal/ARC, grant/budget, and MOU check must pass before the expense can be marked eligible.");
  if (input.decision === "ineligible" && checks.length && !checks.some((check) => check.result === "fail")) throw new Error("Record the controlling failed rule before marking the expense ineligible.");
  const eligibleCents = input.decision === "eligible" ? Math.round(Number(input.amountEligible ?? Number(claim.amount_requested_cents) / 100) * 100) : 0;
  if (eligibleCents < 0 || eligibleCents > Number(claim.amount_requested_cents)) throw new Error("Eligible amount cannot exceed the requested amount.");
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("UPDATE reimbursement_claims SET status = ?, amount_eligible_cents = ? WHERE id = ?").bind(input.decision, eligibleCents, input.id),
    db.prepare("UPDATE eligibility_checks SET reviewer = 'Program manager', reviewed_at = ? WHERE claim_id = ?").bind(now, input.id),
    db.prepare("INSERT INTO audit_events VALUES (?, 'packet', ?, 'business_expense_decided', 'Program manager', ?, ?, ?, ?)")
      .bind(`audit-${crypto.randomUUID()}`, claim.packet_id, now, JSON.stringify(claim), JSON.stringify({ decision: input.decision, amountEligibleCents: eligibleCents }), input.reason.trim()),
  ]);
  await reconcilePacket(db, String(claim.packet_id));
  return { ok: true };
}

export async function decideEligibilityCheck(input: { id: string; result?: string; reason?: string }) {
  const db = await ensureDatabase();
  if (!["pass", "fail"].includes(String(input.result)) || !input.reason?.trim()) throw new Error("Choose pass or fail and cite the evidence or controlling rule.");
  const check = await db.prepare(`SELECT c.*, r.packet_id FROM eligibility_checks c JOIN reimbursement_claims r ON r.id = c.claim_id WHERE c.id = ? AND r.status <> 'superseded'`).bind(input.id).first<Record<string, unknown>>();
  if (!check) throw new Error("Eligibility check not found.");
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("UPDATE eligibility_checks SET result = ?, reason = ?, confidence = 100, reviewer = 'Program manager', reviewed_at = ? WHERE id = ?").bind(input.result, input.reason.trim(), now, input.id),
    db.prepare("INSERT INTO audit_events VALUES (?, 'packet', ?, 'eligibility_check_decided', 'Program manager', ?, ?, ?, ?)")
      .bind(`audit-${crypto.randomUUID()}`, check.packet_id, now, JSON.stringify(check), JSON.stringify({ result: input.result }), input.reason.trim()),
  ]);
  await reconcilePacket(db, String(check.packet_id));
  return { ok: true };
}

export async function linkClaimSupportingDocument(input: { id: string; documentId?: string }) {
  const db = await ensureDatabase();
  if (!input.documentId) throw new Error("Choose a supporting document.");
  const claim = await db.prepare("SELECT * FROM reimbursement_claims WHERE id = ? AND claim_type = 'business_expense' AND status <> 'superseded'").bind(input.id).first<Record<string, unknown>>();
  if (!claim) throw new Error("Business-expense claim not found.");
  const document = await db.prepare(`SELECT d.* FROM documents d LEFT JOIN document_packet_links l ON l.document_id = d.id
    WHERE d.id = ? AND (d.packet_id = ? OR l.packet_id = ?) LIMIT 1`).bind(input.documentId, claim.packet_id, claim.packet_id).first<Record<string, unknown>>();
  if (!document) throw new Error("The supporting document must be linked to the same reimbursement packet.");
  if (!["business_expense", "unknown"].includes(String(document.kind))) throw new Error("Choose a receipt, expense report, or other business-expense supporting record.");
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("UPDATE reimbursement_claims SET supporting_document_id = ? WHERE id = ?").bind(input.documentId, input.id),
    db.prepare("INSERT INTO audit_events VALUES (?, 'packet', ?, 'expense_support_linked', 'Program manager', ?, ?, ?, NULL)")
      .bind(`audit-${crypto.randomUUID()}`, claim.packet_id, now, JSON.stringify({ supportingDocumentId: claim.supporting_document_id }), JSON.stringify({ claimId: input.id, supportingDocumentId: input.documentId, fileName: document.file_name })),
  ]);
  await reconcilePacket(db, String(claim.packet_id));
  return { ok: true };
}

export async function linkDocumentToPacket(input: { id: string; packetId?: string }) {
  const db = await ensureDatabase();
  if (!input.packetId) throw new Error("Choose a reimbursement packet.");
  const document = await db.prepare("SELECT * FROM documents WHERE id = ?").bind(input.id).first<Record<string, unknown>>();
  const packet = await db.prepare("SELECT * FROM packets WHERE id = ?").bind(input.packetId).first<Record<string, unknown>>();
  if (!document || !packet) throw new Error("Document or packet not found.");
  if (document.employer_id !== packet.employer_id) throw new Error("The document and packet must belong to the same employer.");
  const existing = await db.prepare("SELECT id FROM document_packet_links WHERE document_id = ? AND packet_id = ?").bind(input.id, input.packetId).first();
  if (existing) return { ok: true };
  const now = new Date().toISOString();
  const operations: D1PreparedStatement[] = [
    db.prepare("INSERT INTO document_packet_links VALUES (?, ?, ?, ?, ?, 'Program manager')").bind(`link-${crypto.randomUUID()}`, input.id, input.packetId, document.packet_id ? 0 : 1, now),
    db.prepare("UPDATE documents SET packet_id = COALESCE(packet_id, ?) WHERE id = ?").bind(input.packetId, input.id),
    db.prepare("INSERT INTO audit_events VALUES (?, 'document', ?, 'linked_to_packet', 'Program manager', ?, NULL, ?, NULL)").bind(`audit-${crypto.randomUUID()}`, input.id, now, JSON.stringify({ packetId: input.packetId })),
  ];
  if (document.kind === "invoice" && Number(document.amount_cents) > 0) {
    const commitmentPacketId = String(document.packet_id ?? input.packetId);
    const ledger = await db.prepare("SELECT id FROM po_events WHERE packet_id = ? AND event_type = 'invoice_received'").bind(commitmentPacketId).first();
    if (!ledger) {
      operations.push(db.prepare("INSERT INTO po_events VALUES (?, ?, ?, 'invoice_received', ?, ?, ?, 'Document triage')").bind(`evt-${crypto.randomUUID()}`, packet.purchase_order_id, input.packetId, document.amount_cents, packet.invoice_number ?? document.file_name, now.slice(0, 10)));
      operations.push(db.prepare("UPDATE packets SET invoice_amount_cents = ?, received_at = COALESCE(received_at, ?), status = 'needs_review' WHERE id = ?").bind(document.amount_cents, now, input.packetId));
    }
  }
  await db.batch(operations);
  await reconcilePacket(db, input.packetId);
  return { ok: true };
}

export async function createEmployer(input: Record<string, unknown>) {
  const db = await ensureDatabase();
  const name = String(input.name ?? "").trim();
  const county = String(input.county ?? "").trim();
  const contactName = String(input.contactName ?? "").trim();
  const contactEmail = String(input.contactEmail ?? "").trim();
  const poNumber = String(input.poNumber ?? "").trim();
  const originalCents = Math.round(Number(input.originalFunding ?? 0) * 100);
  const mouCode = String(input.mouCode ?? "").trim();
  if (!name || !county || !contactName || !contactEmail || !poNumber || !originalCents || !mouCode) throw new Error("Complete all employer, contact, MOU, and purchase-order fields.");
  const id = `emp-${crypto.randomUUID()}`; const poId = `po-${crypto.randomUUID()}`; const mouId = `mou-${crypto.randomUUID()}`; const now = new Date().toISOString();
  const arrangement = String(input.arrangement ?? "Employer of record and placement");
  const effectiveStart = String(input.effectiveStart ?? "2025-07-01"); const effectiveEnd = String(input.effectiveEnd ?? "2026-06-30");
  const allowed = String(input.allowedExpenses ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  await db.batch([
    db.prepare("INSERT INTO employers VALUES (?, ?, ?, ?, ?, ?, ?, 'current', ?)").bind(id, name, county, contactName, contactEmail, arrangement, mouCode, String(input.paySchedule ?? "Biweekly")),
    db.prepare(`INSERT INTO purchase_orders
      (id, employer_id, po_number, original_amount_cents, amendment_amount_cents, status, issued_at, effective_end)
      VALUES (?, ?, ?, ?, 0, 'active', ?, ?)`).bind(poId, id, poNumber, originalCents, effectiveStart, effectiveEnd),
    db.prepare("INSERT INTO mous VALUES (?, ?, ?, '1', ?, ?, 'current', ?, '{}', '[]', '[\"Itemized receipt\",\"Proof of payment\",\"Business purpose\"]', NULL, ?)").bind(mouId, id, mouCode, effectiveStart, effectiveEnd, JSON.stringify(allowed), now),
    db.prepare("INSERT INTO audit_events VALUES (?, 'employer', ?, 'employer_created', 'Program manager', ?, NULL, ?, NULL)").bind(`audit-${crypto.randomUUID()}`, id, now, JSON.stringify({ name, county, poNumber, originalFunding: Number(input.originalFunding), mouCode })),
  ]);
  return { ok: true, id };
}

export async function updateEmployer(input: Record<string, unknown>) {
  const db = await ensureDatabase();
  const id = String(input.id ?? "");
  const before = await db.prepare(`SELECT e.*, po.id AS purchase_order_id, po.po_number, po.issued_at, po.effective_end
    FROM employers e JOIN purchase_orders po ON po.employer_id = e.id AND po.status = 'active' WHERE e.id = ?`).bind(id).first<Record<string, unknown>>();
  if (!before) throw new Error("Employer or active purchase order not found.");
  const values = {
    name: String(input.name ?? "").trim(), county: String(input.county ?? "").trim(),
    contactName: String(input.contactName ?? "").trim(), contactEmail: String(input.contactEmail ?? "").trim(),
    arrangement: String(input.arrangement ?? "").trim(), paySchedule: String(input.paySchedule ?? "").trim(),
    poNumber: String(input.poNumber ?? "").trim(), issuedAt: String(input.issuedAt ?? ""), effectiveEnd: String(input.effectiveEnd ?? ""),
  };
  if (Object.values(values).some((value) => !value) || !values.contactEmail.includes("@") || values.effectiveEnd < values.issuedAt) throw new Error("Complete valid employer, contact, payroll, and purchase-order details.");
  const poDocumentId = String(input.poDocumentId ?? "") || null;
  if (poDocumentId) {
    const source = await db.prepare("SELECT id FROM documents WHERE id = ? AND employer_id = ? AND kind = 'purchase_order'").bind(poDocumentId, id).first();
    if (!source) throw new Error("The purchase-order source must be a purchase-order document for this employer.");
  }
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("UPDATE employers SET name = ?, county = ?, contact_name = ?, contact_email = ?, arrangement = ?, pay_schedule = ? WHERE id = ?")
      .bind(values.name, values.county, values.contactName, values.contactEmail, values.arrangement, values.paySchedule, id),
    db.prepare("UPDATE purchase_orders SET po_number = ?, issued_at = ?, effective_end = ?, document_id = COALESCE(?, document_id) WHERE id = ?")
      .bind(values.poNumber, values.issuedAt, values.effectiveEnd, poDocumentId, before.purchase_order_id),
    db.prepare("INSERT INTO audit_events VALUES (?, 'employer', ?, 'employer_and_po_updated', 'Program manager', ?, ?, ?, NULL)")
      .bind(`audit-${crypto.randomUUID()}`, id, now, JSON.stringify(before), JSON.stringify({ ...values, poDocumentId })),
  ]);
  return { ok: true };
}

export async function createPacket(input: Record<string, unknown>) {
  const db = await ensureDatabase();
  const employerId = String(input.employerId ?? ""); const internName = String(input.internName ?? "").trim();
  const county = String(input.county ?? "").trim(); const placement = String(input.placement ?? "").trim();
  const periodStart = String(input.periodStart ?? ""); const periodEnd = String(input.periodEnd ?? "");
  if (!employerId || !internName || !county || !placement || !periodStart || !periodEnd || periodEnd < periodStart) throw new Error("Complete the employer, intern, placement, and valid reimbursement period.");
  const employer = await db.prepare("SELECT * FROM employers WHERE id = ?").bind(employerId).first<Record<string, unknown>>();
  if (!employer) throw new Error("Employer not found.");
  const purchaseOrders = await rows<Record<string, unknown>>(db, "SELECT * FROM purchase_orders WHERE employer_id = ? AND status = 'active' AND issued_at <= ? AND effective_end >= ?", [employerId, periodEnd, periodStart]);
  if (purchaseOrders.length !== 1) throw new Error("The employer must have exactly one active Land and Earn purchase order covering this reimbursement period.");
  const duplicate = await db.prepare("SELECT p.id AS id FROM packets p JOIN interns i ON i.id = p.intern_id WHERE p.employer_id = ? AND lower(i.name) = lower(?) AND p.period_start = ? AND p.period_end = ?").bind(employerId, internName, periodStart, periodEnd).first();
  if (duplicate) throw new Error("A packet already exists for this intern and reimbursement period.");
  const internId = `int-${crypto.randomUUID()}`; const packetId = `pkt-${crypto.randomUUID()}`; const now = new Date().toISOString();
  const settings = await db.prepare("SELECT invoice_deadline FROM program_settings WHERE id = 'program-land-earn'").first<{ invoice_deadline: string }>();
  await db.batch([
    db.prepare("INSERT INTO interns (id, employer_id, name, county, placement, supervisor_name, supervisor_email) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(internId, employerId, internName, county, placement, String(input.supervisorName ?? "") || null, String(input.supervisorEmail ?? "") || null),
    db.prepare(`INSERT INTO packets
      (id, employer_id, purchase_order_id, intern_id, label, period_start, period_end, status, priority, due_date,
       invoice_number, invoice_amount_cents, wage_amount_cents, business_amount_cents, confidence, received_at, approved_at, paid_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'invoice_not_received', 2, ?, NULL, 0, 0, 0, 0, NULL, NULL, NULL)`)
      .bind(packetId, employerId, purchaseOrders[0].id, internId, `${periodStart}–${periodEnd} reimbursement · ${internName}`, periodStart, periodEnd, settings?.invoice_deadline ?? periodEnd),
    db.prepare("INSERT INTO audit_events VALUES (?, 'packet', ?, 'packet_created', 'Program manager', ?, NULL, ?, NULL)").bind(`audit-${crypto.randomUUID()}`, packetId, now, JSON.stringify({ employerId, internName, placement, periodStart, periodEnd, purchaseOrderId: purchaseOrders[0].id })),
  ]);
  await reconcilePacket(db, packetId);
  return { ok: true, id: packetId };
}

export async function createMouVersion(input: Record<string, unknown>) {
  const db = await ensureDatabase();
  const employerId = String(input.employerId ?? ""); const code = String(input.code ?? "").trim(); const version = String(input.version ?? "").trim();
  const effectiveStart = String(input.effectiveStart ?? ""); const effectiveEnd = String(input.effectiveEnd ?? "");
  if (!employerId || !code || !version || !effectiveStart || !effectiveEnd || effectiveEnd < effectiveStart) throw new Error("Complete the employer, MOU code, version, and valid effective period.");
  const employer = await db.prepare("SELECT id FROM employers WHERE id = ?").bind(employerId).first(); if (!employer) throw new Error("Employer not found.");
  const documentId = String(input.documentId ?? "") || null;
  if (documentId) {
    const source = await db.prepare("SELECT id FROM documents WHERE id = ? AND employer_id = ? AND kind = 'mou'").bind(documentId, employerId).first();
    if (!source) throw new Error("The MOU source must be an MOU document for this employer.");
  }
  const allowed = String(input.allowedExpenses ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  const conditions = String(input.conditions ?? "").split(";").map((item) => item.trim()).filter(Boolean);
  const evidence = String(input.evidenceRequirements ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  let limits: Record<string, number> = {};
  if (String(input.limits ?? "").trim()) { try { limits = JSON.parse(String(input.limits)) as Record<string, number>; } catch { throw new Error("MOU limits must be valid JSON, for example {\"Required training\": 1500}."); } }
  const id = `mou-${crypto.randomUUID()}`; const now = new Date().toISOString();
  await db.batch([
    db.prepare("UPDATE mous SET status = 'superseded' WHERE employer_id = ? AND status = 'current'").bind(employerId),
    db.prepare(`INSERT INTO mous
      (id, employer_id, code, version, effective_start, effective_end, status, allowed_expenses_json,
       limits_json, conditions_json, evidence_requirements_json, document_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'current', ?, ?, ?, ?, ?, ?)`).bind(id, employerId, code, version, effectiveStart, effectiveEnd, JSON.stringify(allowed), JSON.stringify(limits), JSON.stringify(conditions), JSON.stringify(evidence), documentId, now),
    db.prepare("UPDATE employers SET mou_code = ?, mou_status = 'current' WHERE id = ?").bind(code, employerId),
    db.prepare("INSERT INTO audit_events VALUES (?, 'employer', ?, 'mou_version_created', 'Program manager', ?, NULL, ?, NULL)").bind(`audit-${crypto.randomUUID()}`, employerId, now, JSON.stringify({ mouId: id, code, version, effectiveStart, effectiveEnd, allowed, limits, conditions, evidence, documentId })),
  ]);
  return { ok: true, id };
}

export async function updateProgramSettings(input: Record<string, unknown>) {
  const db = await ensureDatabase();
  const before = await db.prepare("SELECT * FROM program_settings WHERE id = 'program-land-earn'").first<Record<string, unknown>>();
  const hourlyRateCents = Math.round(Number(input.hourlyRate ?? 0) * 100);
  const retentionYears = Number(input.retentionYears ?? 7); const poWarningPercent = Number(input.poWarningPercent ?? 15);
  if (!hourlyRateCents || retentionYears < 7 || poWarningPercent < 0 || poWarningPercent > 100) throw new Error("Enter valid program settings; retention must be at least seven years.");
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`UPDATE program_settings SET hourly_rate_cents = ?, fiscal_year_start = ?, fiscal_year_end = ?, invoice_deadline = ?, payment_deadline = ?, retention_years = ?, po_warning_percent = ? WHERE id = 'program-land-earn'`)
      .bind(hourlyRateCents, input.fiscalYearStart, input.fiscalYearEnd, input.invoiceDeadline, input.paymentDeadline, retentionYears, poWarningPercent),
    db.prepare("INSERT INTO audit_events VALUES (?, 'program', 'program-land-earn', 'settings_updated', 'Program manager', ?, ?, ?, NULL)").bind(`audit-${crypto.randomUUID()}`, now, JSON.stringify(before), JSON.stringify(input)),
  ]);
  return { ok: true };
}

function extractedValue(extraction: DocumentExtraction, name: string) {
  return extraction.fields?.find((field) => field.name === name)?.value ?? null;
}

function numericExtractedValue(extraction: DocumentExtraction, name: string) {
  const value = extractedValue(extraction, name);
  if (!value) return null;
  const number = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(number) ? number : null;
}

async function upsertSystemException(db: Db, packetId: string, title: string, detail: string, severity = 1, ownerRole = "Program manager") {
  const existing = await db.prepare("SELECT id, status, resolution_type FROM packet_exceptions WHERE packet_id = ? AND title = ? ORDER BY created_at DESC LIMIT 1").bind(packetId, title).first<{ id: string; status: string; resolution_type: string | null }>();
  const now = new Date().toISOString();
  if (existing?.status === "resolved" && existing.resolution_type === "authorized_override") return;
  if (existing?.status === "open") {
    await db.prepare("UPDATE packet_exceptions SET detail = ?, severity = ?, owner_role = ? WHERE id = ?").bind(detail, severity, ownerRole, existing.id).run();
    return;
  }
  await db.prepare(`INSERT INTO packet_exceptions
    (id, packet_id, severity, title, detail, owner_role, status, created_at, resolved_at, resolution_type, resolution_reason, resolved_by)
    VALUES (?, ?, ?, ?, ?, ?, 'open', ?, NULL, NULL, NULL, NULL)`)
    .bind(`exc-${crypto.randomUUID()}`, packetId, severity, title, detail, ownerRole, now).run();
}

async function clearSystemException(db: Db, packetId: string, title: string) {
  await db.prepare("UPDATE packet_exceptions SET status = 'resolved', resolved_at = ?, resolution_type = 'evidence_received', resolution_reason = 'Automated validation now passes', resolved_by = 'System' WHERE packet_id = ? AND title = ? AND status = 'open'")
    .bind(new Date().toISOString(), packetId, title).run();
}

async function reconcileDocumentPackets(db: Db, documentId: string) {
  const linked = await rows<{ packet_id: string }>(db, `SELECT packet_id FROM documents WHERE id = ? AND packet_id IS NOT NULL
    UNION SELECT packet_id FROM document_packet_links WHERE document_id = ?`, [documentId, documentId]);
  for (const item of linked) await reconcilePacket(db, item.packet_id);
}

async function reconcilePacket(db: Db, packetId: string) {
  const docs = await rows<{ id: string; kind: string; extracted_json: string; uploaded_at: string }>(db, `SELECT DISTINCT d.id, d.kind, d.extracted_json, d.uploaded_at FROM documents d
    LEFT JOIN document_packet_links l ON l.document_id = d.id WHERE d.packet_id = ? OR l.packet_id = ? ORDER BY d.uploaded_at`, [packetId, packetId]);
  const byKind = new Map(docs.map((document) => [document.kind, document]));
  const required: Array<[string, string]> = [["invoice", "Detailed employer invoice missing"], ["payroll", "Payroll evidence missing"], ["timesheet", "Time record missing"]];
  for (const [kind, title] of required) {
    if (!byKind.has(kind)) await upsertSystemException(db, packetId, title, `Add the required ${kind === "timesheet" ? "completed timesheet or digital time record" : kind} before reimbursement.`, 1, "Employer of record");
    else await clearSystemException(db, packetId, title);
  }
  const timeDocument = byKind.get("timesheet");
  const time = timeDocument ? JSON.parse(timeDocument.extracted_json || "{}") as DocumentExtraction : undefined;
  const payrollDocument = byKind.get("payroll");
  const payroll = payrollDocument ? JSON.parse(payrollDocument.extracted_json || "{}") as DocumentExtraction : undefined;
  const invoiceDocument = byKind.get("invoice");
  const invoice = invoiceDocument ? JSON.parse(invoiceDocument.extracted_json || "{}") as DocumentExtraction : undefined;
  if (invoice) {
    const required: Array<[string, string]> = [
      ["employerLegalName", "Employer legal name missing"], ["employerAddress", "Employer address missing"],
      ["invoiceNumber", "Invoice number missing"], ["invoiceDate", "Invoice date missing"],
      ["periodStart", "Invoice service-period start missing"], ["periodEnd", "Invoice service-period end missing"],
      ["invoiceAmount", "Invoice total missing"], ["signingAuthorityName", "Signing authority name missing"],
      ["signingAuthorityTitle", "Signing authority title missing"], ["authorizedSignaturePresent", "Authorized signature missing"],
    ];
    for (const [field, title] of required) {
      const value = extractedValue(invoice, field);
      if (!value || value === "false") await upsertSystemException(db, packetId, title, `The invoice does not contain a verified ${field.replace(/([A-Z])/g, " $1").toLowerCase()}. Return it for correction or record a reviewer correction.`, 1, "Employer of record");
      else await clearSystemException(db, packetId, title);
    }
  }
  if (time) {
    for (const [field, title] of [["totalHours", "Timesheet total hours unavailable"], ["internSignaturePresent", "Intern signature missing"], ["supervisorSignaturePresent", "Supervisor signature missing"]] as Array<[string, string]>) {
      const value = extractedValue(time, field);
      if (!value || value === "false") await upsertSystemException(db, packetId, title, `The time record does not contain a verified ${field.replace(/([A-Z])/g, " $1").toLowerCase()}.`, 1, title.startsWith("Supervisor") ? "Placement supervisor" : "Employer of record");
      else await clearSystemException(db, packetId, title);
    }
    let activities = await rows<{ hours: number }>(db, "SELECT hours FROM activity_hours WHERE packet_id = ? AND document_id = ?", [packetId, timeDocument?.id]);
    if (!activities.length) activities = await rows<{ hours: number }>(db, "SELECT hours FROM activity_hours WHERE packet_id = ? AND document_id IS NULL", [packetId]);
    const categorized = activities.reduce((sum, activity) => sum + Number(activity.hours), 0);
    const timeHours = numericExtractedValue(time, "totalHours");
    if (!activities.length) await upsertSystemException(db, packetId, "Activity allocation unavailable", "Classify the supporting-document hours as job placement, community engagement, storytelling, soft skills, or another approved category.", 1);
    else await clearSystemException(db, packetId, "Activity allocation unavailable");
    if (timeHours != null && Math.abs(categorized - timeHours) > 0.01) await upsertSystemException(db, packetId, "Activity hours do not equal total time", `Categorized activities total ${categorized} hours while the time record total is ${timeHours}.`, 1);
    else if (timeHours != null && activities.length) await clearSystemException(db, packetId, "Activity hours do not equal total time");
  }
  if (payroll) {
    for (const [field, title] of [["totalHours", "Payroll paid hours unavailable"], ["hourlyRate", "Payroll hourly rate unavailable"], ["grossPay", "Payroll gross pay unavailable"]] as Array<[string, string]>) {
      const value = extractedValue(payroll, field);
      if (!value) await upsertSystemException(db, packetId, title, `Payroll evidence does not contain a verified ${field.replace(/([A-Z])/g, " $1").toLowerCase()}.`, 1, "Employer of record");
      else await clearSystemException(db, packetId, title);
    }
  }
  if (time && payroll) {
    const timeHours = numericExtractedValue(time, "totalHours");
    const payrollHours = numericExtractedValue(payroll, "totalHours");
    const title = "Timesheet and paid hours do not match";
    if (timeHours != null && payrollHours != null && Math.abs(timeHours - payrollHours) > 0.01) {
      await upsertSystemException(db, packetId, title, `The time record shows ${timeHours} hours while payroll shows ${payrollHours}. Resolve the ${Math.abs(timeHours - payrollHours).toFixed(2)}-hour difference.`, 1);
    } else if (timeHours != null && payrollHours != null) await clearSystemException(db, packetId, title);
    const grossPay = numericExtractedValue(payroll, "grossPay");
    if (payrollHours != null && grossPay != null) {
      const setting = await db.prepare("SELECT hourly_rate_cents FROM program_settings WHERE id = 'program-land-earn'").first<{ hourly_rate_cents: number }>();
      const expected = payrollHours * Number(setting?.hourly_rate_cents ?? 1600) / 100;
      const payTitle = "Payroll gross does not match paid hours";
      if (Math.abs(expected - grossPay) > 0.01) await upsertSystemException(db, packetId, payTitle, `${payrollHours} paid hours at the program rate should equal $${expected.toFixed(2)}; payroll shows $${grossPay.toFixed(2)}.`, 1);
      else await clearSystemException(db, packetId, payTitle);
    }
  }
  const packet = await db.prepare("SELECT * FROM packets WHERE id = ?").bind(packetId).first<Record<string, unknown>>();
  const claims = await rows<{ claim_type: string; amount_requested_cents: number; amount_eligible_cents: number | null; status: string; supporting_document_id: string | null }>(db, "SELECT claim_type, amount_requested_cents, amount_eligible_cents, status, supporting_document_id FROM reimbursement_claims WHERE packet_id = ? AND status <> 'superseded'", [packetId]);
  const expenseClaims = claims.filter((claim) => claim.claim_type === "business_expense");
  if (expenseClaims.length) {
    const unresolved = expenseClaims.filter((claim) => !["eligible", "ineligible"].includes(claim.status));
    if (unresolved.length) await upsertSystemException(db, packetId, "Business expense eligibility review required", `${unresolved.length} business-expense line${unresolved.length === 1 ? " requires" : "s require"} a documented decision against IRS, federal/ARC, grant/budget, and MOU evidence.`, 1);
    else await clearSystemException(db, packetId, "Business expense eligibility review required");
    const missingSupport = expenseClaims.filter((claim) => !claim.supporting_document_id);
    if (missingSupport.length) await upsertSystemException(db, packetId, "Business expense supporting evidence missing", `${missingSupport.length} business-expense line${missingSupport.length === 1 ? " is" : "s are"} not linked to a receipt, proof of payment, or explanatory supporting record.`, 1, "Employer of record");
    else await clearSystemException(db, packetId, "Business expense supporting evidence missing");
    const mou = packet ? await db.prepare(`SELECT id FROM mous WHERE employer_id = ? AND effective_start <= ? AND effective_end >= ?
      ORDER BY CASE status WHEN 'current' THEN 0 ELSE 1 END, effective_start DESC LIMIT 1`).bind(packet.employer_id, packet.period_end, packet.period_start).first() : null;
    if (!mou) await upsertSystemException(db, packetId, "Applicable employer MOU missing", "A current MOU covering the reimbursement period is required for business-expense eligibility.", 1);
    else await clearSystemException(db, packetId, "Applicable employer MOU missing");
  }
  if (packet && claims.length) {
    const wage = claims.filter((claim) => claim.claim_type === "intern_wages").reduce((sum, claim) => sum + Number(claim.amount_requested_cents), 0);
    const eligibleExpense = expenseClaims.reduce((sum, claim) => sum + Number(claim.amount_eligible_cents ?? 0), 0);
    const claimTotal = wage + eligibleExpense;
    if (claimTotal !== Number(packet.invoice_amount_cents)) await upsertSystemException(db, packetId, "Payable claims do not equal invoice total", `Validated wages and eligible business expenses total $${(claimTotal / 100).toFixed(2)} while the invoice requests $${(Number(packet.invoice_amount_cents) / 100).toFixed(2)}.`, 1);
    else await clearSystemException(db, packetId, "Payable claims do not equal invoice total");
  }
  if (packet) {
    const purchaseOrder = await db.prepare("SELECT status, issued_at, effective_end FROM purchase_orders WHERE id = ?").bind(packet.purchase_order_id).first<{ status: string; issued_at: string; effective_end: string }>();
    if (!purchaseOrder || purchaseOrder.status !== "active") {
      await upsertSystemException(db, packetId, "Active purchase order missing", "Link the invoice to an active purchase order before reimbursement.", 1);
      await clearSystemException(db, packetId, "Purchase order does not cover reimbursement period");
    } else if (purchaseOrder.issued_at > String(packet.period_end) || purchaseOrder.effective_end < String(packet.period_start)) {
      await clearSystemException(db, packetId, "Active purchase order missing");
      await upsertSystemException(db, packetId, "Purchase order does not cover reimbursement period", `The linked purchase order is effective ${purchaseOrder.issued_at} through ${purchaseOrder.effective_end}, outside the packet period ${packet.period_start} through ${packet.period_end}.`, 1);
    }
    else {
      await clearSystemException(db, packetId, "Active purchase order missing");
      await clearSystemException(db, packetId, "Purchase order does not cover reimbursement period");
    }
    const funding = await db.prepare(`SELECT po.original_amount_cents + po.amendment_amount_cents AS funding_cents,
      COALESCE(SUM(CASE WHEN pe.event_type IN ('invoice_received','invoice_adjustment','invoice_voided') THEN pe.amount_cents ELSE 0 END),0) AS committed_cents
      FROM purchase_orders po LEFT JOIN po_events pe ON pe.purchase_order_id = po.id WHERE po.id = ? GROUP BY po.id`).bind(packet.purchase_order_id).first<{ funding_cents: number; committed_cents: number }>();
    if (funding && Number(funding.committed_cents) > Number(funding.funding_cents)) await upsertSystemException(db, packetId, "Purchase order funding exceeded", `Active invoice commitments exceed current PO funding by $${((Number(funding.committed_cents) - Number(funding.funding_cents)) / 100).toFixed(2)}.`, 1);
    else await clearSystemException(db, packetId, "Purchase order funding exceeded");
  }
  const open = await db.prepare("SELECT COUNT(*) AS count FROM packet_exceptions WHERE packet_id = ? AND severity = 1 AND status = 'open'").bind(packetId).first<{ count: number }>();
  const review = await db.prepare(`SELECT
      (SELECT COUNT(*) FROM document_field_evidence f JOIN documents d ON d.id = f.document_id LEFT JOIN document_packet_links l ON l.document_id = d.id WHERE (d.packet_id = ? OR l.packet_id = ?) AND f.confidence < 80 AND f.status = 'extracted') +
      (SELECT COUNT(*) FROM reimbursement_claims WHERE packet_id = ? AND claim_type = 'business_expense' AND status NOT IN ('eligible','ineligible','superseded')) AS count`).bind(packetId, packetId, packetId).first<{ count: number }>();
  const nextStatus = Number(open?.count ?? 0) > 0 ? "follow_up_required" : Number(review?.count ?? 0) > 0 ? "needs_review" : "ready_for_approval";
  await db.prepare("UPDATE packets SET status = ? WHERE id = ? AND status NOT IN ('approved','paid')").bind(nextStatus, packetId).run();
}

async function storeOneDocument(db: Db, file: File, form: FormData) {
  const employerId = String(form.get("employerId") ?? "");
  const packetId = String(form.get("packetId") ?? "") || null;
  const kind = String(form.get("kind") ?? "unknown");
  const amountText = String(form.get("amount") ?? "").trim().replace(/[$,]/g, "");
  const amount = amountText ? Number(amountText) : null;
  const amountCents = amount == null || !Number.isFinite(amount) ? null : Math.round(amount * 100);
  if (!employerId) throw new Error("Choose an employer.");
  if (!file.name || file.size === 0) throw new Error("Empty files cannot be processed.");
  const allowedExtensions = new Set(["pdf", "png", "jpg", "jpeg", "webp", "csv", "tsv", "xlsx", "xls", "doc", "docx", "txt", "rtf"]);
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  if (!allowedExtensions.has(extension)) throw new Error(`${file.name} is not a supported document type.`);
  if (amountText && amountCents == null) throw new Error("Enter a valid document amount.");
  const packet = packetId
    ? await db.prepare("SELECT * FROM packets WHERE id = ?").bind(packetId).first<Record<string, unknown>>()
    : null;
  if (packetId && !packet) throw new Error("The selected reimbursement packet no longer exists.");
  if (packet && String(packet.employer_id) !== employerId) throw new Error("The packet must belong to the selected employer.");
  const contentHash = await sha256(file);
  const duplicate = await db.prepare("SELECT id, file_name, packet_id FROM documents WHERE content_hash = ? LIMIT 1").bind(contentHash).first<{ id: string; file_name: string; packet_id: string | null }>();
  if (duplicate) {
    if (packetId) {
      const linked = await db.prepare("SELECT id FROM document_packet_links WHERE document_id = ? AND packet_id = ?").bind(duplicate.id, packetId).first();
      if (!linked) await db.prepare("INSERT INTO document_packet_links VALUES (?, ?, ?, 0, ?, 'Program manager')").bind(`link-${crypto.randomUUID()}`, duplicate.id, packetId, new Date().toISOString()).run();
    }
    return { id: duplicate.id, fileName: duplicate.file_name, kind, status: "duplicate", duplicate: true };
  }
  const extraction = await extractDocument(file, kind, {
    enabled: env.AI_EXTRACTION_ENABLED === "true",
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
  });
  const detectedKind = extraction.documentType === "unknown" ? kind : extraction.documentType;
  const extractedAmount = numericExtractedValue(extraction, "invoiceAmount");
  const effectiveAmountCents = amountCents ?? (extractedAmount == null ? null : Math.round(extractedAmount * 100));
  const requiredFieldsByKind: Record<string, string[]> = {
    invoice: ["employerLegalName", "employerAddress", "invoiceNumber", "invoiceDate", "periodStart", "periodEnd", "invoiceAmount", "signingAuthorityName", "signingAuthorityTitle", "authorizedSignaturePresent"],
    timesheet: ["totalHours", "internSignaturePresent", "supervisorSignaturePresent"],
    payroll: ["totalHours", "hourlyRate", "grossPay"],
    purchase_order: ["purchaseOrderNumber", "originalAmount", "effectiveDate"],
  };
  for (const fieldName of requiredFieldsByKind[detectedKind] ?? []) {
    if (!extraction.fields.some((field) => field.name === fieldName)) extraction.fields.push({ name: fieldName, value: "", confidence: 0, source: "Not found in source" });
  }
  if (detectedKind === "invoice" && amountCents && !extractedValue(extraction, "invoiceAmount")) {
    const amountField = extraction.fields.find((field) => field.name === "invoiceAmount");
    if (amountField) Object.assign(amountField, { value: (amountCents / 100).toFixed(2), confidence: 100, source: "Uploader-entered invoice total" });
  }
  if (detectedKind === "invoice" && packet && (!effectiveAmountCents || effectiveAmountCents <= 0)) {
    extraction.warnings.push("Invoice total was not found; enter it during review before the invoice can reserve PO funding.");
  }
  const id = `doc-${crypto.randomUUID()}`;
  const key = `${employerId}/${new Date().toISOString().slice(0, 10)}/${id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  if (env.FILES) await env.FILES.put(key, file.stream(), { httpMetadata: { contentType: file.type || "application/octet-stream" } });
  const now = new Date().toISOString();
  const status = extraction.classificationConfidence >= 85 && extraction.fields.every((field) => field.confidence >= 80) ? "extracted" : "needs_review";
  const operations: D1PreparedStatement[] = [db.prepare(`INSERT INTO documents
    (id, employer_id, packet_id, kind, file_name, r2_key, status, amount_cents, extracted_json,
     content_hash, classification_confidence, extraction_provider, uploader, source, processed_at, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Program manager', 'web_upload', ?, ?)`)
    .bind(id, employerId, packetId, detectedKind, file.name, env.FILES ? key : null, status, effectiveAmountCents,
      JSON.stringify({ ...extraction, fileSize: file.size, contentType: file.type }), contentHash,
      extraction.classificationConfidence, extraction.provider, now, now)];
  if (packetId) operations.push(db.prepare("INSERT INTO document_packet_links VALUES (?, ?, ?, 1, ?, 'Program manager')").bind(`link-${crypto.randomUUID()}`, id, packetId, now));
  for (const field of extraction.fields) operations.push(db.prepare("INSERT INTO document_field_evidence VALUES (?, ?, ?, ?, ?, ?, 'extracted', NULL, NULL, NULL)")
    .bind(`field-${crypto.randomUUID()}`, id, field.name, JSON.stringify(field.value), Math.round(field.confidence), field.source));
  if (packetId) for (const activity of extraction.activities) operations.push(db.prepare(`INSERT INTO activity_hours
    (id, packet_id, document_id, category, hours, source) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(`act-${crypto.randomUUID()}`, packetId, id, activity.category, activity.hours, `${file.name} · ${activity.source}`));
  const activeMou = packet ? await db.prepare(`SELECT * FROM mous WHERE employer_id = ? AND effective_start <= ? AND effective_end >= ?
    ORDER BY CASE status WHEN 'current' THEN 0 ELSE 1 END, effective_start DESC LIMIT 1`).bind(employerId, packet.period_end, packet.period_start).first<Record<string, unknown>>() : null;
  let priorClaims: Array<{ id: string; claim_type: string; description: string; category: string; amount_requested_cents: number; supporting_document_id: string | null }> = [];
  if (packetId && detectedKind === "invoice") {
    priorClaims = await rows<{ id: string; claim_type: string; description: string; category: string; amount_requested_cents: number; supporting_document_id: string | null }>(db, "SELECT id, claim_type, description, category, amount_requested_cents, supporting_document_id FROM reimbursement_claims WHERE packet_id = ? AND status <> 'superseded'", [packetId]);
    if (priorClaims.length) {
      operations.push(db.prepare("UPDATE reimbursement_claims SET status = 'superseded', amount_eligible_cents = 0 WHERE packet_id = ? AND status <> 'superseded'").bind(packetId));
      operations.push(db.prepare("INSERT INTO audit_events VALUES (?, 'packet', ?, 'invoice_claims_superseded', 'Document intake', ?, ?, ?, NULL)")
        .bind(`audit-${crypto.randomUUID()}`, packetId, now, JSON.stringify({ claimIds: priorClaims.map((claim) => claim.id) }), JSON.stringify({ replacementDocumentId: id })));
    }
  }
  if (packetId && detectedKind === "invoice") for (const claim of extraction.claims) {
    const claimId = `claim-${crypto.randomUUID()}`;
    const requestedCents = Math.round(claim.amount * 100);
    const inheritedSupport = priorClaims.find((prior) => prior.claim_type === claim.type && prior.amount_requested_cents === requestedCents && prior.category.toLowerCase() === claim.category.toLowerCase())?.supporting_document_id ?? null;
    operations.push(db.prepare(`INSERT INTO reimbursement_claims
      (id, packet_id, document_id, claim_type, description, business_purpose, category,
       amount_requested_cents, amount_eligible_cents, status, mou_id, supporting_document_id, source_locator, confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'needs_review', ?, ?, ?, ?)`)
      .bind(claimId, packetId, id, claim.type, claim.description, claim.businessPurpose, claim.category,
        requestedCents, activeMou?.id ?? null, inheritedSupport, claim.source, Math.round(claim.confidence)));
    if (claim.type === "business_expense") {
      const allowed = activeMou ? JSON.parse(String(activeMou.allowed_expenses_json || "[]")) as string[] : [];
      const mouPass = allowed.some((category) => category.toLowerCase() === claim.category.toLowerCase());
      const checks: Array<[string, string | null, string, string]> = [
        ["IRS baseline", "pol-irs", "needs_review", claim.businessPurpose ? "Business purpose was extracted; verify ordinary, necessary, non-personal use and proof of payment." : "Business purpose and adequate substantiation require review."],
        ["Federal + ARC", "pol-arc", "needs_review", "Verify allowability, reasonableness, allocability, documentation, and period of performance."],
        ["Land and Earn grant", "pol-grant", "needs_review", "Authoritative signed award and approved budget evidence must support this category."],
        ["Employer MOU", "pol-mou", "needs_review", activeMou ? (mouPass ? `${claim.category} appears in ${activeMou.code}; verify the effective period, limits, conditions, and required evidence.` : `${claim.category} is not an exact match to an allowed category in ${activeMou.code}.`) : "No applicable employer MOU is linked."],
      ];
      for (const [level, policyId, result, reason] of checks) operations.push(db.prepare("INSERT INTO eligibility_checks VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)")
        .bind(`check-${crypto.randomUUID()}`, claimId, level, policyId, result, reason, result === "pass" ? 85 : 55));
    }
  }
  if (detectedKind === "invoice" && packet && effectiveAmountCents) {
    const priorAmount = Number(packet.invoice_amount_cents ?? 0);
    const received = await db.prepare("SELECT id FROM po_events WHERE packet_id = ? AND event_type = 'invoice_received'").bind(packetId).first();
    const eventType = received ? "invoice_adjustment" : "invoice_received";
    const ledgerAmount = received ? effectiveAmountCents - priorAmount : effectiveAmountCents;
    const invoiceNumber = extractedValue(extraction, "invoiceNumber") ?? packet.invoice_number ?? null;
    const wageSubtotal = extraction.claims.filter((claim) => claim.type === "intern_wages").reduce((sum, claim) => sum + claim.amount, 0);
    const expenseSubtotal = extraction.claims.filter((claim) => claim.type === "business_expense").reduce((sum, claim) => sum + claim.amount, 0);
    operations.push(db.prepare(`UPDATE packets SET invoice_amount_cents = ?, invoice_number = COALESCE(?, invoice_number),
      wage_amount_cents = CASE WHEN ? > 0 THEN ? ELSE wage_amount_cents END,
      business_amount_cents = CASE WHEN ? > 0 THEN ? ELSE business_amount_cents END,
      confidence = ?, received_at = COALESCE(received_at, ?),
      status = CASE WHEN status = 'invoice_not_received' THEN 'needs_review' ELSE status END WHERE id = ?`)
      .bind(effectiveAmountCents, invoiceNumber, wageSubtotal, Math.round(wageSubtotal * 100), expenseSubtotal,
        Math.round(expenseSubtotal * 100), Math.round(extraction.classificationConfidence), now, packetId));
    if (ledgerAmount !== 0) operations.push(db.prepare(`INSERT INTO po_events
      (id, purchase_order_id, packet_id, event_type, amount_cents, reference, occurred_at, actor)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Document intake')`)
      .bind(`evt-${crypto.randomUUID()}`, packet.purchase_order_id, packetId, eventType, ledgerAmount,
        packet.invoice_number ?? file.name, now.slice(0, 10)));
  }
  operations.push(db.prepare("INSERT INTO audit_events VALUES (?, 'document', ?, 'uploaded_and_processed', 'Program manager', ?, NULL, ?, NULL)")
    .bind(`audit-${crypto.randomUUID()}`, id, now, JSON.stringify({ fileName: file.name, detectedKind, provider: extraction.provider, packetId, confidence: extraction.classificationConfidence })));
  await db.batch(operations);
  if (packetId) {
    if (detectedKind === "invoice") {
      const requiredFields: Array<[string, string]> = [["invoiceNumber", "Invoice number missing"], ["invoiceDate", "Invoice date missing"], ["employerAddress", "Employer address missing"], ["authorizedSignaturePresent", "Authorized signature missing"]];
      for (const [field, title] of requiredFields) {
        const value = extractedValue(extraction, field);
        const missing = !value || value === "false";
        if (missing) await upsertSystemException(db, packetId, title, `${file.name} does not provide a verifiable ${field.replace(/([A-Z])/g, " $1").toLowerCase()}. Return the invoice for correction.`, 1, "Employer of record");
        else await clearSystemException(db, packetId, title);
      }
    }
    if (detectedKind === "timesheet") {
      for (const [field, title] of [["internSignaturePresent", "Intern signature missing"], ["supervisorSignaturePresent", "Supervisor signature missing"]] as Array<[string, string]>) {
        if (extractedValue(extraction, field) !== "true") await upsertSystemException(db, packetId, title, `${file.name} does not contain a verifiable ${title.toLowerCase()}.`, 1, title.startsWith("Supervisor") ? "Placement supervisor" : "Employer of record");
        else await clearSystemException(db, packetId, title);
      }
      const total = numericExtractedValue(extraction, "totalHours");
      const categorized = extraction.activities.reduce((sum, activity) => sum + activity.hours, 0);
      if (total != null && Math.abs(total - categorized) > 0.01) await upsertSystemException(db, packetId, "Activity hours do not equal total time", `Categorized activities total ${categorized} hours while the time record total is ${total}.`, 1);
      else if (total != null && extraction.activities.length) await clearSystemException(db, packetId, "Activity hours do not equal total time");
    }
    if (extraction.classificationConfidence < 70) await upsertSystemException(db, packetId, "Document classification needs confirmation", `${file.name} was classified as ${detectedKind} with ${extraction.classificationConfidence}% confidence.`, 2);
    await reconcilePacket(db, packetId);
  }
  return { id, fileName: file.name, kind: detectedKind, status, duplicate: false, confidence: extraction.classificationConfidence, provider: extraction.provider, warnings: extraction.warnings };
}

export async function storeDocuments(form: FormData) {
  const db = await ensureDatabase();
  const candidates = [...form.getAll("files"), ...form.getAll("file")].filter((item): item is File => item instanceof File && item.size > 0);
  if (!candidates.length) throw new Error("Choose at least one file.");
  const unique = candidates.filter((file, index) => candidates.findIndex((candidate) => candidate.name === file.name && candidate.size === file.size) === index);
  const documents = [];
  for (const file of unique) documents.push(await storeOneDocument(db, file, form));
  return { ok: true, documents };
}

export async function getDocumentOriginal(documentId: string) {
  const db = await ensureDatabase();
  const document = await db.prepare("SELECT * FROM documents WHERE id = ?").bind(documentId).first<Record<string, unknown>>();
  if (!document?.r2_key || !env.FILES) throw new Error("The original file is not available in document storage.");
  const object = await env.FILES.get(String(document.r2_key));
  if (!object) throw new Error("The original file could not be found.");
  const now = new Date().toISOString();
  await db.prepare("INSERT INTO audit_events VALUES (?, 'document', ?, 'original_viewed', 'Authorized user', ?, NULL, NULL, NULL)")
    .bind(`audit-${crypto.randomUUID()}`, documentId, now).run();
  return { body: object.body, contentType: object.httpMetadata?.contentType ?? "application/octet-stream", fileName: String(document.file_name) };
}

const htmlEscape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);

export async function buildPacketExport(packetId: string) {
  const data = await getDashboardData();
  const packet = data.packets.find((item) => item.id === packetId);
  if (!packet) throw new Error("Packet not found.");
  const employer = data.employers.find((item) => item.id === packet.employerId);
  if (!employer) throw new Error("Employer not found.");
  const ledger = data.poEvents.filter((event) => event.purchaseOrderId === packet.purchaseOrderId);
  const rows = (items: string[]) => items.join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${htmlEscape(packet.label)} · Land & Earn</title><style>body{font:14px/1.5 Arial,sans-serif;color:#183027;max-width:980px;margin:36px auto;padding:0 24px}h1,h2{font-family:Georgia,serif;font-weight:500}h1{font-size:32px;margin-bottom:4px}h2{margin-top:30px;border-bottom:1px solid #ccd7d1;padding-bottom:7px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px;border-bottom:1px solid #e3e8e5;vertical-align:top}th{font-size:11px;text-transform:uppercase;color:#597067}.meta{color:#597067}.amount{font-family:monospace}.blocker{color:#9b4f35}.stamp{display:inline-block;padding:4px 8px;border:1px solid #98ad9f;border-radius:99px;font-size:11px}.footer{margin-top:40px;color:#708078;font-size:11px}</style></head><body>
  <p class="meta">LAND &amp; EARN · FISCAL REVIEW EXPORT</p><h1>${htmlEscape(packet.label)}</h1><p class="meta">${htmlEscape(employer.name)} · ${htmlEscape(packet.periodStart)}–${htmlEscape(packet.periodEnd)} · <span class="stamp">${htmlEscape(packet.status)}</span></p>
  <h2>Funding and reconciliation</h2><table><tr><th>Purchase order</th><th>Current funding</th><th>Committed</th><th>Available</th></tr><tr><td>${htmlEscape(employer.poNumber)}</td><td class="amount">$${employer.currentFunding.toFixed(2)}</td><td class="amount">$${employer.committed.toFixed(2)}</td><td class="amount">$${employer.available.toFixed(2)}</td></tr></table>
  <table><tr><th>Invoice</th><th>Wages</th><th>Business expenses</th><th>Total</th></tr><tr><td>${htmlEscape(packet.invoiceNumber ?? "Missing")}</td><td class="amount">$${packet.wageAmount.toFixed(2)}</td><td class="amount">$${packet.businessAmount.toFixed(2)}</td><td class="amount">$${packet.invoiceAmount.toFixed(2)}</td></tr></table>
  <h2>Exceptions and decisions</h2><table><tr><th>Priority</th><th>Issue</th><th>Owner</th><th>Status</th></tr>${rows(packet.exceptions.map((item) => `<tr><td>P${item.severity}</td><td class="${item.status === "open" && item.severity === 1 ? "blocker" : ""}"><b>${htmlEscape(item.title)}</b><br>${htmlEscape(item.detail)}</td><td>${htmlEscape(item.ownerRole)}</td><td>${htmlEscape(item.status)}</td></tr>`))}</table>
  <h2>Activity hours</h2><table><tr><th>Category</th><th>Hours</th><th>Source</th></tr>${rows(packet.activities.map((item) => `<tr><td>${htmlEscape(item.category)}</td><td>${item.hours}</td><td>${htmlEscape(item.source)}</td></tr>`))}</table>
  <h2>Source documents and extracted fields</h2>${rows(packet.documents.map((document) => `<h3>${htmlEscape(document.fileName)} <span class="stamp">${htmlEscape(document.status)}</span></h3><p class="meta">${htmlEscape(document.kind)} · ${document.classificationConfidence}% classification confidence · ${htmlEscape(document.extractionProvider)}</p><table><tr><th>Field</th><th>Value</th><th>Confidence</th><th>Source</th></tr>${rows(document.fieldEvidence.map((field) => `<tr><td>${htmlEscape(field.name)}</td><td>${htmlEscape(field.value)}</td><td>${field.confidence}%</td><td>${htmlEscape(field.source)}</td></tr>`))}</table>`))}
  <h2>Reimbursement claims and eligibility</h2>${rows(packet.claims.map((claim) => `<h3>${htmlEscape(claim.description)} · $${claim.amountRequested.toFixed(2)}</h3><table><tr><th>Authority</th><th>Result</th><th>Reason</th></tr>${rows(claim.checks.map((check) => `<tr><td>${htmlEscape(check.authorityLevel)}</td><td>${htmlEscape(check.result)}</td><td>${htmlEscape(check.reason)}</td></tr>`))}</table>`))}
  <h2>Purchase-order ledger</h2><table><tr><th>Date</th><th>Event</th><th>Reference</th><th>Amount</th><th>Actor</th></tr>${rows(ledger.map((event) => `<tr><td>${htmlEscape(event.occurredAt)}</td><td>${htmlEscape(event.eventType)}</td><td>${htmlEscape(event.reference)}</td><td class="amount">$${event.amount.toFixed(2)}</td><td>${htmlEscape(event.actor)}</td></tr>`))}</table>
  <h2>Audit history</h2><table><tr><th>Date</th><th>Action</th><th>Actor</th><th>Reason</th></tr>${rows(packet.history.map((event) => `<tr><td>${htmlEscape(event.occurredAt)}</td><td>${htmlEscape(event.action)}</td><td>${htmlEscape(event.actor)}</td><td>${htmlEscape(event.reason ?? "")}</td></tr>`))}</table>
  <p class="footer">Generated ${htmlEscape(data.generatedAt)}. Human approval remains required. Original documents remain in protected storage and are listed above.</p></body></html>`;
  const db = await ensureDatabase();
  await db.prepare("INSERT INTO audit_events VALUES (?, 'packet', ?, 'packet_exported', 'Authorized user', ?, NULL, NULL, NULL)").bind(`audit-${crypto.randomUUID()}`, packetId, new Date().toISOString()).run();
  return { html, fileName: `${packet.label.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || packetId}.html` };
}

export async function buildPacketArchive(packetId: string) {
  const summary = await buildPacketExport(packetId);
  const db = await ensureDatabase();
  const documents = await rows<{ id: string; file_name: string; r2_key: string | null }>(db, `SELECT DISTINCT d.id, d.file_name, d.r2_key FROM documents d
    LEFT JOIN document_packet_links l ON l.document_id = d.id WHERE d.packet_id = ? OR l.packet_id = ? ORDER BY d.uploaded_at`, [packetId, packetId]);
  const files: Record<string, Uint8Array> = { "packet-summary.html": strToU8(summary.html) };
  let included = 0;
  for (const [index, document] of documents.entries()) {
    if (!document.r2_key || !env.FILES) continue;
    const object = await env.FILES.get(document.r2_key);
    if (!object) continue;
    const safeName = document.file_name.replace(/[^a-zA-Z0-9._-]/g, "-");
    files[`supporting-documents/${String(index + 1).padStart(2, "0")}-${safeName}`] = new Uint8Array(await new Response(object.body).arrayBuffer());
    included += 1;
  }
  files["README.txt"] = strToU8(`Land and Earn fiscal review archive\nPacket: ${packetId}\nSupporting documents included: ${included} of ${documents.length}\nGenerated: ${new Date().toISOString()}\n\nOpen packet-summary.html for normalized facts, validation results, funding ledger, and audit history. Originals remain subject to authorized access and the configured retention policy.\n`);
  const now = new Date().toISOString();
  await db.prepare("INSERT INTO audit_events VALUES (?, 'packet', ?, 'packet_archive_exported', 'Authorized user', ?, NULL, ?, NULL)")
    .bind(`audit-${crypto.randomUUID()}`, packetId, now, JSON.stringify({ supportingDocumentsIncluded: included, supportingDocumentsListed: documents.length })).run();
  return { body: zipSync(files, { level: 6 }), fileName: summary.fileName.replace(/\.html$/, ".zip") };
}
