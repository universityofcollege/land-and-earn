# Land and Earn Grant Operations Assistant

**Document type:** Product requirements document  
**Status:** Draft v0.1  
**Owner:** TBD  
**Primary stakeholder:** Ishmel, Land and Earn program manager  
**Last updated:** July 22, 2026

## 1. Executive summary

Land and Earn is a federally funded internship program serving 16–24-year-olds across eight rural Promise Zone counties. A single program manager coordinates employers, interns, community partners, professional development, payroll reimbursement, and grant compliance.

The immediate operational bottleneck is reimbursement documentation and funding control. Each employer of record has an MOU and a purchase order that sets its total authorized funding. Employers invoice Baxus for intern wages and for eligible business expenses incurred while employing interns, and every received invoice reduces the employer’s current PO funding available. Wage reimbursement requires signed time records and payroll evidence; business-expense reimbursement requires supporting evidence and must comply with the employer’s grant-specific MOU. These documents arrive in inconsistent formats and channels, but represent overlapping facts that must be reconciled before reimbursement. Missing documents, signatures, ineligible expenses, mismatched amounts, or stale PO balances lead to manual follow-up and create deadline and audit risk.

The proposed product is a human-in-the-loop grant operations assistant. It will ingest reimbursement documents, classify and extract their data, assemble them into employer reimbursement packets, validate wage and business-expense claims, flag missing or conflicting evidence, and draft follow-up messages. Ishmel remains the final reviewer and approver.

## 2. Problem statement

Ishmel spends too much time turning inconsistent documents into evidence that a reimbursement is complete, accurate, and compliant. The process is difficult because:

- employers use different timesheet, payroll, and invoice formats;
- wage and business-expense reimbursement lines require different supporting evidence and validation rules;
- each employer’s grant-specific MOU defines which business expenses are eligible;
- every employer’s purchase order and remaining available funding must be reconciled across received, corrected, approved, and paid invoices;
- required signatures and fields vary by document and employer;
- documents arrive at different times and may not identify the intern or pay period consistently;
- incomplete packets require repeated, manually composed follow-up;
- all invoices must be received by June 30 and paid by July 31; and
- supporting records must remain retrievable for seven years.

The program needs a reliable exception-management workflow, not merely document storage or OCR.

## 3. Product objective

Enable Baxus to reimburse employers of record accurately and on time by reducing the time Ishmel spends assembling and validating reimbursement packets while improving their completeness, traceability, and readiness for fiscal review.

### Primary outcome

Ishmel can open the product and immediately see which employers can be reimbursed, which packets need review, exactly what is missing or inconsistent, and which issues must be resolved first to meet fiscal-year deadlines.

### Non-goals for the MVP

The MVP will not:

- recruit or match businesses and interns;
- replace the application, interview, or onboarding process;
- schedule internship activities or track soft-skills curriculum;
- calculate payroll, pay interns, or move money;
- replace the employer-of-record payroll system;
- perform grant accounting or submit reports to the funder;
- send external email without Ishmel’s review and explicit approval; or
- make final compliance or reimbursement decisions autonomously.

## 4. Users and roles

The roles below describe responsibilities, not necessarily separate organizations or people. In some placements, the employer of record and the placement business are the same entity, and one contact may perform both payroll/document-submission and day-to-day supervisory responsibilities. In other placements, an employer of record such as a school district pays the intern while a separate business or community organization supervises the work. The product must support both arrangements without creating duplicate organizations or contacts.

### Program manager — primary MVP user

Ishmel uploads and reviews documents, resolves exceptions, approves packets, and sends follow-up messages.

### Fiscal reviewer — anticipated secondary user

A Baxus fiscal or grants staff member reviews packet evidence and approval history before reimbursement or audit response. MVP access may be read-only if this role is confirmed.

### Employer-of-record contact — external participant

The employer-of-record contact submits invoices and payroll evidence and responds to related missing-document requests. The employer of record may be a school district or other intermediary, or it may be the same business or organization where the intern is placed. This person does not need a product account in the MVP.

### Placement business or supervisor — external participant

The placement business provides the intern’s day-to-day work experience, and its supervisor verifies time and may need to correct or sign a timesheet. The placement business and employer of record may be the same entity, and the supervisor may also serve as the employer-of-record contact. This person does not need a product account in the MVP.

## 5. Core domain model

The product’s central record is an **employer reimbursement packet** for one employer of record and one reimbursement period. A packet may contain claims for one or more interns or pay periods when the employer combines them on an invoice. Pay-period schedules vary by entity; most are biweekly, but the system must not assume a universal schedule.

Each packet contains:

