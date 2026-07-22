import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const employers = sqliteTable("employers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  county: text("county").notNull(),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  arrangement: text("arrangement").notNull(),
  mouCode: text("mou_code").notNull(),
  mouStatus: text("mou_status").notNull().default("current"),
  paySchedule: text("pay_schedule").notNull().default("Biweekly"),
});

export const purchaseOrders = sqliteTable("purchase_orders", {
  id: text("id").primaryKey(),
  employerId: text("employer_id").notNull().references(() => employers.id),
  poNumber: text("po_number").notNull().unique(),
  originalAmountCents: integer("original_amount_cents").notNull(),
  amendmentAmountCents: integer("amendment_amount_cents").notNull().default(0),
  status: text("status").notNull().default("active"),
  issuedAt: text("issued_at").notNull(),
  effectiveEnd: text("effective_end").notNull(),
  documentId: text("document_id"),
}, (table) => [index("purchase_orders_employer_idx").on(table.employerId)]);

export const interns = sqliteTable("interns", {
  id: text("id").primaryKey(),
  employerId: text("employer_id").notNull().references(() => employers.id),
  name: text("name").notNull(),
  county: text("county").notNull(),
  placement: text("placement").notNull(),
  supervisorName: text("supervisor_name"),
  supervisorEmail: text("supervisor_email"),
});

export const packets = sqliteTable("packets", {
  id: text("id").primaryKey(),
  employerId: text("employer_id").notNull().references(() => employers.id),
  purchaseOrderId: text("purchase_order_id").notNull().references(() => purchaseOrders.id),
  internId: text("intern_id").references(() => interns.id),
  label: text("label").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  status: text("status").notNull(),
  priority: integer("priority").notNull().default(2),
  dueDate: text("due_date").notNull(),
  invoiceNumber: text("invoice_number"),
  invoiceAmountCents: integer("invoice_amount_cents").notNull().default(0),
  wageAmountCents: integer("wage_amount_cents").notNull().default(0),
  businessAmountCents: integer("business_amount_cents").notNull().default(0),
  confidence: integer("confidence").notNull().default(0),
  receivedAt: text("received_at"),
  approvedAt: text("approved_at"),
  paidAt: text("paid_at"),
});

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  employerId: text("employer_id").notNull().references(() => employers.id),
  packetId: text("packet_id").references(() => packets.id),
  kind: text("kind").notNull(),
  fileName: text("file_name").notNull(),
  r2Key: text("r2_key"),
  status: text("status").notNull(),
  amountCents: integer("amount_cents"),
  periodStart: text("period_start"),
  periodEnd: text("period_end"),
  extractedJson: text("extracted_json").notNull().default("{}"),
  contentHash: text("content_hash"),
  classificationConfidence: integer("classification_confidence").notNull().default(0),
  extractionProvider: text("extraction_provider").notNull().default("local"),
  uploader: text("uploader").notNull().default("Program manager"),
  source: text("source").notNull().default("web_upload"),
  processedAt: text("processed_at"),
  errorMessage: text("error_message"),
  uploadedAt: text("uploaded_at").notNull(),
}, (table) => [index("documents_packet_idx").on(table.packetId), index("documents_hash_idx").on(table.contentHash)]);

export const packetExceptions = sqliteTable("packet_exceptions", {
  id: text("id").primaryKey(),
  packetId: text("packet_id").notNull().references(() => packets.id),
  severity: integer("severity").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  ownerRole: text("owner_role").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"),
  resolutionType: text("resolution_type"),
  resolutionReason: text("resolution_reason"),
  resolvedBy: text("resolved_by"),
}, (table) => [index("packet_exceptions_packet_idx").on(table.packetId)]);

export const activityHours = sqliteTable("activity_hours", {
  id: text("id").primaryKey(),
  packetId: text("packet_id").notNull().references(() => packets.id),
  documentId: text("document_id").references(() => documents.id),
  category: text("category").notNull(),
  hours: real("hours").notNull(),
  source: text("source").notNull(),
});

export const reminderDrafts = sqliteTable("reminder_drafts", {
  id: text("id").primaryKey(),
  employerId: text("employer_id").notNull().references(() => employers.id),
  packetId: text("packet_id").references(() => packets.id),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").notNull(),
  reviewedAt: text("reviewed_at"),
  recipientName: text("recipient_name"),
  recipientEmail: text("recipient_email"),
  recipientRole: text("recipient_role").notNull().default("Employer of record"),
});

