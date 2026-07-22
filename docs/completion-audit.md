# Land & Earn MVP completion audit

This matrix maps the PRD’s controlled-pilot acceptance criteria to current authoritative evidence. “Implemented” means the product behavior exists and has local evidence; it does not replace Baxus policy approval or representative-document validation.

| # | Acceptance criterion | Current evidence | Status |
|---|---|---|---|
| 1 | Upload representative documents from three employers | Multi-file intake works and the demo includes four employers. Synthetic fixtures exercise materially different document roles, but Baxus has not supplied representative historical files from three employers. | External evidence required |
| 2 | Preserve and classify PO/amendment, invoice, time, payroll, expense, MOU, unknown | Originals are stored unchanged in R2 with SHA-256 duplicate detection. Local structured-file extraction and a guarded OpenAI file/image adapter classify all named types; empty or unreadable local content produces a visible review warning. PO and MOU records retain links to their governing originals. | Implemented; representative-format evaluation pending |
| 3 | Extract, source-trace, correct, and audit critical fields | `document_field_evidence` records value, confidence, and source locator. The packet review shows the protected original, permits reasoned correction or verification, and writes append-only audit events. | Implemented |
| 4 | Assemble packets, including multi-intern evidence | Documents can be linked to multiple packets without copying the original or adding a second PO commitment. Expense claims link to their specific supporting document. | Implemented; multi-employer historical test pending |
| 5 | Distinguish missing evidence, signatures, uncertain values, and conflicts | Automated reconciliation creates plain-language P1/P2 exceptions, signature checks are document-type-specific, and low-confidence fields require review. P1 blockers require corrected evidence or a governing decision under the current pilot policy; reasoned P2 resolutions are separately recorded. | Implemented |
| 6 | Derive activity hours and reconcile them to paid hours and amount | Supporting-document activities are categorized, summed, and compared with timesheet hours, payroll hours, program rate, gross pay, and invoice claims. Synthetic 20-hour coverage passes all four activity categories. | Implemented for structured fixtures; accuracy evaluation pending |
| 7 | Validate invoice completeness and block Priority 1 issues | Legal name, address, invoice number/date, service period, total, and authorized signature are required. Approval re-runs reconciliation and rejects open P1 issues. | Implemented |
| 8 | Evaluate each expense through IRS, federal/ARC, grant/budget, and MOU evidence | Every business claim receives four stored checks, a period-applicable MOU, a supporting-document link, reviewer evidence/reason, and a final decision. No line can be marked eligible until every check passes. The signed award/budget still must be supplied. | Implemented; authoritative grant evidence required |
| 9 | Reconcile wage + eligible expense subtotals to payable invoice | The system compares requested wages plus eligible expense amounts with the invoice and blocks a mismatch. | Implemented |
| 10 | Link invoice to PO and commit exactly once | Invoice receipt posts an idempotent ledger commitment. SHA-256 duplicates and shared evidence do not post again. A local shared-payroll scenario left Red Bird’s commitment unchanged at $93,120. | Implemented and locally verified |
| 11 | Append-only corrections, reversals, approvals, payments, and amendments | Corrected invoice versions supersede prior claims, inherit exact supporting-evidence links, and post only their funding delta. Rejection/withdrawal/void releases post reversals; approvals, payments, and PO amendments append typed ledger and audit events. Prior events are not edited. | Implemented |
| 12 | Never approve over PO funding or without human action | Approval is an explicit program-manager action and server-side guards reject missing evidence, unresolved review, non-reconciling claims, inactive/out-of-period POs, and over-commitment. | Implemented and locally verified |
| 13 | Create recipient-specific follow-up and year-end reminder drafts; never auto-send | Manual bulk preparation creates separate employer and placement-supervisor drafts from unresolved owner roles, uses configured deadlines, excludes sensitive values, and exposes edit/copy/discard/review only. No send operation exists. | Implemented and locally verified |
| 14 | Search and export complete packet, ledger, and history | Search covers intern, employer, PO, invoice, county, FY, period, status, and missing item. Export produces a ZIP with HTML summary, claims/checks, ledger, audit history, README, and every available original. | Implemented and locally verified |
| 15 | Verify role access, encryption, backups, and retention | The pilot site is private and uses HTTPS, D1, R2, no-store document responses, access logging, and a configurable minimum seven-year retention period. Application-level role separation, backup/restore evidence, retention enforcement, and deletion approval remain organizational deployment gates. | External operational verification required |
| 16 | Meet accuracy and false-negative thresholds on labeled historical packets | Unit fixtures verify critical local extraction and missing-signature behavior, but no labeled Baxus historical set has been supplied. | External evidence required |

## Current automated and runtime evidence

- Production build completes for the application and all five API routes.
- TypeScript and ESLint pass.
- Ten automated tests pass, including invoice extraction, activity allocation, signature false-negative protection, PO/MOU classification, duplicate hashing, approval/export guards, and built application/storage declarations.
- Local API scenarios verify multi-file processing, exact duplicate handling, shared evidence without double commitment, corrected-invoice supersession, source-linked PO/MOU records, approval blocking, documented Priority 2 resolution, claim-to-receipt linking, recipient-specific drafts, original retrieval, and complete ZIP export.

## Completion dependencies

- Baxus must approve the AI provider and sensitive-data handling terms before payroll or youth records are sent to a model API.
- Baxus must provide redacted representative documents and a labeled evaluation set to prove the PRD’s extraction and missing-signature targets.
- Fiscal staff must load and approve the authoritative Land and Earn award, approved budget/amendments, MOU rules, tolerances, override authority, and eligible-expense interpretations.
- Hosting owners must verify application roles, backup/restore, incident response, data residency, breach notification, and defensible deletion after the seven-year retention period.