1. **Purchase order and funding ledger** — each employer of record has a purchase order representing the total funding authorized for that employer under the grant. The system tracks the original purchase-order amount, approved amendments, every received invoice commitment, corrections or reversals, approved amounts, paid amounts, and the most current funding available.
2. **Governing eligibility evidence** — the versioned documents and rules used to decide whether a business expense is reimbursable. This evidence set includes the Land and Earn ARC Grant Agreement, approved budget, approved amendments, applicable ARC guidance and federal cost principles, and the grant- and employer-specific MOU. The MOU defines employer-level expense categories, limits, conditions, applicable periods, and required supporting evidence.
3. **Employer invoice** — the reimbursement request sent by the employer of record, which is the entity that paid the intern and incurred any claimed business expenses. The invoice must distinguish intern-wage lines from business-expense lines and contain sufficient payee and reimbursement detail, including the employer’s legal name and address, invoice number and date, applicable service or pay period, intern or line-item detail, amount requested, and the name, title, signature, or other evidence of the appropriate signing authority as required by Baxus policy. An invoice that lacks required detail is not payable and must be returned to the employer of record with a request for correction.
4. **Wage supporting documents** — evidence that substantiates what the intern was paid. Supporting documents may include:
   - a pay stub or payroll/earnings report showing the amount paid and applicable pay period;
   - a completed intern timesheet showing dates, hours, activity types, and required signatures; and
   - a digital timesheet, schedule, or timekeeping export in an employer-specific format showing when the intern was scheduled or worked.
5. **Business-expense supporting documents** — documents describing and substantiating each business expense incurred from employing an intern. Each item must identify the expense, date or applicable period, amount, business purpose, related intern where applicable, and enough information to evaluate it against the governing MOU.
6. **Reimbursement claims** — normalized invoice lines classified as either:
   - **intern wages**, linked to the relevant intern, pay period, time records, and payroll evidence; or
   - **business expenses**, linked to the relevant supporting evidence, MOU provision, and intern where applicable.
7. **Normalized work activity** — hours derived from wage supporting documents and assigned to the program’s required activity categories, including job placement, community engagement/service, storytelling/community investigation, soft-skills activities, and any additional approved category.
8. **Validation results** — missing invoice details, missing supporting evidence, missing signatures, activity-hour totals, paid-hours reconciliation, business-expense eligibility, purchase-order balance, cross-document conflicts, and confidence levels.
9. **Activity history** — uploads, edits, review decisions, status changes, purchase-order ledger entries, reminder/follow-up drafts, and send/copy events.

The program uses one consistent hourly rate across all interns. The rate is configured at the program level and applied to wage claims when validating paid hours and reimbursement amounts.

Business-expense eligibility uses the following hierarchy:

1. **IRS baseline screen:** by default, the expense must be ordinary and necessary for the employer’s business, have a clear business rather than personal purpose, and be supported by adequate records showing the payee, amount, proof of payment, date incurred, and description of the item or service.
2. **Federal and ARC allowability:** the expense must satisfy applicable federal cost principles, ARC requirements, the approved Land and Earn budget and scope, and the grant period of performance.
3. **Employer-specific MOU:** the expense must be permitted by the effective employer/grant MOU and comply with its category, limit, condition, and evidence requirements.

The stricter applicable rule controls. Passing the IRS baseline does not, by itself, make an expense reimbursable under the grant. When a rule is silent, conflicting, or cannot be evaluated with the available evidence, the claim requires human review and cannot be automatically marked eligible.

Purchase-order funding is tracked as an append-only ledger:

- **Current PO funding** = original purchase-order amount + approved funding amendments.
- **Committed by received invoices** = the total of all active invoice versions received against the purchase order, including invoices still under review.
- **Current funding available** = current PO funding − committed by received invoices.
- **Approved funding remaining** = current PO funding − approved invoice amounts.
- **Paid funding remaining** = current PO funding − paid invoice amounts.

The employer record and every linked reimbursement packet must show the current funding available. Receiving an invoice immediately posts a commitment to the ledger. A corrected, rejected, withdrawn, or voided invoice changes the balance through a traceable adjustment or reversal; prior ledger entries are never overwritten. An invoice that would exceed the current purchase-order balance is a Priority 1 payment blocker.

Packet statuses:

- `Awaiting documents`
- `Invoice not received`
- `Processing`
- `Needs review`
- `Follow-up required`
- `Reminder draft ready`
- `Ready for approval`
- `Approved`
- `Paid` (manual status in MVP)
- `Archived`

Payment readiness is controlled by a configurable priority threshold:

