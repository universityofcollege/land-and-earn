"use client";

import { useMemo, useState } from "react";

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