export const poEvents = sqliteTable("po_events", {
  id: text("id").primaryKey(),
  purchaseOrderId: text("purchase_order_id").notNull().references(() => purchaseOrders.id),
  packetId: text("packet_id").references(() => packets.id),
  eventType: text("event_type").notNull(),
  amountCents: integer("amount_cents").notNull(),
  reference: text("reference").notNull(),
  occurredAt: text("occurred_at").notNull(),
  actor: text("actor").notNull(),
});

export const policies = sqliteTable("policies", {
  id: text("id").primaryKey(),
  level: text("level").notNull(),
  title: text("title").notNull(),
  code: text("code").notNull(),
  status: text("status").notNull(),
  summary: text("summary").notNull(),
  effectiveAt: text("effective_at").notNull(),
});

export const programSettings = sqliteTable("program_settings", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  hourlyRateCents: integer("hourly_rate_cents").notNull(),
  fiscalYearStart: text("fiscal_year_start").notNull(),
  fiscalYearEnd: text("fiscal_year_end").notNull(),
  invoiceDeadline: text("invoice_deadline").notNull(),
  paymentDeadline: text("payment_deadline").notNull(),
  retentionYears: integer("retention_years").notNull().default(7),
  poWarningPercent: integer("po_warning_percent").notNull().default(15),
});

export const mous = sqliteTable("mous", {
  id: text("id").primaryKey(),
  employerId: text("employer_id").notNull().references(() => employers.id),
  code: text("code").notNull(),
  version: text("version").notNull(),
  effectiveStart: text("effective_start").notNull(),
  effectiveEnd: text("effective_end").notNull(),
  status: text("status").notNull().default("current"),
  allowedExpensesJson: text("allowed_expenses_json").notNull().default("[]"),
  limitsJson: text("limits_json").notNull().default("{}"),
  conditionsJson: text("conditions_json").notNull().default("[]"),
  evidenceRequirementsJson: text("evidence_requirements_json").notNull().default("[]"),
  documentId: text("document_id").references(() => documents.id),
  createdAt: text("created_at").notNull(),
}, (table) => [index("mous_employer_idx").on(table.employerId)]);

export const documentPacketLinks = sqliteTable("document_packet_links", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull().references(() => documents.id),
  packetId: text("packet_id").notNull().references(() => packets.id),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  linkedAt: text("linked_at").notNull(),
  actor: text("actor").notNull(),
}, (table) => [index("document_links_document_idx").on(table.documentId), index("document_links_packet_idx").on(table.packetId)]);

export const documentFieldEvidence = sqliteTable("document_field_evidence", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull().references(() => documents.id),
  fieldName: text("field_name").notNull(),
  valueJson: text("value_json").notNull(),
  confidence: integer("confidence").notNull(),
  sourceLocator: text("source_locator").notNull(),
  status: text("status").notNull().default("extracted"),
  correctedValueJson: text("corrected_value_json"),
  reviewedAt: text("reviewed_at"),
  reviewer: text("reviewer"),
}, (table) => [index("field_evidence_document_idx").on(table.documentId)]);

export const reimbursementClaims = sqliteTable("reimbursement_claims", {
  id: text("id").primaryKey(),
  packetId: text("packet_id").notNull().references(() => packets.id),
  documentId: text("document_id").notNull().references(() => documents.id),
  claimType: text("claim_type").notNull(),
  description: text("description").notNull(),
  businessPurpose: text("business_purpose").notNull().default(""),
  category: text("category").notNull().default("Unclassified"),
  amountRequestedCents: integer("amount_requested_cents").notNull(),
  amountEligibleCents: integer("amount_eligible_cents"),
  status: text("status").notNull().default("needs_review"),
  mouId: text("mou_id").references(() => mous.id),
  supportingDocumentId: text("supporting_document_id").references(() => documents.id),
  sourceLocator: text("source_locator").notNull(),
  confidence: integer("confidence").notNull(),
}, (table) => [index("claims_packet_idx").on(table.packetId)]);

export const eligibilityChecks = sqliteTable("eligibility_checks", {
  id: text("id").primaryKey(),
  claimId: text("claim_id").notNull().references(() => reimbursementClaims.id),
  authorityLevel: text("authority_level").notNull(),
  policyId: text("policy_id").references(() => policies.id),
  result: text("result").notNull(),
  reason: text("reason").notNull(),
  confidence: integer("confidence").notNull(),
  reviewer: text("reviewer"),
  reviewedAt: text("reviewed_at"),
}, (table) => [index("eligibility_claim_idx").on(table.claimId)]);

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  actor: text("actor").notNull(),
  occurredAt: text("occurred_at").notNull(),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  reason: text("reason"),
}, (table) => [index("audit_entity_idx").on(table.entityType, table.entityId)]);