- **Priority 1 — payment blocker:** an issue that prevents accurate reimbursement, such as a missing invoice, incomplete invoice, missing supporting evidence, unresolved hours/pay/amount mismatch, missing MOU or purchase order, insufficient purchase-order funding, or business expense that cannot be confirmed as eligible. A packet cannot become `Ready for approval` while a Priority 1 issue is open.
- **Priority 2 — deadline risk:** a complete or potentially payable packet requiring prompt review or follow-up to meet the invoice or payment deadline.
- **Priority 3 — review item:** a non-blocking issue that should be confirmed or documented but does not prevent reimbursement under the approved policy.

The exact priority and override rules must be approved by Baxus fiscal staff before the live pilot.

## 6. MVP workflow

1. Ishmel creates or selects an employer reimbursement packet and its reimbursement period.
2. Ishmel uploads one or more PDFs or images in any order.
3. The system classifies each file as a purchase order or amendment, invoice, timesheet/time record, payroll evidence, business-expense supporting document, MOU, or unknown.
4. The system extracts relevant fields and associates the document with the most likely packet and employer.
5. When an invoice is received, the system links it to the employer’s active purchase order, posts its amount as a funding commitment, and recalculates current funding available.
6. The system checks document completeness and reconciles shared facts across the packet.
7. High-confidence matches pass automatically; low-confidence values and conflicts are presented for review.
8. The packet shows a plain-language exception list and the person or organization most likely responsible for each item.
9. Ishmel reviews or corrects extracted values.
10. The system drafts a follow-up email containing only the unresolved items for the intended recipient.
11. Ishmel edits, copies, or approves the message for sending through the selected email integration.
12. Once all required checks pass, Ishmel marks the packet approved.
13. The product preserves the original files, normalized data, funding ledger, validation results, and audit history for the retention period.

## 7. Functional requirements

### FR1. Program setup

- Store grant/program name, fiscal-year dates, invoice receipt deadline, payment deadline, and retention policy.
- Store and version the Land and Earn ARC Grant Agreement, approved budget, approved amendments, applicable ARC guidance, and the federal cost rules used by the program.
- Store the program-wide hourly rate used for all interns, including effective dates if the rate can change between fiscal years.
- Store employer-of-record organizations, placement organizations, contacts, and county.
- Store and version each employer’s purchase order, including PO number, grant/program, issue and effective dates, original authorized amount, approved amendments, status, and source documents.
- Store and version each employer’s MOU for each grant, including effective dates, allowed business-expense categories, limits, conditions, and evidence requirements.
- Store each employer of record’s pay-period schedule; default to biweekly where appropriate while allowing other schedules and employer-specific period dates.
- Store intern identity and relevant placement/employer relationships.
- Configure required document types and validation rules without code changes where practical.

### FR2. Document intake

- Accept PDF, JPG, PNG, and common office document formats; email ingestion is a post-pilot candidate.
- Support multi-file upload and documents containing multiple pages.
- Preserve the original file unchanged.
- Detect duplicate uploads using file and content signals.
- Record uploader, upload time, source, and processing status.
- Prevent unsupported, corrupt, or password-protected files from silently failing.

### FR3. Classification and extraction

- Classify each document as purchase order or amendment, timesheet/time record, payroll evidence, invoice, business-expense supporting evidence, MOU, or unknown.
- Extract, where present:
  - intern name or identifier;
  - employer of record;
  - purchase-order number, original amount, amendment amount, effective date, and total current authorized funding;
  - placement organization;
  - pay-period start and end dates;
  - work dates, scheduled shifts, regular/overtime/total hours, activity descriptions, and activity categories;
  - pay rate, gross pay, deductions, and net pay;
  - invoice number, invoice date, invoiced amount, and service period;
  - employer legal name, payee/remittance address, and other required invoice contact details;
  - signing-authority name, title, signature presence, and signature date where required;
  - invoice-line reimbursement type: intern wages or business expense;
  - business-expense description, date or period, amount, business purpose, category, and related intern where applicable;
  - referenced IRS baseline, federal/ARC rule, approved grant budget or term, and MOU provision, eligibility limit, or condition when identifiable;
  - intern signature presence and date;
  - supervisor signature presence and date; and
  - other grant-required fields identified during discovery.
- Show the source document and location supporting every extracted field.
- Store a confidence score for classification and each extracted field.
- Never treat a low-confidence extraction as verified without review.

### FR4. Packet assembly

- Recommend a packet match using intern, employer, dates, and other document evidence.
- Allow Ishmel to accept, change, or remove the match.
- Link every invoice to exactly one active purchase order for the employer and grant before it can become `Ready for approval`.
- Support one payroll report or invoice covering multiple interns by linking the relevant evidence to multiple packets without duplicating the original file.
- Link each business-expense invoice line to its supporting document, applicable IRS baseline rule, Land and Earn grant evidence, and employer/grant MOU version.
- Show unmatched documents in a triage queue.

