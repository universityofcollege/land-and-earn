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
}, (table) => [index("purchase_orders_employer_idx").on(table.employerId)]);

export const interns = sqliteTable("interns", {
  id: text("id").primaryKey(),
  employerId: text("employer_id").notNull().references(() => employers.id),
  name: text("name").notNull(),
  county: text("county").notNull(),
  placement: text("placement").notNull(),
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
  uploadedAt: text("uploaded_at").notNull(),
}, (table) => [index("documents_packet_idx").on(table.packetId)]);

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
}, (table) => [index("packet_exceptions_packet_idx").on(table.packetId)]);

export const activityHours = sqliteTable("activity_hours", {
  id: text("id").primaryKey(),
  packetId: text("packet_id").notNull().references(() => packets.id),
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
