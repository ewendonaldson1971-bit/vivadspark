"use client";

// Interactive strategy workspace.
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { MobileWorkspaceNavigation, navigationItem, WorkspaceNavigationId } from "../components/workspace-navigation";
import { FiveSWorkspace } from "./five-s-workspace";

type View = "Overview" | "Safety" | "Quality" | "Delivery" | "5S" | "Scorecards" | "People" | "Settings";

type Initiative = {
  title: string;
  owner: string;
  progress: number;
  status: "On track" | "At risk";
  due: string;
};

const DEPARTMENTS = ["All departments", "CST", "Prepress", "Printers", "Cutters", "Fab1", "Framing", "Sew", "Light Box", "Office", "Despatch"] as const;
const STRATEGY_DEPARTMENT_KEY = "vivad-strategy-department";
type Department = typeof DEPARTMENTS[number];

function teamPlan(department: Department) {
  const team = department === "All departments" ? "Vivad" : department;
  const seed = DEPARTMENTS.indexOf(department);
  return {
    team,
    eyebrow: department === "All departments" ? "FY2026 CORPORATE PLAN" : `FY2026 ${department.toUpperCase()} TEAM PLAN`,
    trueNorth: department === "All departments" ? ["Make progress visible.", "Make action inevitable."] : [`${department} works safely.`, `${department} delivers right first time.`],
    description: department === "All departments" ? "We turn strategy into a small set of measurable priorities, connect every action to an outcome, and review progress before problems become surprises." : `${department} can see its own Safety, Quality and Delivery priorities, measures and actions in one deployment screen.`,
    objectives: [
      { code: "S", title: `Ensure everyone in ${team} goes home safe`, owner: "Safety", progress: 82 - seed % 9, tone: "green" },
      { code: "Q", title: `Build right-first-time quality into ${team}`, owner: "Quality", progress: 76 - seed % 8, tone: "red" },
      { code: "D", title: `${team} delivers the customer promise every day`, owner: "Delivery", progress: 79 - seed % 7, tone: "blue" },
    ],
    keyResults: [
      { metric: `${team} safety actions closed`, target: "100%", actual: `${94 - seed % 5}%`, trend: "↑ 2%", status: seed % 3 === 0 ? "Watch" : "On track" },
      { metric: `${team} first-time-right quality`, target: "98%", actual: `${96 + seed % 3}.2%`, trend: "↑ 0.7%", status: "On track" },
      { metric: `${team} on-time delivery`, target: "96%", actual: `${93 + seed % 4}.8%`, trend: "↑ 1.8%", status: seed % 2 ? "Watch" : "On track" },
      { metric: `${team} SOP and training compliance`, target: "100%", actual: `${91 + seed % 7}%`, trend: "↑ 3%", status: "On track" },
    ],
    safetyRows: [
      { label: `${team} critical risk controls`, values: [3, 2, 1, 3] },
      { label: `${team} hazard and action closure`, values: [2, 3, 2, 1] },
      { label: `${team} safe work capability`, values: [1, 2, 3, 2] },
    ],
  };
}