### FR5. Validation and reconciliation

- Flag missing required document types.
- Flag a missing, inactive, expired, mismatched, or ambiguous purchase order.
- Flag a missing, expired, or inapplicable MOU when a business expense is claimed.
- Flag an invoice that lacks required employer identity, address, period, line-item, amount, or signing-authority details and identify the exact corrections needed.
- Flag missing intern and supervisor signatures on timesheets.
- Flag missing required fields based on the applicable document/employer rules.
- Derive hours by activity category from supporting documents, preserving the source description and evidence for each classification.
- Compare intern identity, employer, pay period, activity hours, total timesheet hours, payroll hours, the program-wide hourly rate, gross pay, and reimbursable/invoiced amount when those values are present.
- Require the sum of categorized timesheet hours to equal total timesheet hours and reconcile those hours to what the intern was actually paid.
- Apply the IRS baseline screen: ordinary and necessary, business rather than personal, and adequately substantiated with payee, amount, proof of payment, date, and description.
- Validate each business-expense claim against applicable 2 CFR Part 200 cost principles, ARC requirements, the Land and Earn Grant Agreement, approved budget and amendments, period of performance, and the applicable MOU category, limit, conditions, and supporting-evidence requirements.
- Apply the strictest applicable rule and require human review when the rules conflict or the evidence does not support a determination.
- Flag a business expense as unsupported, outside the MOU period, disallowed, above an applicable limit, duplicative, or insufficiently explained.
- Reconcile the invoice total to the sum of validated wage claims and eligible business-expense claims while preserving each category as a separate subtotal.
- Post each received invoice amount to the purchase-order ledger exactly once and prevent duplicate uploads or corrected invoice versions from double-counting funding.
- Recalculate current funding available after every invoice receipt, correction, rejection, withdrawal, void, approval, payment, PO amendment, or reversal.
- Flag any invoice that exceeds current PO funding available or causes a negative balance.
- Apply defined tolerances and formulas only after fiscal policy is confirmed.
- Distinguish a definite conflict from unavailable evidence and uncertain extraction.
- Explain each exception in plain language and show the supporting values side by side.
- Allow a reviewer to correct data, mark an exception resolved, or document an approved override with a reason.

### FR6. Work queue and deadlines

- Provide a dashboard grouped by packet status.
- Allow filtering by employer, intern, county, pay period, missing item, and deadline risk.
- Show each employer’s PO number, current PO funding, committed invoice amount, current funding available, approved amount, paid amount, and remaining balances.
- Highlight purchase orders nearing depletion and allow the warning threshold to be configured.
- Show the next required action and responsible contact.
- Assign exceptions a configurable payment-readiness priority so issues that prevent correct and timely reimbursement are handled first.
- Treat missing invoices, missing required invoice details, missing supporting documents, missing applicable MOUs or purchase orders, insufficient PO funding, ineligible or unsupported business expenses, and unresolved hours/pay/amount mismatches as payment blockers unless Baxus policy explicitly allows an override.
- Highlight packets at risk of missing the June 30 invoice deadline or July 31 payment deadline.
- At the configured fiscal-year invoice deadline, identify employers that have not submitted required invoices and prepare reminder drafts without sending them automatically.
- Allow bulk drafting of follow-ups while keeping individual review before send.

### FR7. Follow-up drafting

- Draft an email to the appropriate employer, payroll contact, supervisor, or intern based on unresolved items.
- Include intern/pay-period context and a precise list of requested corrections or documents.
- Draft a fiscal-year deadline reminder for each employer of record with outstanding invoices or supporting documents and place the packet in `Reminder draft ready` status.
- Avoid unnecessary sensitive payroll details in the email body.
- Let Ishmel edit, copy, discard, or explicitly approve the draft.
- Record the final message and send/copy event in the packet history when an integration is used.
- Do not send automatically in the MVP.

### FR8. Review, approval, and export

- Require human approval before a packet is considered complete.
- Show hours by program activity category—job placement, community engagement/service, storytelling/community investigation, soft skills, and other approved categories—based on the supporting documents.
- Show a reconciliation from categorized timesheet hours to payroll hours, gross pay at the program-wide hourly rate, and the amount requested on the invoice.
- Show wage and business-expense subtotals separately, with every business-expense line linked to its supporting document and the specific IRS baseline, federal/ARC, grant, budget, and MOU evidence used in the eligibility decision.
- Show the linked purchase order and balance before invoice, invoice commitment, balance after invoice, approved amount, paid amount, and current employer funding available.
- Prevent `Ready for approval` status while any payment-blocking exception remains unresolved or lacks an authorized override.
- Generate a packet summary showing extracted facts, validation results, overrides, and source files.
- Export the packet summary and supporting documents for fiscal review or audit response.
- Allow a `Paid` status and payment date to be recorded manually.

