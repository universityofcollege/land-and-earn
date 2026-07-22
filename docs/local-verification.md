# Local verification record

Date: 2026-07-22  
Environment: local Vinext + Cloudflare Miniflare D1/R2  
Data: synthetic fixtures only; no real youth or payroll PII

## Automated gates

```text
TypeScript: pass
ESLint: pass
Production build: pass
Node tests: 10 passed, 0 failed
```

## Runtime scenarios

| Scenario | Observed result |
|---|---|
| Upload invoice, timesheet, payroll, and expense receipt | Correctly classified; originals stored; evidence and confidence returned |
| Upload and register PO and MOU source records | Employer shows the linked PO original and both effective-dated MOU versions show their signed source when available |
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

## Reproduction commands

Use Node 22.13 or newer.

```bash
npm run lint
npm run build
node --test tests/rendered-html.test.mjs tests/extraction.test.ts
```

The local development URL is `http://localhost:3001/` while the current Codex task’s dev server is running.
