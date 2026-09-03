# Land & Earn Grant Operations

A human-in-the-loop grant operations assistant for the Land and Earn internship program. It ingests reimbursement evidence, reconciles invoices, payroll records, and timesheets, flags missing or conflicting evidence, tracks purchase-order funding, and drafts follow-up messages for program staff.

## Runtime

The application is a standard Next.js app designed for Vercel:

- Next.js App Router and Vercel Functions
- Turso Cloud (SQLite over HTTP) for durable records
- private Vercel Blob storage for original documents
- optional OpenAI Responses API extraction

The database initializes its schema and demonstration records on first use. Uploaded originals are private and are served only through the authenticated `/api/files` route.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Without Turso variables, local development uses `land-and-earn.db`. Without a Blob token, uploaded files are stored under `.local/files`. Both paths are ignored by Git.

Run the complete verification suite with:

```bash
npm test
```

## Deploy to Vercel

1. Import this GitHub repository into Vercel. Vercel detects Next.js automatically.
2. From the project’s **Storage** tab, install the **Turso Cloud** Marketplace integration. It supplies `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
3. Create and connect a **private Vercel Blob** store. It supplies `BLOB_READ_WRITE_TOKEN`.
4. Add the optional AI extraction variables shown in `.env.example` if automated extraction should be enabled.
5. Choose an access mode:
   - For a public demonstration containing no real participant, payroll, banking, or grant records, set `AUTH_MODE=public_demo`.
   - For a review deployment protected by Vercel Authentication, enable Deployment Protection in Vercel and set `AUTH_MODE=vercel_protected`.
   - For production with named program-manager and fiscal-reviewer identities, leave `AUTH_MODE` unset and place the app behind an identity layer that supplies `oai-authenticated-user-email`; configure the role allowlists with `PROGRAM_MANAGER_EMAILS` and `FISCAL_REVIEWER_EMAILS`.

Do not put real program documents in `public_demo` mode. Vercel Deployment Protection controls access to a deployment but does not supply the named identity headers used for the application audit trail, so `vercel_protected` records a generic authorized reviewer.

## Data migration note

This change moves new deployments from Sites/Cloudflare D1 and R2 to Turso and private Vercel Blob. The repository’s seeded demonstration data is recreated automatically. If an existing Sites deployment contains live records or uploaded originals, export and migrate those records before switching production traffic; this repository does not contain those remote credentials or files.

## Product documentation

- `docs/land-and-earn-prd.md` — product requirements and operating model
- `docs/local-verification.md` — local verification scenarios
- `docs/completion-audit.md` — feature completion and risk audit

## Infrastructure references

- [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [Turso Cloud in the Vercel Marketplace](https://vercel.com/marketplace/tursocloud)
- [Vercel Blob private storage](https://vercel.com/docs/vercel-blob/private-storage)
- [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection)