### FR9. Search, retention, and audit trail

- Search by intern, employer, purchase-order number, invoice number, pay period, county, status, and fiscal year.
- Retain original files, normalized data, and activity history for at least seven years, subject to confirmed Baxus policy.
- Record who performed each material action and when.
- Make corrections append-only in the audit history; do not erase prior values or decisions.
- Preserve every purchase-order funding event as an append-only ledger entry with actor/source, timestamp, event type, amount, linked PO/invoice, and resulting balance.
- Support authorized export and defensible deletion after the retention period.

## 8. Key validation rules to confirm

The following rules are placeholders until Baxus fiscal staff provide the complete Land and Earn award file and approve the reimbursement policy. Eligibility is evaluated in order using the IRS baseline, then federal/ARC and Land and Earn grant rules, then the employer-specific MOU. A stricter downstream rule overrides a more permissive baseline.

| Check | Proposed MVP behavior | Decision needed |
|---|---|---|
| Required wage documents | Detailed employer invoice + pay stub/payroll evidence + completed timesheet or acceptable digital time record | Are there employer- or period-specific exceptions? |
| Required business-expense documents | Detailed employer invoice line + supporting document explaining and substantiating the expense + applicable employer/grant MOU | What evidence is required for each allowed expense category? |
| IRS default screen | Expense is ordinary and necessary for the employer’s business, is not personal, and records identify payee, amount, proof of payment, date, and item/service description | Are any expense types categorically excluded before the IRS screen is applied? |
| Federal and ARC allowability | Expense satisfies 2 CFR Part 200, the Land and Earn Grant Agreement, approved scope and budget, approved amendments, and period of performance | Which award documents and budget versions are authoritative for this grant? |
| MOU applicability | Use the MOU version effective for the employer, grant, and expense date; claimed category and amount must satisfy its rules | How are amendments, overlapping MOUs, limits, and exceptions handled? |
| Purchase-order match | Every invoice is linked to the active PO for the same employer and grant | Can an employer have more than one active PO for Land and Earn, and how is the correct PO selected? |
| PO authorized funding | Current PO funding equals original authorization plus approved amendments | Who may enter or approve a PO amendment, and what document proves it? |
| Invoice commitment | A received invoice reduces current funding available exactly once; a correction or void posts a traceable delta or reversal | Should a returned invoice remain committed until formally withdrawn or be released immediately? |
| PO funding limit | Invoice amount cannot exceed current funding available and the resulting PO balance cannot be negative | Can an invoice be partially committed or held pending a PO amendment? |
| Invoice completeness | Require legal entity name, address, invoice number/date, applicable period, intern or line-item detail, amount, and authorized signer information | Which address, signature, title, and line-item fields are mandatory under Baxus policy? |
| Timesheet signatures | Intern and supervisor signatures required | Are typed/electronic signatures acceptable? |
| Activity allocation | Supporting-document hours are categorized as job placement, community engagement/service, storytelling/community investigation, soft skills, or another approved activity; category totals equal total time | What evidence is sufficient when a schedule or timesheet does not explicitly name the activity? |
| Paid-hours match | Total timesheet hours equal the hours actually paid according to the pay stub or payroll report | Is any tolerance allowed, and how are overtime, rounding, or corrections handled? |
| Gross pay | Paid hours × the program-wide hourly rate reconciles to payroll gross | Which earnings and employer costs are reimbursable? Can the rate change by fiscal year? |
| Invoice amount | Invoice equals the allowed reimbursable amount | Are taxes, fringe, or administrative costs included? |
| Business-expense eligibility | Each expense passes the IRS baseline and is allowed by federal/ARC, Land and Earn grant, approved budget, and MOU rules; it is sufficiently supported, within the covered period and any limit, and not duplicated | Must every expense be tied to a specific intern, and who can approve an exception? |
| Invoice reconciliation | Wage subtotal + eligible business-expense subtotal equals the invoice total | Can ineligible lines be partially rejected while the remainder is reimbursed? |
| Pay period | Use each employer’s configured schedule—usually biweekly—and require dates to align across supporting evidence and invoice | Can one invoice or payroll report cover multiple periods? |
| Payment-readiness priority | Missing invoice/detail/evidence/MOU/PO, insufficient PO funding, ineligible or unsupported business expenses, and unresolved paid-hours or amount mismatches block payment; lower-risk issues remain review items | Which issues may be overridden, and by whom? |
| Deadline reminder | At fiscal-year end, create—not send—a reminder draft for each employer with an outstanding invoice or supporting evidence | How many days before or after June 30 should drafts be prepared or repeated? |
| Deadline | Invoice received by June 30; payment complete by July 31 | Are late-document exceptions possible? |

