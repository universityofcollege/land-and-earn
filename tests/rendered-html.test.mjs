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
  for (const table of ["employers", "purchaseOrders", "packets", "documents", "packetExceptions", "poEvents", "policies"]) {
    assert.match(schema, new RegExp(`export const ${table}`));
  }
  assert.match(data, /Current funding available|invoice_received|purchase-order ledger/i);
  assert.match(page, /Get every employer reimbursed/);
  assert.match(page, /The strictest rule controls/);
  assert.ok(migrations.some((file) => file.endsWith(".sql")), "expected a generated D1 migration");
});
