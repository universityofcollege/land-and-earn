import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("build contains the Land and Earn application shell", async () => {
  const [layout, page] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /Land & Earn · Grant Operations/i);
  assert.match(page, /Opening the reimbursement desk/i);
  assert.doesNotMatch(`${layout}${page}`, /FundGuide|Your site is taking shape|codex-preview/i);
});

test("declares durable grant records and upload storage", async () => {
  const [packageJson, database, storage, schema, data, page, migrations] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../lib/database.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readdir(new URL("../drizzle/", import.meta.url)),
  ]);
  assert.match(packageJson, /@libsql\/client/);
  assert.match(packageJson, /@vercel\/blob/);
  assert.match(database, /TURSO_DATABASE_URL/);
  assert.match(storage, /access: "private"/);
  for (const table of ["employers", "purchaseOrders", "packets", "documents", "packetExceptions", "poEvents", "policies", "programSettings", "mous", "documentPacketLinks", "documentFieldEvidence", "reimbursementClaims", "eligibilityChecks", "auditEvents"]) {
    assert.match(schema, new RegExp(`export const ${table}`));
  }
  assert.match(data, /Current funding available|invoice_received|purchase-order ledger/i);
  assert.match(page, /Get every employer reimbursed/);
  assert.match(page, /The strictest rule controls/);
  assert.ok(migrations.some((file) => file.endsWith(".sql")), "expected a generated SQLite migration");
});

test("declares human approval, draft-only communication, and complete audit export guards", async () => {
  const [data, operations, exportRoute, page] = await Promise.all([
    readFile(new URL("../lib/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/operations/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/export/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(data, /Resolve all payment blockers before approval/);
  assert.match(data, /every business-expense line must be linked to its supporting document/);
  assert.match(data, /packet_archive_exported/);
  assert.match(data, /zipSync/);
  assert.match(exportRoute, /application\/zip/);
  assert.match(page, /Draft only · nothing sends automatically/);
  assert.doesNotMatch(operations, /send_(?:email|reminder)|auto_send/i);
  assert.doesNotMatch(operations, /gmail|outlook|smtp|sendgrid/i);
});

test("enforces role access and source-linked governing decisions", async () => {
  const [auth, dashboardRoute, operationsRoute, filesRoute, exportRoute, data, nextConfig] = await Promise.all([
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/operations/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/files/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/export/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
  ]);
  assert.match(auth, /oai-authenticated-user-email/);
  assert.match(auth, /Fiscal reviewers have read-only access/);
  for (const route of [dashboardRoute, operationsRoute, filesRoute, exportRoute]) assert.match(route, /requireIdentity/);
  assert.match(operationsRoute, /requireIdentity\(request, "manage"\)/);
  assert.match(data, /Link the specific governing source document before this check can pass/);
  assert.match(data, /governing_source_linked/);
  assert.match(nextConfig, /private, no-store/);
  assert.match(nextConfig, /X-Frame-Options/);
});

test("guards post-retention disposition before destructive storage work", async () => {
  const [schema, data, page] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /retentionDispositions/);
  const disposition = data.slice(data.indexOf("export async function disposePacket"), data.indexOf("export async function reviewReminder"));
  for (const guard of ["Type the packet ID exactly", "confirmed retention policy", "Retention has not elapsed", "Only an archived packet"]) assert.match(disposition, new RegExp(guard));
  assert.ok(disposition.indexOf("confirmed retention policy") < disposition.indexOf("deleteOriginal"));
  assert.ok(disposition.indexOf("Retention has not elapsed") < disposition.indexOf("deleteOriginal"));
  assert.ok(disposition.indexOf("Only an archived packet") < disposition.indexOf("deleteOriginal"));
  assert.match(disposition, /sharedDocumentsRetained/);
  assert.match(disposition, /retention_disposition_completed/);
  assert.match(page, /Deletion remains disabled until this policy and anchor date are explicitly confirmed/);
});

test("removes the Sites and Cloudflare runtime", async () => {
  const [packageJson, data, auth] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../lib/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(packageJson, /vinext|wrangler|@cloudflare\/vite-plugin|@openai\/sites-vite-plugin/);
  assert.doesNotMatch(`${data}${auth}`, /cloudflare:workers|env\.FILES|env\.DB/);
  assert.match(auth, /public_demo/);
  assert.match(auth, /vercel_protected/);
});