## 9. Security, privacy, and compliance requirements

The product will handle sensitive information about young people and payroll. Treat all uploaded content as confidential even if the precise regulatory classification is still being determined.

- Use least-privilege, role-based access.
- Encrypt data in transit and at rest.
- Separate organizations and programs at the data layer if the product expands beyond Land and Earn.
- Avoid extracting or displaying bank account, Social Security, tax, or unrelated deduction details unless explicitly required.
- Redact sensitive payroll details in previews and follow-up drafts when they are not needed.
- Log access to documents and material data changes.
- Define backup, recovery, incident-response, and breach-notification responsibilities before production.
- Confirm hosting, data residency, grant terms, youth-data obligations, and AI vendor data-use/retention terms with Baxus.
- Require human review for low-confidence extraction, overrides, approval, and all external communications.

## 10. Usability and accessibility requirements

- Optimize for a team of one: the default screen must prioritize exceptions and next actions.
- Use plain language such as “Supervisor signature missing,” not model or OCR terminology.
- Keep the original document visible beside extracted fields during review.
- Minimize repeated data entry and preserve employer-specific mappings after confirmation.
- Meet WCAG 2.2 AA for the web interface.
- Work on current desktop browsers; mobile upload is desirable but not required for MVP.

## 11. Success metrics

Baseline measurements will be collected during discovery and the pilot.

### Primary metrics

- Median hands-on minutes required to make one packet review-ready.
- Percentage of packets complete by the invoice deadline.
- Percentage of employers of record reimbursed by the payment deadline.
- Percentage of employer purchase-order balances that match the authoritative fiscal record.
- Percentage of system-raised exceptions confirmed as valid by Ishmel.
- Percentage of extracted critical fields accepted without correction.

### Guardrail metrics

- False-negative rate for missing signatures and material amount/date conflicts.
- Number of packets incorrectly marked ready for approval.
- Number of approved invoices that exceed the linked purchase-order funding (target: zero).
- Number of external messages sent without intended human approval (target: zero).
- Time required to retrieve a complete historical packet for review or audit.

### Proposed pilot targets

- Reduce median packet-preparation time by at least 50%.
- Achieve at least 95% accuracy on critical typed fields after employer-template calibration.
- Detect at least 95% of missing required signatures in the pilot set.
- Ensure 100% of approved packets have a recorded human approval and complete audit trail.

Targets must be revised after testing against representative historical documents, especially handwritten or low-quality scans.

## 12. MVP acceptance criteria

The MVP is ready for a controlled pilot when:

1. Ishmel can upload representative documents from at least three employers with materially different formats.
2. The system preserves originals and correctly classifies purchase orders/amendments, invoices, timesheets/time records, payroll evidence, business-expense supporting documents, MOUs, and unknown files.
3. Critical fields can be extracted, traced to their source, corrected, and audited.
4. Documents can be assembled into employer reimbursement packets, including a multi-intern payroll report or invoice and business-expense evidence linked to the applicable MOU.
5. Missing documents, missing signatures, uncertain values, and defined cross-document conflicts are clearly distinguished.
6. The product derives activity-category hours from supporting documents and reconciles their total to the hours and amount actually paid.
7. Required invoice details are validated, and Priority 1 issues prevent `Ready for approval` unless an authorized override is documented.
8. Each business-expense line is tested against the IRS baseline, applicable federal/ARC and Land and Earn grant rules, approved budget, and effective employer/grant MOU; the decision is linked to its supporting documents and specific governing evidence.
9. The validated wage subtotal plus eligible business-expense subtotal reconciles to the payable invoice amount.
10. Each invoice is linked to the correct employer purchase order, reduces current funding available exactly once upon receipt, and exposes a traceable balance calculation.
11. Corrections, rejections, withdrawals, voids, approvals, payments, and PO amendments update balances through append-only ledger entries without double-counting.
12. No packet becomes approved when it exceeds available PO funding or without a human action.
13. The product creates recipient-specific follow-up and fiscal-year reminder drafts but never sends them automatically.
14. Search and export can retrieve a complete packet, PO ledger, and history.
15. Role-based access, encryption, backups, and retention behavior have been verified for the pilot environment.
16. A test against labeled historical packets meets the agreed accuracy and false-negative thresholds.

## 13. Delivery approach

### Phase 0 — discovery and data mapping

- Collect redacted or securely provided examples of every employer’s purchase orders/amendments, invoices, timesheets, payroll, business-expense evidence, and current/historical MOU formats.
- Document the current intake channels, volume, pay periods, turnaround times, and exception patterns.
- Interview Ishmel and one Baxus fiscal/compliance reviewer.
- Build the authoritative field dictionary and validation-rule matrix.
- Establish a labeled evaluation set that is separate from development examples.

