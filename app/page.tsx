"use client";

import { type ChangeEvent, type DragEvent, useMemo, useRef, useState } from "react";

type ScenarioKey = "conference" | "equipment" | "training" | "supplies";

type Recommendation = {
  id: string;
  rank: number;
  name: string;
  code: string;
  score: number;
  available: number;
  accent: string;
  label: string;
  rationale: string;
  checks: string[];
  caution?: string;
  sources: string[];
};

type Flow = "plan" | "transactions";
type TransactionStatus = "aligned" | "change" | "review";

type Transaction = {
  id: string;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  currentFund: string;
  recommendedFund: string;
  confidence: number;
  status: TransactionStatus;
  reason: string;
};

const projectBalances = [
  { name: "FSCS — East TX", code: "1026-03", available: 68420, health: 68 },
  { name: "Promise Neighborhoods — Letcher", code: "1016-04", available: 42180, health: 42 },
  { name: "FSCS — Breathitt & Knott", code: "1023-03", available: 31760, health: 32 },
  { name: "Unrestricted operations", code: "OPS-01", available: 95700, health: 83 },
];

const baseRecommendations: Recommendation[] = [
  {
    id: "east-tx",
    rank: 1,
    name: "Full Service Community Schools — East TX",
    code: "1026-03",
    score: 94,
    available: 68420,
    accent: "teal",
    label: "Best fit",
    rationale:
      "The activity supports current project delivery and falls inside the 2026 grant period. Training, conference participation, and related travel are generally allowable when they directly benefit the award.",
    checks: ["Program benefit is direct", "Within period of performance", "Budget capacity available"],
    caution: "Document the connection to an approved grant activity before booking.",
    sources: ["2 CFR 200.473 — Training", "2 CFR 200.475 — Travel", "Cost Principles Reference Sheet"],
  },
  {
    id: "letcher",
    rank: 2,
    name: "Promise Neighborhoods — Letcher",
    code: "1016-04",
    score: 82,
    available: 42180,
    accent: "blue",
    label: "Strong alternative",
    rationale:
      "This is a viable alternative if the conference content advances Promise Neighborhoods outcomes. The cost must be allocated in proportion to the benefit received by this award.",
    checks: ["Expense type allowable", "Active grant year", "Alternative funding available"],
    caution: "Split the cost if more than one project receives material benefit.",
    sources: ["2 CFR 200.403 — Allowability", "2 CFR 200.405 — Allocability", "Cost Principles Reference Sheet"],
  },
  {
    id: "ops",
    rank: 3,
    name: "Unrestricted operating funds",
    code: "OPS-01",
    score: 69,
    available: 95700,
    accent: "violet",
    label: "Low-risk fallback",
    rationale:
      "Use unrestricted funds if the activity has broad organizational benefit, lacks a documented grant connection, or presents supplement-not-supplant risk.",
    checks: ["No federal allowability constraint", "No grant-purpose documentation needed", "Capacity available"],
    sources: ["Supplement-Not-Supplant Guidance", "PRI Purchasing Policy PR001"],
  },
];

const sourceLibrary = [
  {
    title: "Cost Principles Reference Sheet",
    type: "DOCX",
    detail: "Allowability by expense type",
    excerpt: "Costs must be necessary, reasonable, allowable, and allocable. Training and education costs are allowable; travel is generally allowable when reasonable and related to the grant.",
  },
  {
    title: "2025 Purchasing Policy",
    type: "PDF",
    detail: "Policy PR001 · effective Jan 1, 2025",
    excerpt: "Purchases under $5,000 require a price analysis. Purchases from $5,000 to $49,999.99 require a bid waiver or at least two written quotes, unless a preferred provider is used.",
  },
  {
    title: "Supplement-Not-Supplant Guidance",
    type: "DOCX",
    detail: "Discretionary federal grants",
    excerpt: "Ask whether the organization would have paid for the activity with non-Federal funds if the grant did not exist. If yes, the cost may be supplanting.",
  },
  {
    title: "Subset federal projects",
    type: "XLSX",
    detail: "9 active 2026 project-fund years",
    excerpt: "Project codes and grant periods used to screen recommendations for the active period of performance.",
  },
  {
    title: "Notes from BRUMAN EDGAR",
    type: "DOCX",
    detail: "PRI-specific compliance context",
    excerpt: "Follow the more restrictive procurement threshold. Prior authorization requests must be vetted with PRI leadership before contacting the program officer.",
  },
];

