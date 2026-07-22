export type EmployerSummary = {
  id: string;
  name: string;
  county: string;
  contactName: string;
  contactEmail: string;
  arrangement: string;
  mouCode: string;
  mouStatus: string;
  paySchedule: string;
  purchaseOrderId: string;
  poNumber: string;
  originalFunding: number;
  amendmentFunding: number;
  currentFunding: number;
  committed: number;
  available: number;
  approved: number;
  paid: number;
  utilization: number;
};

export type PacketSummary = {
  id: string;
  employerId: string;
  employerName: string;
  purchaseOrderId: string;
  poNumber: string;
  internName: string | null;
  placement: string | null;
  label: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  priority: number;
  dueDate: string;
  invoiceNumber: string | null;
  invoiceAmount: number;
  wageAmount: number;
  businessAmount: number;
  confidence: number;
  receivedAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  exceptions: PacketException[];
  documents: PacketDocument[];
  activities: ActivityHour[];
};

export type PacketException = {
  id: string;
  severity: number;
  title: string;
  detail: string;
  ownerRole: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
};

export type PacketDocument = {
  id: string;
  kind: string;
  fileName: string;
  status: string;
  amount: number | null;
  uploadedAt: string;
  extracted: Record<string, unknown>;
};

export type ActivityHour = { id: string; category: string; hours: number; source: string };
export type ReminderDraft = {
  id: string;
  employerId: string;
  employerName: string;
  contactEmail: string;
  packetId: string | null;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
};
export type PoEvent = {
  id: string;
  purchaseOrderId: string;
  packetId: string | null;
  eventType: string;
  amount: number;
  reference: string;
  occurredAt: string;
  actor: string;
};
export type PolicyRecord = {
  id: string;
  level: string;
  title: string;
  code: string;
  status: string;
  summary: string;
  effectiveAt: string;
};
export type DashboardData = {
  generatedAt: string;
  hourlyRate: number;
  fiscalYearEnd: string;
  paymentDeadline: string;
  employers: EmployerSummary[];
  packets: PacketSummary[];
  reminders: ReminderDraft[];
  poEvents: PoEvent[];
  policies: PolicyRecord[];
};