### Phase 1 — internal document pilot

- Upload-only intake.
- Classification, extraction, packet matching, exception review, audit trail, and export.
- No external accounts and no email sending.
- Pilot on historical or duplicate-process packets before relying on the output operationally.

### Phase 2 — live workflow pilot

- Deadline dashboard and follow-up drafting.
- Optional email integration with per-message human approval.
- Live use with a small number of employers while the existing process remains the system of record.

### Phase 3 — scale and integrations

- Employer submission links or portal, email ingestion, fiscal-system export, configurable programs, and expanded reporting based on measured pilot needs.

## 14. Major risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Poor scans or handwriting | Incorrect or missing extraction | Confidence thresholds, source highlighting, human review, employer-specific templates |
| Undefined reimbursement rules | Incorrect flags or false readiness | Fiscal sign-off on a versioned rule matrix before automation |
| IRS baseline mistaken for grant approval | Ineligible federal costs are reimbursed | Apply the full rule hierarchy, make stricter grant terms controlling, and cite governing evidence for every decision |
| Outdated grant, budget, or MOU version | Incorrect eligibility determination | Version governing documents, record effective dates, and require fiscal confirmation of authoritative versions |
| Invoice is counted twice or against the wrong PO | Employer funding is understated or misallocated | Unique invoice/version controls, one active PO link, idempotent ledger posting, and reconciliation to fiscal records |
| Corrected or rejected invoice does not release funding | Available funding is understated and later invoices are blocked | Append-only adjustment/reversal events and explicit invoice-version status rules |
| PO overrun | Reimbursement exceeds authorized employer funding | Real-time balance validation and Priority 1 blocking before approval |
| One document covers many interns | Incorrect packet matching or double counting | Many-to-many evidence links and explicit reviewer confirmation |
| Sensitive youth/payroll data exposure | Harm and compliance breach | Data minimization, redaction, encryption, access controls, vendor review |
| Automation hides errors | Audit or reimbursement risk | No autonomous approval, explainable checks, false-negative testing |
| Tool adds work for a team of one | Low adoption | Exception-first interface, bulk intake, staged pilot, measure hands-on time |
| June/July deadline concentration | Operational failure at peak volume | Deadline alerts, capacity/load testing, fallback export and documented manual procedure |
| Employer-specific drift | Accuracy degrades when templates change | Drift monitoring, unknown-template queue, rapid mapping updates |

## 15. Open product decisions

These questions should be answered before the PRD is approved:

### Process and volume

1. How many interns, employers of record, packets, and pages are processed per week, month, and peak June period?
2. Which employers differ from the usual biweekly pay period, and what are the average document turnaround times?
3. Through which channels do documents arrive today: email, shared drive, paper, text message, portal, or a mix?
4. Who besides Ishmel reviews, approves, pays, audits, or retrieves these packets?

### Purchase orders and funding

5. Can an employer have more than one active purchase order for Land and Earn, and can a purchase order span multiple fiscal years or grants?
6. Is the balance that staff call “current funding available” calculated from received invoice totals, approved amounts, paid amounts, or another fiscal-system value?
7. When an invoice is returned for correction, should its funding remain committed until a replacement arrives, or be released immediately?
8. How are PO increases, reductions, cancellations, and carry-forwards authorized and documented?
9. What existing fiscal system is authoritative for PO and invoice balances, and how frequently must this product reconcile to it?

### Rules and evidence

10. What exact fields and signatures are required by the grant, Baxus, and each employer?
11. What formula determines the reimbursable wage amount, including taxes, fringe, and overtime?
12. Can one invoice or payroll report cover multiple interns or pay periods, and how is each intern’s share represented?
13. What types of signature are acceptable, and must signature dates be captured?
14. Which document is authoritative when hours, dates, names, or amounts conflict?
15. Who can approve an exception, and what justification is required?
16. Which business-expense categories, limits, conditions, and evidence requirements appear across the current employer/grant MOUs?
17. Must each business expense be tied to a specific intern or pay period, or can it apply to the employer’s participation in the program more broadly?
18. If an invoice contains an ineligible or unsupported business-expense line, can the valid wage and expense lines be reimbursed while that line is returned for correction?
19. Where are the signed Land and Earn Grant Agreement, approved budget, amendments, ARC correspondence, and current employer MOUs stored, and who confirms which version is authoritative?

### Security and operations