const quickPrompts = [
  "I’m attending an out-of-state conference",
  "We need laptops for program staff",
  "A partner is delivering staff training",
  "I need to order student activity supplies",
];

const sampleTransactions: Transaction[] = [
  { id: "tx-1", date: "2026-06-04", merchant: "Delta Air Lines", category: "Travel", amount: 486.2, currentFund: "OPS-01", recommendedFund: "1026-03", confidence: 94, status: "change", reason: "Conference travel is grant-related and falls within the active project period." },
  { id: "tx-2", date: "2026-06-05", merchant: "Marriott Downtown", category: "Travel", amount: 782.44, currentFund: "1026-03", recommendedFund: "1026-03", confidence: 92, status: "aligned", reason: "Lodging supports the same documented conference activity." },
  { id: "tx-3", date: "2026-06-09", merchant: "Staples Business", category: "Program supplies", amount: 318.67, currentFund: "1016-04", recommendedFund: "1016-04", confidence: 88, status: "aligned", reason: "Materials align to Promise Neighborhoods participant activities." },
  { id: "tx-4", date: "2026-06-12", merchant: "Bluegrass Technology", category: "Equipment", amount: 4298, currentFund: "1026-03", recommendedFund: "1026-03", confidence: 79, status: "review", reason: "Likely allowable, but written technology approval and equipment treatment must be confirmed." },
  { id: "tx-5", date: "2026-06-18", merchant: "Civic Learning Institute", category: "Training", amount: 1850, currentFund: "OPS-01", recommendedFund: "1023-03", confidence: 87, status: "change", reason: "The training description most closely matches Breathitt & Knott project delivery." },
  { id: "tx-6", date: "2026-06-21", merchant: "The Copper Bar", category: "Meals & incidentals", amount: 94.18, currentFund: "1026-03", recommendedFund: "OPS-01", confidence: 98, status: "change", reason: "Alcoholic beverages are unallowable on federal awards; move to unrestricted funds after review." },
  { id: "tx-7", date: "2026-06-24", merchant: "Adobe Systems", category: "Software", amount: 239.88, currentFund: "OPS-01", recommendedFund: "OPS-01", confidence: 73, status: "review", reason: "Broad organizational benefit is likely; confirm Information Systems approval and allocation basis." },
  { id: "tx-8", date: "2026-06-27", merchant: "USPS", category: "Program supplies", amount: 76.42, currentFund: "1026-03", recommendedFund: "1026-03", confidence: 91, status: "aligned", reason: "Transportation and postage for program materials are generally allowable." },
];

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function classify(text: string): ScenarioKey {
  const lower = text.toLowerCase();
  if (/laptop|computer|equipment|tablet|technology/.test(lower)) return "equipment";
  if (/training|trainer|workshop|speaker/.test(lower)) return "training";
  if (/suppl|book|material|ticket/.test(lower)) return "supplies";
  return "conference";
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);
}

