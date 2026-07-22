import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("build contains the Land and Earn application shell", async () => {
  const [layout, page, builtWorker] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../dist/server/index.js", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /Land & Earn · Grant Operations/i);
  assert.match(page, /Opening the reimbursement desk/i);
  assert.match(builtWorker, /Land & Earn|reimbursement desk/i);
  assert.doesNotMatch(`${layout}${page}`, /FundGuide|Your site is taking shape|codex-preview/i);
});

test("declares durable grant records and upload storage", async () => {
  const [hosting, schema, data, page, migrations] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readdir(new URL("../drizzle/", import.meta.url)),
  ]);
  assert.match(hosting, /"d1":\s*"DB"/);
  assert.match(hosting, /"r2":\s*"FILES"/);
  for (const table of ["employers", "purchaseOrders", "packets", "documents", "packetExceptions", "poEvents", "policies", "programSettings", "mous", "documentPacketLinks", "documentFieldEvidence", "reimbursementClaims", "eligibilityChecks", "auditEvents"]) {
    assert.match(schema, new RegExp(`export const ${table}`));
  }
  assert.match(data, /Current funding available|invoice_received|purchase-order ledger/i);
  assert.match(page, /Get every employer reimbursed/);
  assert.match(page, /The strictest rule controls/);
  assert.ok(migrations.some((file) => file.endsWith(".sql")), "expected a generated D1 migration");
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
