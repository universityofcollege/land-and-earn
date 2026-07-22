export type ExtractedField = {
  name: string;
  value: string;
  confidence: number;
  source: string;
};

export type ExtractedActivity = {
  category: "Job placement" | "Community engagement" | "Storytelling" | "Soft skills" | "Other";
  hours: number;
  sourceDescription: string;
  source: string;
  confidence: number;
};

export type ExtractedClaim = {
  type: "intern_wages" | "business_expense";
  description: string;
  amount: number;
  businessPurpose: string;
  category: string;
  source: string;
  confidence: number;
};

export type DocumentExtraction = {
  documentType: string;
  classificationConfidence: number;
  fields: ExtractedField[];
  activities: ExtractedActivity[];
  claims: ExtractedClaim[];
  warnings: string[];
  sensitiveDataDetected: boolean;
  provider: "local" | "openai";
};

export type ExtractionConfig = {
  enabled?: boolean;
  apiKey?: string;
  model?: string;
};

const supportedKinds = new Set(["purchase_order", "invoice", "timesheet", "payroll", "business_expense", "mou", "grant_evidence", "unknown"]);
const money = (value: string) => Number(value.replace(/[$,\s]/g, ""));
const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function classify(fileName: string, text: string, selectedKind: string) {
  const corpus = normalized(`${fileName} ${text.slice(0, 4000)}`);
  const candidates: Array<[string, RegExp]> = [
    ["purchase_order", /\b(purchase order|po number|po #|authorized funding|amendment)\b/],
    ["invoice", /\b(invoice|bill to|remit to|amount due)\b/],
    ["payroll", /\b(pay stub|payroll|earnings|gross pay|net pay|deductions)\b/],
    ["timesheet", /\b(timesheet|time sheet|schedule|hours worked|clock in|clock out)\b/],
    ["mou", /\b(memorandum of understanding|mou|agreement between)\b/],
    ["business_expense", /\b(receipt|business expense|proof of payment|expense report)\b/],
    ["grant_evidence", /\b(grant agreement|notice of award|approved budget|appalachian regional commission)\b/],
  ];
  const match = candidates.find(([, pattern]) => pattern.test(corpus));
  if (match) return { kind: match[0], confidence: 88 };
  return { kind: supportedKinds.has(selectedKind) ? selectedKind : "unknown", confidence: selectedKind === "unknown" ? 25 : 58 };
}

function fieldFromPattern(text: string, name: string, pattern: RegExp, confidence = 82): ExtractedField | null {
  const match = text.match(pattern);
  if (!match?.[1]) return null;
  const before = text.slice(0, match.index ?? 0);
  const line = before.split(/\r?\n/).length;
  return { name, value: match[1].trim(), confidence, source: `Text line ${line}` };
}

function activityCategory(description: string): ExtractedActivity["category"] {
  const value = normalized(description);
  if (/story|interview|oral history|community investigation|photo|video|newsletter/.test(value)) return "Storytelling";
  if (/community|service|volunteer|feeding|food|cleanup|outreach/.test(value)) return "Community engagement";
  if (/soft skill|workshop|network|professional dress|career|entrepreneur|training/.test(value)) return "Soft skills";
  if (/placement|shift|restaurant|office|retail|work|job/.test(value)) return "Job placement";
  return "Other";
}

function expenseCategory(description: string) {
  const value = normalized(description);
  if (/required training|safety training|workplace training/.test(value)) return "Required training";
  if (/uniform|apparel|work clothing|badge/.test(value)) return "Required work apparel";
  if (/safety equipment|protective equipment|ppe/.test(value)) return "Safety equipment";
  if (/program supplies|office supplies|supplies/.test(value)) return "Program supplies";
  if (/mileage|vehicle/.test(value)) return "Mileage";
  if (/equipment/.test(value)) return "Equipment";
  return "Unclassified";
}

function extractFromText(fileName: string, text: string, selectedKind: string): DocumentExtraction {
  const detected = classify(fileName, text, selectedKind);
  const fields = [
    fieldFromPattern(text, "employerLegalName", /(?:^|\n)\s*(?:employer(?:\s+legal\s+name)?|vendor|legal\s+name)\s*[:#-]\s*([^\n,]{3,100})/i, 82),
    fieldFromPattern(text, "invoiceNumber", /(?:invoice\s*(?:number|no\.?|#)\s*[:#-]?\s*)([A-Z0-9][A-Z0-9._/-]+)/i, 91),
    fieldFromPattern(text, "purchaseOrderNumber", /\b(?:purchase\s+order|p\.?o\.?)\b\s*(?:number|no\.?|#)?\s*[:#-]\s*([A-Z0-9][A-Z0-9._/-]+)/i, 89),
    fieldFromPattern(text, "invoiceDate", /(?:invoice\s+date|date)\s*[:#-]?\s*([0-9]{1,4}[\/-][0-9]{1,2}[\/-][0-9]{1,4})/i),
    fieldFromPattern(text, "periodStart", /(?:period|pay period|service period)\s*(?:start|from)?\s*[:#-]?\s*([0-9]{1,4}[\/-][0-9]{1,2}[\/-][0-9]{1,4})/i),
    fieldFromPattern(text, "periodEnd", /(?:period|pay period|service period)[^\n]{0,45}(?:to|through|end)\s*([0-9]{1,4}[\/-][0-9]{1,2}[\/-][0-9]{1,4})/i),
    fieldFromPattern(text, "totalHours", /(?:total\s+hours|hours\s+worked|paid\s+hours)\s*[:#-]?\s*([0-9]+(?:\.[0-9]+)?)/i, 90),
    fieldFromPattern(text, "hourlyRate", /(?:hourly\s+rate|pay\s+rate|rate)\s*[:#-]?\s*\$?([0-9]+(?:\.[0-9]{1,2})?)/i),
    fieldFromPattern(text, "grossPay", /(?:gross\s+pay|gross\s+earnings)\s*[:#-]?\s*(\$?[0-9][0-9,]*(?:\.[0-9]{2})?)/i, 91),
    fieldFromPattern(text, "invoiceAmount", /(?:invoice\s+total|amount\s+due|total\s+due|total)\s*[:#-]?\s*(\$?[0-9][0-9,]*(?:\.[0-9]{2})?)/i, 86),
    fieldFromPattern(text, "employerAddress", /(?:remit\s+to|address)\s*[:#-]?\s*([^\n]{8,120})/i, 70),
    fieldFromPattern(text, "signingAuthorityName", /(?:authorized\s+(?:by|signer)|signing\s+authority(?:\s+name)?)\s*[:#-]\s*([^\n]{2,80})/i, 78),
    fieldFromPattern(text, "signingAuthorityTitle", /(?:signing\s+authority\s+title|authorized\s+signer\s+title)\s*[:#-]\s*([^\n]{2,80})/i, 78),
    fieldFromPattern(text, "signatureDate", /(?:signature\s+date|signed\s+date)\s*[:#-]\s*([0-9]{1,4}[\/-][0-9]{1,2}[\/-][0-9]{1,4})/i, 78),
  ].filter((item): item is ExtractedField => Boolean(item));

  const signatureSignals: Array<[string, RegExp]> = detected.kind === "timesheet" ? [
    ["internSignaturePresent", /intern[ \t]+signature[ \t]*[:#-]?[ \t]*(signed|yes|\/s\/)/i],
    ["supervisorSignaturePresent", /supervisor[ \t]+signature[ \t]*[:#-]?[ \t]*(signed|yes|\/s\/)/i],
  ] : detected.kind === "invoice" ? [
    ["authorizedSignaturePresent", /(?:authorized[ \t]+signature|signature[ \t]+of[ \t]+authorized)[ \t]*[:#-]?[ \t]*(signed|yes|\/s\/)/i],
  ] : [];
  for (const [name, pattern] of signatureSignals) {
    const match = text.match(pattern);
    fields.push({ name, value: match ? "true" : "false", confidence: match ? 84 : 62, source: match ? `Text line ${text.slice(0, match.index ?? 0).split(/\r?\n/).length}` : "No matching signature label found" });
  }

  const activities: ExtractedActivity[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const match = line.match(/^\s*(.+?)[,|\t]\s*([0-9]+(?:\.[0-9]+)?)\s*(?:hours?|hrs?)?\s*$/i);
    if (!match) return;
    const description = match[1].trim();
    if (/total|amount|rate|gross|net/i.test(description)) return;
    activities.push({ category: activityCategory(description), hours: Number(match[2]), sourceDescription: description, source: `Text line ${index + 1}`, confidence: 76 });
  });

  const claims: ExtractedClaim[] = [];
  lines.forEach((line, index) => {
    const match = line.match(/^(.*?(?:wages?|uniform|training|supplies|equipment|mileage|expense).*?)\s+\$?([0-9][0-9,]*(?:\.[0-9]{2})?)\s*$/i);
    if (!match) return;
    const description = match[1].trim();
    const type = /wage|payroll|salary/i.test(description) ? "intern_wages" : "business_expense";
    claims.push({ type, description, amount: money(match[2]), businessPurpose: "", category: type === "intern_wages" ? "Intern wages" : expenseCategory(description), source: `Text line ${index + 1}`, confidence: 68 });
  });

  const warnings: string[] = [];
  if (!text.trim()) warnings.push("No machine-readable text was available; visual extraction or manual review is required.");
  if (detected.confidence < 70) warnings.push("Document classification needs human confirmation.");
  return { documentType: detected.kind, classificationConfidence: detected.confidence, fields, activities, claims, warnings, sensitiveDataDetected: /\b(?:ssn|social security|routing number|account number)\b/i.test(text), provider: "local" };
}

async function readableText(file: File) {
  const extension = file.name.toLowerCase().split(".").pop();
  if (["txt", "csv", "tsv", "md", "json", "html", "xml", "rtf"].includes(extension ?? "")) return file.text();
  if (["xlsx", "xls"].includes(extension ?? "")) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    return workbook.SheetNames.map((name) => {
      const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name], { blankrows: false });
      return `Sheet: ${name}\n${csv}`;
    }).join("\n\n");
  }
  return "";
}

function bytesToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    documentType: { type: "string", enum: [...supportedKinds] },
    classificationConfidence: { type: "number", minimum: 0, maximum: 100 },
    fields: { type: "array", items: { type: "object", additionalProperties: false, properties: { name: { type: "string" }, value: { type: "string" }, confidence: { type: "number" }, source: { type: "string" } }, required: ["name", "value", "confidence", "source"] } },
    activities: { type: "array", items: { type: "object", additionalProperties: false, properties: { category: { type: "string", enum: ["Job placement", "Community engagement", "Storytelling", "Soft skills", "Other"] }, hours: { type: "number" }, sourceDescription: { type: "string" }, source: { type: "string" }, confidence: { type: "number" } }, required: ["category", "hours", "sourceDescription", "source", "confidence"] } },
    claims: { type: "array", items: { type: "object", additionalProperties: false, properties: { type: { type: "string", enum: ["intern_wages", "business_expense"] }, description: { type: "string" }, amount: { type: "number" }, businessPurpose: { type: "string" }, category: { type: "string" }, source: { type: "string" }, confidence: { type: "number" } }, required: ["type", "description", "amount", "businessPurpose", "category", "source", "confidence"] } },
    warnings: { type: "array", items: { type: "string" } },
    sensitiveDataDetected: { type: "boolean" },
  },
  required: ["documentType", "classificationConfidence", "fields", "activities", "claims", "warnings", "sensitiveDataDetected"],
};

async function extractWithOpenAI(file: File, selectedKind: string, config: ExtractionConfig): Promise<DocumentExtraction> {
  if (!config.apiKey) throw new Error("AI extraction is enabled but no API key is configured.");
  const base64 = bytesToBase64(await file.arrayBuffer());
  const isImage = /^image\/(png|jpeg|webp|gif)$/i.test(file.type);
  const filePart = isImage
    ? { type: "input_image", image_url: `data:${file.type};base64,${base64}`, detail: "high" }
    : { type: "input_file", filename: file.name, file_data: `data:${file.type || "application/octet-stream"};base64,${base64}`, detail: file.type === "application/pdf" ? "high" : undefined };
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: config.model || "gpt-5.6",
      store: false,
      input: [{ role: "user", content: [
        { type: "input_text", text: `Extract reimbursement evidence from this Land and Earn program document. The uploader suggested type '${selectedKind}', but classify from the evidence. Return only facts visible in the source and use empty arrays when absent. Cite a page, sheet, row, line, or visible region for every field and claim. Do not extract Social Security numbers, bank details, routing numbers, tax identifiers, or unrelated deductions; only report sensitiveDataDetected=true. Distinguish job placement, community engagement, storytelling/community investigation, soft skills, and other activity hours. Do not decide final eligibility or approval.` },
        filePart,
      ] }],
      text: { format: { type: "json_schema", name: "land_and_earn_document", strict: true, schema: extractionSchema } },
    }),
  });
  if (!response.ok) throw new Error(`AI extraction failed (${response.status}).`);
  const result = await response.json() as { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string; refusal?: string }> }> };
  const part = result.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text" || item.type === "refusal");
  if (part?.refusal) throw new Error("The extraction provider declined to process this document.");
  if (!part?.text) throw new Error("The extraction provider returned no structured result.");
  return { ...(JSON.parse(part.text) as Omit<DocumentExtraction, "provider">), provider: "openai" };
}

export async function extractDocument(file: File, selectedKind: string, config: ExtractionConfig): Promise<DocumentExtraction> {
  if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} exceeds the 20 MB upload limit.`);
  const localText = await readableText(file);
  const local = extractFromText(file.name, localText, selectedKind);
  if (!config.enabled) return local;
  try {
    return await extractWithOpenAI(file, selectedKind, config);
  } catch (error) {
    return { ...local, warnings: [...local.warnings, error instanceof Error ? error.message : "AI extraction failed; local results require review."] };
  }
}

export async function sha256(file: File) {
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