function recommendationFor(merchant: string, currentFund: string, amount: number): Omit<Transaction, "id" | "date" | "merchant" | "amount" | "currentFund"> {
  const value = merchant.toLowerCase();
  if (/bar|liquor|wine|brew|alcohol/.test(value)) return { category: "Meals & incidentals", recommendedFund: "OPS-01", confidence: 98, status: currentFund === "OPS-01" ? "review" : "change", reason: "Potential alcohol expense: federal awards prohibit alcoholic beverages. Route to unrestricted funds for review." };
  if (/air|delta|united|hotel|marriott|hilton|conference|uber|lyft|rental car/.test(value)) return { category: "Travel", recommendedFund: "1026-03", confidence: 92, status: currentFund === "1026-03" ? "aligned" : "change", reason: "Historical pattern and expense type indicate project-related travel; retain supporting business purpose." };
  if (/laptop|computer|technology|software|adobe|microsoft/.test(value)) return { category: amount >= 1000 ? "Equipment" : "Software", recommendedFund: currentFund === "Uncoded" ? "1026-03" : currentFund, confidence: 78, status: "review", reason: "Technology may be allowable, but written Information Systems approval and the allocation basis must be verified." };
  if (/training|institute|workshop|speaker/.test(value)) return { category: "Training", recommendedFund: "1023-03", confidence: 87, status: currentFund === "1023-03" ? "aligned" : "change", reason: "Training is generally allowable when it directly supports award delivery; confirm contract documentation." };
  if (/staples|supply|book|usps|material/.test(value)) return { category: "Program supplies", recommendedFund: currentFund === "Uncoded" ? "1016-04" : currentFund, confidence: 88, status: currentFund === "Uncoded" ? "review" : "aligned", reason: "Materials and related delivery costs are generally allowable when necessary for the award." };
  return { category: "Other", recommendedFund: currentFund === "Uncoded" ? "OPS-01" : currentFund, confidence: 64, status: "review", reason: "The transaction description does not establish a clear program benefit. Add a business purpose before allocation." };
}

function normalizeUploadedRows(rows: Record<string, unknown>[]): Transaction[] {
  const valueFor = (row: Record<string, unknown>, patterns: RegExp[]) => {
    const entry = Object.entries(row).find(([key]) => patterns.some((pattern) => pattern.test(key.toLowerCase())));
    return entry?.[1];
  };
  return rows.slice(0, 150).map((row, index) => {
    const merchant = String(valueFor(row, [/merchant/, /description/, /vendor/, /transaction/]) ?? `Transaction ${index + 1}`);
    const rawAmount = valueFor(row, [/^amount$/, /transaction amount/, /debit/, /charge/]);
    const amount = Math.abs(Number(String(rawAmount ?? 0).replace(/[$,()]/g, ""))) || 0;
    const dateValue = valueFor(row, [/transaction date/, /posting date/, /^date$/]);
    const parsedDate = dateValue instanceof Date ? dateValue : new Date(String(dateValue ?? ""));
    const date = Number.isNaN(parsedDate.getTime()) ? "Date not provided" : parsedDate.toISOString().slice(0, 10);
    const currentFund = String(valueFor(row, [/fund/, /project/, /account/, /coding/]) ?? "Uncoded").trim() || "Uncoded";
    const suggested = recommendationFor(merchant, currentFund, amount);
    return { id: `upload-${index}`, date, merchant, amount, currentFund, ...suggested };
  }).filter((row) => row.amount > 0 || !row.merchant.startsWith("Transaction "));
}

