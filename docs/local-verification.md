# Local verification record

Date: 2026-07-22  
Environment: local Next.js + libSQL database + filesystem-backed document storage
Data: synthetic fixtures only; no real youth or payroll PII

## Automated gates

```text
TypeScript: pass
ESLint: pass
Production build: pass
Node tests: 14 passed, 0 failed
```

## Runtime scenarios

| Scenario | Observed result |
|---|---|
| Upload invoice, timesheet, payroll, and expense receipt | Correctly classified; originals stored; evidence and confidence returned |
| Upload and register PO and MOU source records | Employer shows the linked PO original and both effective-dated MOU versions show their signed source when available |
| Link a versioned grant/budget source to an eligibility rule | Rule shows the source original, version, effective period, and verified status; the document leaves the unmatched queue and expense checks cite it |
| Resolve public versus private governing evidence | Official HTTPS IRS/ARC/eCFR sources satisfy public-authority evidence; Land and Earn checks still require the uploaded award/budget and MOU checks still require the signed effective MOU |
| Upload a corrected invoice | Prior claims are superseded, the replacement version becomes current, the support link is inherited, and the PO ledger records only the delta |
| Upload exact duplicate timesheet | Existing document linked; no duplicate activity rows or PO event |
| Link one payroll report to a second intern packet | Both packets show the same source; Red Bird PO committed amount remains $93,120 |
| Attempt Priority 1 override, with or without a reason | HTTP 409; current pilot policy requires corrected evidence or a governing review decision |
| Resolve a Priority 2 review item with reason | Resolution type, actor, reason, before/after values, and timestamp appear in history |
| Claim business expense without receipt link | Approval blocked and `Business expense supporting evidence missing` raised |
| Link synthetic receipt to the expense claim | Link recorded in history; supporting-evidence blocker cleared; claim count remains unchanged |
| Upload timesheet with absent supervisor signature | `Supervisor signature missing` assigned to `Placement supervisor` |
| Prepare reminders | Separate draft-only recipient records created; no send endpoint or automatic send path exists |
| Export packet | HTTP 200 `application/zip`; archive contains `packet-summary.html`, `README.txt`, and four available original files |
| Retrieve original | HTTP 200 private/no-store response and `original_viewed` audit event |
| Anonymous request in required-auth mode | HTTP 401 |
| Program-manager identity in allowlist | Dashboard HTTP 200 with manager role and named actor |
| Fiscal-reviewer identity in allowlist | Dashboard HTTP 200; mutation attempt HTTP 403 |
| Retention safety ordering | Non-destructive automated inspection confirms typed packet ID, confirmed policy, elapsed date, and archived-status guards execute before any private-blob deletion |

## Reproduction commands

Use Node 22.13 or newer.

```bash
npm run lint
npm run build
node --test tests/rendered-html.test.mjs tests/extraction.test.ts
```

The local development URL is `http://localhost:3001/` while the current Codex task’s dev server is running. Localhost uses an explicit development-only manager identity unless `AUTH_MODE=required`; hosted environments always require the forwarded workspace identity and an email allowlist assignment. No destructive retention test was run against live local records.