export default function Home() {
  const [view, setView] = useState<View>("Overview");
  const [department, setDepartment] = useState<Department>("All departments");
  const [modalOpen, setModalOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("All");
  const [initiatives, setInitiatives] = useState<Initiative[]>([
    { title: "One-click order status", owner: "Maya Chen", progress: 82, status: "On track", due: "18 Sep" },
    { title: "Daily flow management", owner: "Liam Ward", progress: 61, status: "At risk", due: "30 Sep" },
    { title: "Leader standard work", owner: "Noah Singh", progress: 74, status: "On track", due: "12 Oct" },
    { title: "Skills matrix rollout", owner: "Ava Brooks", progress: 47, status: "On track", due: "28 Oct" },
  ]);

  const plan = useMemo(() => teamPlan(department), [department]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("view");
    const legacyViews: Record<string, View> = { "X-matrix": "Safety", Initiatives: "Quality", Reviews: "Delivery" };
    const requestedView = requested ? legacyViews[requested] ?? requested : null;
    if (requestedView && ["Safety", "Quality", "Delivery", "5S", "Scorecards", "People", "Settings"].includes(requestedView)) {
      // Restore the directly linked workspace section after client hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView(requestedView as View);
    }
    const requestedDepartment = params.get("department");
    const savedDepartment = window.localStorage.getItem(STRATEGY_DEPARTMENT_KEY);
    const initialDepartment = requestedDepartment || savedDepartment;
    if (initialDepartment && DEPARTMENTS.includes(initialDepartment as Department)) {
      setDepartment(initialDepartment as Department);
    }
  }, []);

  const activeNavigation: WorkspaceNavigationId =
    view === "Scorecards" ? "scorecards" : view === "Quality" ? "initiatives" : view === "Delivery" ? "reviews" : view === "People" ? "people" : view === "Settings" ? "settings" : "strategy";

  const visibleInitiatives = useMemo(
    () => initiatives.filter((item) => filter === "All" || item.status === filter),
    [filter, initiatives],
  );

  function addInitiative(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "").trim();
    const owner = String(data.get("owner") || "").trim();
    if (!title || !owner) return;

    setInitiatives((current) => [
      ...current,
      { title, owner, progress: 0, status: "On track", due: "30 Nov" },
    ]);
    setModalOpen(false);
    setView("Quality");
    setNotice(`Quality action added — ${title}`);
    window.setTimeout(() => setNotice(""), 3200);
  }

  function changeDepartment(nextDepartment: Department) {
    setDepartment(nextDepartment);
    window.localStorage.setItem(STRATEGY_DEPARTMENT_KEY, nextDepartment);
    setNotice(`${nextDepartment === "All departments" ? "Corporate" : nextDepartment} strategy deployment loaded`);
    window.setTimeout(() => setNotice(""), 3200);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="Vivad SPARK strategy workspace">
          <img className="vivad-logo strategy-vivad-logo" src="/vivad-logo.png" alt="Vivad SPARK — Hoshin, Continuous Improvement" />
        </a>

        <nav className="side-nav" aria-label="Workspace navigation">
          <p className="nav-label">Workspace</p>
          <Link className={activeNavigation === "strategy" ? "nav-item active" : "nav-item"} href={navigationItem("strategy").href}>
            <span className="nav-icon">◫</span> Strategy
          </Link>
          <Link className="nav-item" href="/quality">
            <span className="nav-icon">◇</span> Quality events
          </Link>
          <Link className="nav-item" href="/training">
            <span className="nav-icon">▷</span> Training academy
          </Link>
          <Link className={activeNavigation === "scorecards" ? "nav-item active" : "nav-item"} href={navigationItem("scorecards").href}>
            <span className="nav-icon">◎</span> Scorecards
          </Link>
          <Link className={activeNavigation === "initiatives" ? "nav-item active" : "nav-item"} href={navigationItem("initiatives").href}>
            <span className="nav-icon">↗</span> Quality
            <span className="nav-count">4</span>
          </Link>
          <Link className={activeNavigation === "reviews" ? "nav-item active" : "nav-item"} href={navigationItem("reviews").href}>
            <span className="nav-icon">◷</span> Delivery
          </Link>
          <Link className="nav-item" href="/vivadocs">
            <span className="nav-icon">▤</span> VivaDocs
          </Link>
          <p className="nav-label nav-label-spaced">Manage</p>
          <Link className={activeNavigation === "people" ? "nav-item active" : "nav-item"} href={navigationItem("people").href}>
            <span className="nav-icon">♙</span> People
          </Link>
          <Link className={activeNavigation === "settings" ? "nav-item active" : "nav-item"} href={navigationItem("settings").href}>
            <span className="nav-icon">⚙</span> Settings
          </Link>
        </nav>

        <div className="sidebar-footer">
          <div className="help-card">
            <span className="help-dot">?</span>
            <div>
              <strong>Need a hand?</strong>
              <small>Open the planning guide</small>
            </div>
          </div>
          <div className="profile">
            <span className="avatar">ED</span>
            <div>
              <strong>Ewen Donaldson</strong>
              <small>Strategy lead</small>
            </div>
            <span className="more">•••</span>
          </div>
        </div>
      </aside>

      <main className="main" id="top">
        <header className="topbar">
          <MobileWorkspaceNavigation activeItem={activeNavigation} />
          <div>
            <span className="eyebrow">{plan.eyebrow}</span>
            <h1>{department === "All departments" ? "Strategy deployment" : `${department} strategy deployment`}</h1>
          </div>
          <div className="top-actions">
            <button className="icon-button" type="button" aria-label="Open notifications">
              <span>♢</span><i />
            </button>
            <button className="button button-secondary" type="button" onClick={() => setReviewOpen(true)}>
              Run monthly review
            </button>
            <button className="button button-primary" type="button" onClick={() => setModalOpen(true)}>
              <span>＋</span> Add action
            </button>
          </div>
        </header>

        <div className="workspace-bar">
          <div className="tabs" role="tablist" aria-label="Strategy views">
            {(["Overview", "Safety", "Quality", "Delivery", "5S"] as View[]).map((tab) => (
              <button
                className={view === tab ? "tab active" : "tab"}
                type="button"
                role="tab"
                aria-selected={view === tab}
                key={tab}
                onClick={() => setView(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="strategy-controls">
            <label className="department-control">
              <span>Department</span>
              <select value={department} aria-label="Strategy department" onChange={(event) => changeDepartment(event.target.value as Department)}>
                {DEPARTMENTS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="period-control">
              <span>Planning period</span>
              <select defaultValue="FY2026" aria-label="Planning period">
                <option>FY2026</option>
                <option>FY2025</option>
              </select>
            </label>
          </div>
        </div>

        {view === "Overview" && (
          <section className="dashboard" aria-label="Strategy overview">
            <article className="card north-star">
              <div className="card-heading">
                <div>
                  <span className="section-kicker true-north-label">
                    <span className="north-compass" aria-hidden="true">
                      <i />
                    </span>
                    True north
                  </span>
                  <h2>{plan.trueNorth[0]}<br />{plan.trueNorth[1]}</h2>
                </div>
                <div className="confidence">
                  <div className="score-ring"><span>72</span><small>%</small></div>
                  <div><strong>Plan confidence</strong><small>Up 6% this quarter</small></div>
                </div>
              </div>
              <p className="north-copy">{plan.description}</p>
              <div className="objective-grid">
                {plan.objectives.map((objective) => (
                  <article className={`objective ${objective.tone}`} key={objective.code}>
                    <div className="objective-top">
                      <span className="objective-code">{objective.code}</span>
                      <span className="status-pill neutral">{objective.owner}</span>
                    </div>
                    <h3>{objective.title}</h3>
                    <div className="progress-meta"><span>Progress</span><strong>{objective.progress}%</strong></div>
                    <div className="progress-track"><i style={{ width: `${objective.progress}%` }} /></div>
                  </article>
                ))}
              </div>
            </article>

            <aside className="card review-card">
              <div className="card-title-row">
                <div>
                  <span className="section-kicker">Next review</span>
                  <h2>September pulse</h2>
                </div>
                <span className="date-badge"><strong>16</strong><small>SEP</small></span>
              </div>
              <div className="review-progress">
                <div><span>Agenda readiness</span><strong>75%</strong></div>
                <div className="progress-track green"><i style={{ width: "75%" }} /></div>
              </div>
              <ul className="check-list">
                <li className="done"><span>✓</span><div><strong>Metrics updated</strong><small>18 of 18 owners</small></div></li>
                <li className="done"><span>✓</span><div><strong>Countermeasures reviewed</strong><small>6 items closed</small></div></li>
                <li><span>!</span><div><strong>2 decisions required</strong><small>Operations and Customer</small></div></li>
              </ul>
              <button className="text-link" type="button" onClick={() => setReviewOpen(true)}>
                View review brief <span>→</span>
              </button>
            </aside>

            <article className="card results-card">
              <div className="card-title-row">
                <div>
                  <span className="section-kicker">Outcome measures</span>
                  <h2>Key results</h2>
                </div>
                <button className="text-link compact" type="button">View scorecard <span>→</span></button>
              </div>
              <div className="results-table" role="table" aria-label="Key result performance">
                <div className="result-row result-head" role="row">
                  <span>Measure</span><span>Target</span><span>Actual</span><span>Trend</span><span>Status</span>
                </div>
                {plan.keyResults.map((result) => (
                  <div className="result-row" role="row" key={result.metric}>
                    <strong>{result.metric}</strong>
                    <span>{result.target}</span>
                    <strong>{result.actual}</strong>
                    <span className={result.trend.startsWith("↑") ? "trend-up" : "trend-down"}>{result.trend}</span>
                    <span className={`status-pill ${result.status.toLowerCase().replace(" ", "-")}`}>{result.status}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="card activity-card">
              <span className="section-kicker">This week</span>
              <h2>Momentum</h2>
              <div className="activity-stat"><strong>12</strong><span>updates posted<br />across the plan</span></div>
              <div className="avatar-stack"><span>MC</span><span>LW</span><span>NS</span><span>+8</span></div>
              <p>Most active: <strong>Customer experience</strong></p>
            </article>
          </section>
        )}

        {view === "Safety" && (
          <section className="single-view">
            <div className="page-intro">
              <div><span className="section-kicker red">Safety deployment</span><h2>{plan.team} safety priorities</h2></div>
              <p>See how critical risks connect to controls, actions and team capability.</p>
            </div>
            <article className="card matrix-card">
              <div className="matrix-head">
                <span>Safety priority</span>
                <span>Critical risks</span><span>Controls</span><span>Actions</span><span>Capability</span>
              </div>
              {plan.safetyRows.map((row) => (
                <div className="matrix-row" key={row.label}>
                  <strong>{row.label}</strong>
                  {row.values.map((value, index) => (
                    <span className={`matrix-cell level-${value}`} key={`${row.label}-${index}`}>{value || "—"}</span>
                  ))}
                </div>
              ))}
              <div className="matrix-legend"><span><i className="level-3" /> Strong</span><span><i className="level-2" /> Supporting</span><span><i className="level-1" /> Contributing</span></div>
            </article>
          </section>
        )}

        {view === "Scorecards" && (
          <section className="single-view">
            <div className="page-intro"><div><span className="section-kicker red">Outcome measures</span><h2>{plan.team} scorecards</h2></div><p>Current performance against the selected FY2026 team measures.</p></div>
            <div className="initiative-grid">{plan.keyResults.map((result) => <article className="card initiative-card" key={result.metric}><span className={`status-pill ${result.status.toLowerCase().replace(" ", "-")}`}>{result.status}</span><h3>{result.metric}</h3><div className="activity-stat"><strong>{result.actual}</strong><span>Target<br />{result.target}</span></div><p className="due-row"><span>Trend</span><strong>{result.trend}</strong></p></article>)}</div>
          </section>
        )}

        {view === "Quality" && (
          <section className="single-view">
            <div className="page-intro">
              <div><span className="section-kicker red">Quality improvement</span><h2>{plan.team} quality actions</h2></div>
              <div className="filter-row">
                <label>Status
                  <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                    <option>All</option><option>On track</option><option>At risk</option>
                  </select>
                </label>
                <button className="button button-primary" type="button" onClick={() => setModalOpen(true)}>＋ Add action</button>
              </div>
            </div>
            <div className="initiative-grid">
              {visibleInitiatives.map((item) => (
                <article className="card initiative-card" key={item.title}>
                  <div className="initiative-title"><span className={`signal ${item.status === "At risk" ? "risk" : ""}`} /><span className={`status-pill ${item.status.toLowerCase().replace(" ", "-")}`}>{item.status}</span></div>
                  <h3>{item.title}</h3>
                  <div className="owner-row"><span className="avatar small">{item.owner.split(" ").map((part) => part[0]).join("")}</span><span><small>Owner</small><strong>{item.owner}</strong></span></div>
                  <div className="progress-meta"><span>Progress</span><strong>{item.progress}%</strong></div>
                  <div className="progress-track"><i style={{ width: `${item.progress}%` }} /></div>
                  <div className="due-row"><span>Due {item.due}</span><button type="button">Open brief →</button></div>
                </article>
              ))}
            </div>
          </section>
        )}

        {view === "Delivery" && (
          <section className="single-view">
            <div className="page-intro">
              <div><span className="section-kicker red">Delivery cadence</span><h2>{plan.team} delivery review</h2></div>
              <button className="button button-primary" type="button" onClick={() => setReviewOpen(true)}>Start September delivery review</button>
            </div>
            <article className="card timeline-card">
              {[
                ["16 Sep", "September pulse", "Ready", "Two decisions on the agenda"],
                ["19 Aug", "August pulse", "Complete", "4 countermeasures agreed"],
                ["15 Jul", "July pulse", "Complete", "Customer metric reset"],
                ["17 Jun", "June pulse", "Complete", "Quarterly priorities confirmed"],
              ].map(([date, title, status, note], index) => (
                <div className="timeline-item" key={date}>
                  <span className={index === 0 ? "timeline-dot current" : "timeline-dot"} />
                  <span className="timeline-date">{date}</span>
                  <div><strong>{title}</strong><small>{note}</small></div>
                  <span className={`status-pill ${status === "Ready" ? "watch" : "on-track"}`}>{status}</span>
                  <button type="button" aria-label={`Open ${title}`}>→</button>
                </div>
              ))}
            </article>
          </section>
        )}

        {view === "5S" && (
          <section className="single-view" aria-labelledby="five-s-title">
            <div className="page-intro">
              <div>
                <span className="section-kicker red">Workplace organisation</span>
                <h2 id="five-s-title">{plan.team} 5S</h2>
              </div>
              <p>A dedicated 5S workspace for the selected department.</p>
            </div>
            <FiveSWorkspace department={department} />
          </section>
        )}

        {view === "People" && (
          <section className="single-view"><div className="page-intro"><div><span className="section-kicker red">Accountability</span><h2>People and owners</h2></div><p>Outcome and initiative ownership across the strategy.</p></div><article className="card timeline-card">{["Maya Chen · Customer", "Liam Ward · Operations", "Noah Singh · People", "Ava Brooks · Capability"].map((person) => <div className="timeline-item" key={person}><span className="avatar small">{person.split(" ").slice(0,2).map((part) => part[0]).join("")}</span><div><strong>{person.split(" · ")[0]}</strong><small>{person.split(" · ")[1]} outcome owner</small></div><span className="status-pill on-track">Active</span></div>)}</article></section>
        )}

        {view === "Settings" && (
          <section className="single-view"><div className="page-intro"><div><span className="section-kicker red">Workspace controls</span><h2>Strategy settings</h2></div><p>Planning period and review defaults for this workspace.</p></div><article className="card north-star"><div className="settings-grid"><label>Planning period<select defaultValue="FY2026"><option>FY2026</option><option>FY2025</option></select></label><label>Review cadence<select defaultValue="Monthly"><option>Monthly</option><option>Quarterly</option></select></label><label>Plan visibility<select defaultValue="All workspace members"><option>All workspace members</option><option>Leaders only</option></select></label></div></article></section>
        )}
      </main>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setModalOpen(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="initiative-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" aria-label="Close" onClick={() => setModalOpen(false)}>×</button>
            <span className="section-kicker red">New work item</span>
            <h2 id="initiative-title">Add {plan.team} quality action</h2>
            <p>Connect a focused piece of work to the selected team plan.</p>
            <form onSubmit={addInitiative}>
              <label>Action title<input name="title" placeholder="e.g. Simplify quote approval" autoFocus required /></label>
              <label>Accountable owner<input name="owner" placeholder="Full name" required /></label>
              <label>Linked priority<select defaultValue="Q"><option value="S">Safety</option><option value="Q">Quality</option><option value="D">Delivery</option></select></label>
              <div className="modal-actions"><button className="button button-ghost" type="button" onClick={() => setModalOpen(false)}>Cancel</button><button className="button button-primary" type="submit">Add action</button></div>
            </form>
          </section>
        </div>
      )}

      {reviewOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setReviewOpen(false)}>
          <section className="modal review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" aria-label="Close" onClick={() => setReviewOpen(false)}>×</button>
            <span className="section-kicker red">September pulse</span>
            <h2 id="review-title">The room is nearly ready.</h2>
            <p>18 measure owners have updated their results. Resolve the two open decisions before the session.</p>
            <div className="decision-box"><span>01</span><div><strong>Approve additional weekend shift?</strong><small>Owner · Liam Ward</small></div><button type="button">Review →</button></div>
            <div className="decision-box"><span>02</span><div><strong>Reset customer effort target?</strong><small>Owner · Maya Chen</small></div><button type="button">Review →</button></div>
            <button className="button button-primary full" type="button" onClick={() => { setReviewOpen(false); setNotice("Review brief opened — ready for the strategy room"); }}>Open review brief</button>
          </section>
        </div>
      )}

      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    </div>
  );
}