20. Where must the system and files be hosted, and what existing identity provider should control access?
21. Which personal/payroll fields may be stored, which must be redacted, and which must never enter the system?
22. Does “seven years” begin at document date, fiscal-year close, grant closeout, or another event?
23. Is Gmail, Outlook, or another email system used, and should initial follow-up remain copy/paste?
24. What export format does fiscal staff need?

## 16. Recommended first working session

Use a 60–90 minute mapping session with Ishmel and a fiscal reviewer to walk through one real packet from receipt through payment. Capture:

- every document and handoff;
- the authoritative PO amount and a reconciliation of historical invoice activity to the current available balance;
- the fields actually checked;
- the calculation used to approve reimbursement;
- common exceptions and who resolves each one;
- the point at which a packet becomes “complete,” “approved,” and “paid”; and
- the evidence needed seven years later during an audit.

The output should be a signed-off field dictionary, rule matrix, and workflow diagram. Those artifacts are the prerequisite for reliable AI extraction and reconciliation.

## Appendix A. Initial normalized field set

| Entity | Initial fields |
|---|---|
| Intern | internal ID, legal/display name, county, placement, employer of record, active dates |
| Organization | legal/display name, type, address, county, contacts, signing authorities, pay schedule, document rules |
| Program terms | program-wide hourly rate, effective dates, fiscal year, invoice deadline, payment deadline, retention period |
| Grant governing evidence | document type, grant number, version/effective dates, authority level, approved scope/budget provisions, period of performance, source file |
| MOU | employer, grant/program, version, effective dates, allowed business-expense categories, limits, conditions, required evidence |
| Purchase order | employer, grant/program, PO number, original amount, amendment total, current authorized funding, effective dates, status, source documents |
| PO funding event | PO, event type, event date, amount/delta, invoice or amendment link, actor/source, balance before, balance after, reversal link |
| Pay period | employer of record, start date, end date, pay date, fiscal year |
| Timesheet/time record | work dates, scheduled shifts, source activity descriptions, normalized activity categories, category hours, total hours, intern signature/date, supervisor signature/date |
| Payroll evidence | check/payment date, hour categories, total hours, rate, gross pay, eligible employer costs, net pay if required |
| Business-expense evidence | expense date/period, description, business purpose, category, amount, related intern if applicable, source document |
| Invoice | employer legal name/address, invoice number/date, service period, typed wage and business-expense line items, wage subtotal, business-expense subtotal, total amount, signing-authority name/title/signature/date |
| Reimbursement claim | claim type, employer, intern if applicable, pay/reimbursement period, amount requested, amount eligible, linked evidence, applicable IRS/federal/ARC/grant/MOU provisions |
| Eligibility decision | claim, IRS baseline result, federal/ARC result, grant/budget result, MOU result, controlling rule, reviewer, decision, reason |
| Packet | employer, purchase order, reimbursement period, interns/pay periods, linked evidence, wage and business-expense subtotals, funding commitment, balance before/after, priority exceptions, reminder drafts, approval, payment status |
| Contact | organization, role, name, email, responsibility for exception types |
| Audit event | actor, timestamp, action, previous value, new value, reason |

## Appendix B. Assumptions in this draft

- “Baxus” is the correct organization spelling; confirm whether it should be “Berea College,” “Baxus,” or another legal/grantee entity in product copy and records.
- Ishmel is the preferred spelling and pronouns should be confirmed.
- The product will support one program and one primary operator first, while avoiding a data model that prevents later multi-program use.
- Human review remains mandatory because source formats, signature types, and fiscal rules have not yet been inventoried.
- Email sending and employer self-service are not required to prove the core value of document reconciliation.

## Appendix C. Initial business-expense policy sources

These sources establish the starting rules engine. The signed Land and Earn award documents and approved amendments must be added before live eligibility decisions are made.

- [IRS Publication 583: Starting a Business and Keeping Records](https://www.irs.gov/publications/p583) — ordinary and necessary business-expense baseline and recordkeeping guidance.
- [IRS: What kind of records should I keep?](https://www.irs.gov/businesses/small-businesses-self-employed/what-kind-of-records-should-i-keep) — supporting records should identify the payee, amount, proof of payment, date incurred, and item or service description.
- [ARC Grant Administration Manual for Non-Construction Grants](https://www.arc.gov/resource/grant-administration-manual-for-arc-non-construction-grants/) — ARC award administration, approved budget and scope, period-of-performance, documentation, and federal cost-principle requirements.
- [2 CFR Part 200, Subpart E—Cost Principles](https://www.ecfr.gov/current/title-2/subtitle-A/chapter-II/part-200/subpart-E) — federal allowability, reasonableness, allocability, consistency, documentation, and cost-category rules.
- Land and Earn ARC Grant Agreement, approved budget, approved amendments, and employer MOUs — private, controlling project documents to be collected and versioned during discovery.
