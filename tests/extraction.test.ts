import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { extractDocument, sha256 } from "../lib/extraction.ts";

async function fixture(name: string) {
  const bytes = await readFile(new URL(`./fixtures/${name}`, import.meta.url));
  return new File([bytes], name, { type: "text/csv" });
}

test("extracts and source-traces a complete invoice", async () => {
  const result = await extractDocument(await fixture("redbird-invoice.csv"), "unknown", {});
  assert.equal(result.documentType, "invoice");
  assert.equal(result.classificationConfidence, 88);
  assert.equal(result.provider, "local");
  assert.equal(result.fields.find((field) => field.name === "employerLegalName")?.value, "Red Bird Mission");
  assert.equal(result.fields.find((field) => field.name === "invoiceNumber")?.value, "RB-TEST-001");
  assert.equal(result.fields.find((field) => field.name === "signingAuthorityName")?.value, "Dana Example");
  assert.equal(result.fields.find((field) => field.name === "signingAuthorityTitle")?.value, "Finance Director");
  assert.equal(result.fields.find((field) => field.name === "authorizedSignaturePresent")?.value, "true");
  assert.ok(result.fields.every((field) => field.source.startsWith("Text line") || field.source.startsWith("No matching")));
  assert.deepEqual(result.claims.map((claim) => [claim.type, claim.amount]), [["intern_wages", 320], ["business_expense", 50]]);
  assert.equal(result.claims[1].category, "Required training");
});

test("extracts activity allocations and only timesheet signatures", async () => {
  const result = await extractDocument(await fixture("redbird-timesheet.csv"), "unknown", {});
  assert.equal(result.documentType, "timesheet");
  assert.equal(result.fields.find((field) => field.name === "internSignaturePresent")?.value, "true");
  assert.equal(result.fields.find((field) => field.name === "supervisorSignaturePresent")?.value, "true");
  assert.equal(result.fields.some((field) => field.name === "authorizedSignaturePresent"), false);
  assert.equal(result.activities.reduce((sum, activity) => sum + activity.hours, 0), 20);
  assert.deepEqual(result.activities.map((activity) => activity.category), ["Job placement", "Community engagement", "Storytelling", "Soft skills"]);
});

test("flags an absent supervisor signature without exposing a false positive", async () => {
  const result = await extractDocument(await fixture("missing-supervisor-timesheet.csv"), "unknown", {});
  assert.equal(result.documentType, "timesheet");
  assert.equal(result.fields.find((field) => field.name === "internSignaturePresent")?.value, "true");
  assert.equal(result.fields.find((field) => field.name === "supervisorSignaturePresent")?.value, "false");
});

test("does not invent a PO number from the word report", async () => {
  const file = await fixture("redbird-payroll.csv");
  const result = await extractDocument(file, "unknown", {});
  assert.equal(result.documentType, "payroll");
  assert.equal(result.fields.some((field) => field.name === "purchaseOrderNumber"), false);
  assert.equal(result.fields.some((field) => field.name.endsWith("SignaturePresent")), false);
  assert.equal(result.fields.find((field) => field.name === "grossPay")?.value, "$320.00");
});

test("classifies an expense receipt as supporting evidence", async () => {
  const result = await extractDocument(await fixture("redbird-expense-receipt.csv"), "unknown", {});
  assert.equal(result.documentType, "business_expense");
  assert.equal(result.claims.length, 0, "the supporting receipt must not duplicate the invoice claim");
});

test("classifies governing PO and MOU records", async () => {
  const po = await extractDocument(await fixture("redbird-po.txt"), "unknown", {});
  const mou = await extractDocument(await fixture("redbird-mou.txt"), "unknown", {});
  assert.equal(po.documentType, "purchase_order");
  assert.equal(po.fields.find((field) => field.name === "purchaseOrderNumber")?.value, "PO-26-1177");
  assert.equal(mou.documentType, "mou");
});

test("hashing is stable and content-sensitive", async () => {
  const first = await fixture("redbird-payroll.csv");
  const second = await fixture("redbird-payroll.csv");
  const changed = new File(["Payroll earnings report\nGross pay: $321.00"], "redbird-payroll.csv", { type: "text/csv" });
  assert.equal(await sha256(first), await sha256(second));
  assert.notEqual(await sha256(second), await sha256(changed));
});