function TransactionReview() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [filter, setFilter] = useState<"all" | TransactionStatus>("all");
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [staged, setStaged] = useState(false);

  const analyzeFile = async (file: File) => {
    setUploadError("");
    setIsParsing(true);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const normalized = normalizeUploadedRows(rows);
      if (!normalized.length) throw new Error("No transaction rows found");
      setTransactions(normalized);
      setFileName(file.name);
      setSelectedRows([]);
      setStaged(false);
    } catch {
      setUploadError("We couldn’t find transaction rows. Export the card activity with Date, Description, and Amount columns, then try again.");
    } finally {
      setIsParsing(false);
    }
  };

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void analyzeFile(file);
  };

  const dropFile = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void analyzeFile(file);
  };

  const loadSample = () => {
    setTransactions(sampleTransactions);
    setFileName("June_2026_card_activity.xlsx");
    setSelectedRows([]);
    setUploadError("");
    setStaged(false);
  };

  const stats = useMemo(() => {
    if (!transactions) return null;
    const total = transactions.reduce((sum, row) => sum + row.amount, 0);
    const aligned = transactions.filter((row) => row.status === "aligned").length;
    const changes = transactions.filter((row) => row.status === "change").length;
    const reviews = transactions.filter((row) => row.status === "review").length;
    return { total, aligned, changes, reviews, alignedRate: Math.round((aligned / transactions.length) * 100) };
  }, [transactions]);

  const visibleTransactions = transactions?.filter((row) => filter === "all" || row.status === filter) ?? [];
  const toggleRow = (id: string) => setSelectedRows((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const corrections = transactions?.filter((row) => row.status === "change") ?? [];

  return (
    <>
      <div className="intro transaction-intro">
        <span className="eyebrow">Historical allocation review</span>
        <h1>Turn card activity into funding decisions.</h1>
        <p>Upload a card transaction export. FundGuide will learn from the spending pattern, test each charge against the funding rules, and identify likely reallocations.</p>
      </div>

      {!transactions ? (
        <>
          <div className={`upload-zone ${isParsing ? "parsing" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={dropFile}>
            <input ref={inputRef} type="file" accept=".csv,.tsv,.xlsx,.xls" onChange={chooseFile} hidden />
            <div className="upload-mark" aria-hidden="true"><span>↑</span><i /></div>
            <span className="eyebrow">Card activity export</span>
            <h2>{isParsing ? "Reading transactions…" : "Drop a spreadsheet here"}</h2>
            <p>CSV or Excel · Date, description, and amount are enough to begin</p>
            <div className="upload-actions">
              <button className="upload-primary" onClick={() => inputRef.current?.click()} disabled={isParsing}>{isParsing ? "Analyzing…" : "Choose transaction file"}</button>
              <button className="upload-secondary" onClick={loadSample} disabled={isParsing}>Use sample activity</button>
            </div>
          </div>
          {uploadError && <div className="upload-error" role="alert"><strong>Check the export format</strong><span>{uploadError}</span></div>}
          <div className="review-steps">
            <div><span>01</span><strong>Match the columns</strong><p>Date, merchant, amount, and current funding code are detected automatically.</p></div>
            <div><span>02</span><strong>Apply the rules</strong><p>Each charge is checked for allowability, timing, approvals, and historical fit.</p></div>
            <div><span>03</span><strong>Stage corrections</strong><p>Program directors can send proposed reclassifications to finance with the evidence attached.</p></div>
          </div>
          <div className="local-processing-note"><span>✓</span><p><strong>Prototype privacy</strong> Files are processed in this browser session and are not retained after the page is closed.</p></div>
        </>
      ) : (
        <div className="transaction-results">
          <div className="file-strip">
            <div className="file-badge">XLS</div>
            <div><strong>{fileName}</strong><span>{transactions.length} transactions recognized</span></div>
            <div className="file-strip-actions"><span className="analysis-complete"><i /> Analysis complete</span><button onClick={() => inputRef.current?.click()}>Replace file</button></div>
            <input ref={inputRef} type="file" accept=".csv,.tsv,.xlsx,.xls" onChange={chooseFile} hidden />
          </div>

          {stats && <div className="transaction-stats">
            <div className="stat-total"><span>Total reviewed</span><strong>{currency(stats.total)}</strong><small>across {transactions.length} charges</small></div>
            <div><span>Likely aligned</span><strong>{stats.alignedRate}%</strong><small>{stats.aligned} transactions</small></div>
            <div><span>Move suggested</span><strong>{stats.changes}</strong><small>coding changes</small></div>
            <div><span>Needs context</span><strong>{stats.reviews}</strong><small>director review</small></div>
          </div>}

          <div className="history-insight">
            <div className="insight-mark">✦</div>
            <div><span className="eyebrow">Historical pattern</span><h3>Travel is consistently charged to project funds; training is split across operations and programs.</h3><p>The strongest correction opportunity is to move documented program training and conference travel from unrestricted operations to the benefiting award.</p></div>
            <div className="category-bars"><span><i style={{ width: "74%" }} />Travel <b>41%</b></span><span><i style={{ width: "51%" }} />Training <b>28%</b></span><span><i style={{ width: "32%" }} />Supplies <b>18%</b></span></div>
          </div>

          <div className="table-heading">
            <div><span className="eyebrow">Transaction recommendations</span><h2>Review the proposed funding path</h2></div>
            <div className="table-filters">
              {(["all", "change", "review", "aligned"] as const).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "all" ? "All" : item === "change" ? "Moves" : item === "review" ? "Review" : "Aligned"}</button>)}
            </div>
          </div>

          <div className="transaction-table-wrap">
            <table className="transaction-table">
              <thead><tr><th aria-label="Select" /><th>Transaction</th><th>Amount</th><th>Current</th><th>Recommended path</th><th>Match</th><th>Status</th></tr></thead>
              <tbody>{visibleTransactions.map((row) => (
                <tr key={row.id} className={selectedRows.includes(row.id) ? "selected" : ""}>
                  <td><input type="checkbox" checked={selectedRows.includes(row.id)} onChange={() => toggleRow(row.id)} aria-label={`Select ${row.merchant}`} /></td>
                  <td><strong>{row.merchant}</strong><span>{row.date} · {row.category}</span><small>{row.reason}</small></td>
                  <td className="transaction-amount">{currency(row.amount)}</td>
                  <td><code>{row.currentFund}</code></td>
                  <td><code className="recommended-code">{row.recommendedFund}</code>{row.currentFund !== row.recommendedFund && <span className="move-arrow">→ move</span>}</td>
                  <td><strong className="confidence">{row.confidence}%</strong></td>
                  <td><span className={`status status-${row.status}`}>{row.status === "change" ? "Move" : row.status === "review" ? "Review" : "Aligned"}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>

          <div className="transaction-actions">
            <span>{selectedRows.length ? `${selectedRows.length} selected` : `${corrections.length} suggested corrections`}</span>
            <div><button className="evidence-button">Export review</button><button className="analyze-button" onClick={() => setStaged(true)}>Stage {selectedRows.length || corrections.length} corrections <span>→</span></button></div>
          </div>

          {staged && <div className="success-banner" role="status"><span>✓</span><div><strong>Corrections staged for finance review</strong><p>{selectedRows.length || corrections.length} allocation proposals include the rule rationale and source evidence.</p></div><button onClick={() => setStaged(false)}>Dismiss</button></div>}
        </div>
      )}
      <p className="disclaimer">FundGuide recommends funding paths from the available policy context and historical patterns. Finance must verify final account coding, documentation, and required approvals.</p>
    </>
  );
}

const scenarioCopy: Record<ScenarioKey, { title: string; summary: string; tags: string[] }> = {
  conference: {
    title: "Conference travel",
    summary: "Out-of-state conference attendance with registration and travel costs.",
    tags: ["Travel", "Training", "Out of state"],
  },
  equipment: {
    title: "Technology equipment",
    summary: "Computing equipment intended to support program delivery.",
    tags: ["Equipment", "Technology", "Prior approval"],
  },
  training: {
    title: "Professional service · training",
    summary: "External training service intended to build staff capacity.",
    tags: ["Service", "Training", "Contract"],
  },
  supplies: {
    title: "Program supplies",
    summary: "Tangible materials intended for project activities or participants.",
    tags: ["Goods", "Program materials", "Price analysis"],
  },
};

export default function Home() {
  const [flow, setFlow] = useState<Flow>("plan");
  const [prompt, setPrompt] = useState(quickPrompts[0]);
  const [amount, setAmount] = useState("1850");
  const [scenario, setScenario] = useState<ScenarioKey>("conference");
  const [hasRun, setHasRun] = useState(true);
  const [selected, setSelected] = useState<Recommendation | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [confirmed, setConfirmed] = useState<Recommendation | null>(null);
  const [profile, setProfile] = useState("Community Schools · Programs");

  const recommendations = useMemo(() => {
    const next = baseRecommendations.map((item) => ({ ...item, checks: [...item.checks] }));
    if (scenario === "equipment") {
      next[0].score = 86;
      next[0].rationale = "Computing devices may be allowable when necessary for award performance, but equipment and technology purchases require documented approval before purchase.";
      next[0].caution = "Obtain written Information Systems approval and confirm whether federal prior approval is required.";
      next[0].sources = ["2 CFR 200.439 — Equipment", "2 CFR 200.453 — Computing devices", "PRI Purchasing Policy PR001"];
    }
    if (scenario === "training") {
      next[0].score = 91;
      next[0].rationale = "Training is generally allowable and can directly support award delivery. Because an outside trainer is a service provider, an executed contract is normally required.";
      next[0].caution = "Submit a Purchase Request before committing; Purchasing performs the service cost analysis.";
      next[0].sources = ["2 CFR 200.473 — Training", "PRI Purchasing Policy PR001 · Services", "Notes from BRUMAN EDGAR"];
    }
    if (scenario === "supplies") {
      next[0].score = 96;
      next[0].rationale = "Program materials and supplies are allowable when necessary for award performance and tied to approved activities. The requestor must document price reasonableness.";
      next[0].caution = "Apply the supplement-not-supplant test if these materials were previously paid from non-Federal funds.";
      next[0].sources = ["2 CFR 200.453 — Materials and supplies", "Supplement-Not-Supplant Guidance", "PRI Purchasing Policy PR001"];
    }
    return next;
  }, [scenario]);

  const runAnalysis = () => {
    if (!prompt.trim()) return;
    setHasRun(false);
    window.setTimeout(() => {
      setScenario(classify(prompt));
      setHasRun(true);
      setConfirmed(null);
    }, 420);
  };

  const applyPrompt = (value: string) => {
    setPrompt(value);
    setScenario(classify(value));
    setHasRun(true);
    setConfirmed(null);
  };

  const confirmAllocation = () => {
    if (!selected) return;
    setConfirmed(selected);
    setSelected(null);
  };

  const amountValue = Number(amount) || 0;
  const scenarioInfo = scenarioCopy[scenario];

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="FundGuide home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>FundGuide</span>
        </a>
        <div className="topbar-center">
          <span className="prototype-pill"><span /> Prototype workspace</span>
          <span className="last-sync">5 sources indexed · Jul 22, 2026</span>
        </div>
        <div className="profile-control">
          <span className="avatar">CH</span>
          <label>
            <span>Working profile</span>
            <select value={profile} onChange={(event) => setProfile(event.target.value)}>
              <option>Community Schools · Programs</option>
              <option>Promise Neighborhoods · Programs</option>
              <option>Finance & Grant Services</option>
            </select>
          </label>
        </div>
      </header>

      <div className="workspace" id="top">
        <aside className="side-panel">
          <div className="side-heading">
            <div>
              <span className="eyebrow">Funding snapshot</span>
              <h2>Active pools</h2>
            </div>
            <button className="icon-button" aria-label="Funding pool options">•••</button>
          </div>
          <p className="sample-note">Illustrative balances for prototype validation</p>
          <div className="balance-list">
            {projectBalances.map((project) => (
              <div className="balance-item" key={project.code}>
                <div className="balance-title">
                  <span>{project.name}</span>
                  <strong>{money(project.available)}</strong>
                </div>
                <div className="balance-meta"><code>{project.code}</code><span>available</span></div>
                <div className="balance-track"><span style={{ width: `${project.health}%` }} /></div>
              </div>
            ))}
          </div>

          <div className="side-rule" />
          <button className="source-link" onClick={() => setSourcesOpen(true)}>
            <span className="source-icon" aria-hidden="true">≡</span>
            <span><strong>Source library</strong><small>5 documents · 9 projects</small></span>
            <b aria-hidden="true">→</b>
          </button>

          <div className="guardrail-card">
            <span className="guardrail-icon" aria-hidden="true">✓</span>
            <div><strong>Policy guardrails on</strong><p>Recommendations are screened for allowability, allocability, timing, procurement, and SNS risk.</p></div>
          </div>

          <div className="side-footer">
            <button>Decision history</button>
            <button>Prototype notes</button>
          </div>
        </aside>

        <section className="main-panel">
          <nav className="flow-switch" aria-label="FundGuide workflows">
            <button className={flow === "plan" ? "active" : ""} onClick={() => setFlow("plan")}><span className="flow-icon">＋</span><span><strong>Plan an expense</strong><small>Choose a funding source before spending</small></span></button>
            <button className={flow === "transactions" ? "active" : ""} onClick={() => setFlow("transactions")}><span className="flow-icon">↺</span><span><strong>Review card transactions</strong><small>Learn from history and correct allocations</small></span></button>
          </nav>

          {flow === "transactions" ? <TransactionReview /> : <>
          <div className="intro">
            <span className="eyebrow">Allocation assistant</span>
            <h1>Where should this expense go?</h1>
            <p>Describe what you plan to purchase. FundGuide will compare grant rules, project timing, policy thresholds, and available capacity.</p>
          </div>

          <div className="composer" aria-label="Expense description">
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe the expense, purpose, and who benefits…" />
            <div className="composer-row">
              <label className="amount-field"><span>$</span><input aria-label="Estimated amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))} /><small>estimated</small></label>
              <label className="date-field"><span>Needed by</span><input type="date" defaultValue="2026-09-18" /></label>
              <button className="analyze-button" onClick={runAnalysis} disabled={!prompt.trim() || !hasRun}>
                {hasRun ? "Find funding options" : "Reviewing sources…"}<span aria-hidden="true">→</span>
              </button>
            </div>
          </div>

          <div className="quick-prompts" aria-label="Example expense prompts">
            <span>Try an example</span>
            <div>
              {quickPrompts.map((item, index) => (
                <button key={item} onClick={() => applyPrompt(item)} className={prompt === item ? "active" : ""}>{["Conference", "Laptops", "Staff training", "Supplies"][index]}</button>
              ))}
            </div>
          </div>

          <div className={`analysis-area ${hasRun ? "ready" : "loading"}`} aria-live="polite">
            {!hasRun ? (
              <div className="analysis-loading">
                <span className="spinner" />
                <div><strong>Reviewing five policy sources</strong><p>Checking purpose, period, cost rules, and funding alternatives…</p></div>
              </div>
            ) : (
              <>
                <div className="understanding-card">
                  <div className="understanding-label"><span aria-hidden="true">✦</span> Understood as</div>
                  <div className="understanding-copy">
                    <div><h3>{scenarioInfo.title}</h3><p>{scenarioInfo.summary}</p></div>
                    <div className="tags">{scenarioInfo.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                  </div>
                  <div className="screened"><span>Screened</span><strong>{money(amountValue)}</strong><small>against 4 funding pools</small></div>
                </div>

                <div className="results-heading">
                  <div><span className="eyebrow">Ranked recommendation</span><h2>Three viable funding paths</h2></div>
                  <button onClick={() => setSourcesOpen(true)}>View evidence <span>↗</span></button>
                </div>

                <div className="recommendation-list">
                  {recommendations.map((recommendation) => (
                    <article className={`recommendation ${recommendation.rank === 1 ? "featured" : ""}`} key={recommendation.id}>
                      <div className={`rank rank-${recommendation.accent}`}>{recommendation.rank}</div>
                      <div className="recommendation-body">
                        <div className="recommendation-topline">
                          <div>
                            <span className={`fit-label fit-${recommendation.accent}`}>{recommendation.label}</span>
                            <h3>{recommendation.name}</h3>
                            <code>{recommendation.code}</code>
                          </div>
                          <div className="match-score"><strong>{recommendation.score}%</strong><span>rule match</span></div>
                        </div>
                        <p className="rationale">{recommendation.rationale}</p>
                        <div className="check-row">
                          {recommendation.checks.map((check) => <span key={check}><i aria-hidden="true">✓</i>{check}</span>)}
                        </div>
                        {recommendation.caution && <div className="caution"><b>Before committing</b><span>{recommendation.caution}</span></div>}
                        <div className="recommendation-footer">
                          <div className="capacity"><span>Available capacity</span><strong>{money(recommendation.available)}</strong><small>{amountValue > 0 ? `${money(recommendation.available - amountValue)} after this allocation` : "Enter an amount to project balance"}</small></div>
                          <div className="card-actions">
                            <button className="evidence-button" onClick={() => setSourcesOpen(true)}>Sources <span>{recommendation.sources.length}</span></button>
                            <button className="select-button" onClick={() => setSelected(recommendation)}>Use this fund <span>→</span></button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>

          {confirmed && (
            <div className="success-banner" role="status">
              <span aria-hidden="true">✓</span>
              <div><strong>Allocation added to the planning log</strong><p>{money(amountValue)} · {confirmed.code} · Draft decision for finance review</p></div>
              <button onClick={() => setConfirmed(null)}>Dismiss</button>
            </div>
          )}

          <p className="disclaimer">FundGuide supports planning decisions; it does not replace award terms, finance review, or required approvals. Prototype balances and grant-specific matches are illustrative.</p>
          </>}
        </section>
      </div>

      {sourcesOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSourcesOpen(false)}>
          <section className="source-modal" role="dialog" aria-modal="true" aria-labelledby="sources-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><span className="eyebrow">Evidence library</span><h2 id="sources-title">Indexed source set</h2><p>Representative documents supplied for this prototype.</p></div><button className="close-button" onClick={() => setSourcesOpen(false)} aria-label="Close source library">×</button></div>
            <div className="source-list">
              {sourceLibrary.map((source, index) => (
                <article key={source.title}>
                  <span className="source-number">0{index + 1}</span>
                  <div><div className="source-title"><h3>{source.title}</h3><span>{source.type}</span></div><small>{source.detail}</small><p>{source.excerpt}</p></div>
                </article>
              ))}
            </div>
            <div className="modal-foot"><span><i /> Source-grounded prototype</span><button onClick={() => setSourcesOpen(false)}>Return to recommendation</button></div>
          </section>
        </div>
      )}

      {selected && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelected(null)}>
          <section className="allocation-modal" role="dialog" aria-modal="true" aria-labelledby="allocation-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={() => setSelected(null)} aria-label="Close allocation review">×</button>
            <span className="eyebrow">Review allocation</span>
            <h2 id="allocation-title">Ready for finance review</h2>
            <p className="allocation-lede">This creates a planning record only. Finance can verify the award budget, approvals, and final account coding.</p>
            <div className="allocation-summary">
              <div><span>Funding source</span><strong>{selected.name}</strong><code>{selected.code}</code></div>
              <div><span>Planned amount</span><strong>{money(amountValue)}</strong><small>{money(selected.available - amountValue)} projected balance</small></div>
            </div>
            <label className="memo-field"><span>Allocation memo</span><textarea defaultValue={`${scenarioInfo.title}: ${prompt}`} /></label>
            <div className="review-checks"><span><i>✓</i> Purpose documented</span><span><i>✓</i> Source rationale attached</span><span><i>○</i> Finance approval pending</span></div>
            <button className="confirm-button" onClick={confirmAllocation}>Add to planning log <span>→</span></button>
          </section>
        </div>
      )}
    </main>
  );
}
