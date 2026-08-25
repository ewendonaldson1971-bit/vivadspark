"use client";
import { useEffect, useMemo, useState } from "react";
import { normaliseIshikawaCauses, type CauseCategory, type NextStep, type ProblemAnalysis, type QualityEventSnapshot } from "../../lib/problem-solving-model";
import { IshikawaDiagram } from "./ishikawa-diagram";
import { ProblemSolvingPdfActions } from "./problem-solving-pdf-actions";

type Saved = { id: string; version: number; createdAt: string };
type History = { id: string; version: number; createdBy: string; createdAt: string; provider: string; planUpdatedAt: string | null };
type DeviceProgress = { analysis: ProblemAnalysis; saved: Saved; problemStatement?: string; selectedSolutionIds: string[]; nextSteps: NextStep[]; history: History[] };
const DEVICE_PLAN_PREFIX = "vivad-problem-plan:";

export function ProblemSolvingWorkflow() {
  const [events, setEvents] = useState<QualityEventSnapshot[]>([]), [query, setQuery] = useState(""), [selectedId, setSelectedId] = useState("");
  const [event, setEvent] = useState<QualityEventSnapshot | null>(null), [notes, setNotes] = useState("");
  const [analysis, setAnalysis] = useState<ProblemAnalysis | null>(null), [saved, setSaved] = useState<Saved | null>(null);
  const [problemStatement, setProblemStatement] = useState("");
  const [chosen, setChosen] = useState<string[]>([]), [steps, setSteps] = useState<NextStep[]>([]), [history, setHistory] = useState<History[]>([]);
  const [planSaved, setPlanSaved] = useState(false);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(""), [message, setMessage] = useState("");

  useEffect(() => { fetch("/api/non-conformance", { cache: "no-store" }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }).then((d) => setEvents(d.events ?? [])).catch((e) => setError(e.message || "Quality events could not be loaded.")).finally(() => setLoading(false)); }, []);
  const matches = useMemo(() => { const q = query.trim().toLowerCase(); return events.filter((item) => !q || [item.id, item.jobNumber, item.description, item.department, item.category].some((v) => String(v).toLowerCase().includes(q))).slice(0, 60); }, [events, query]);
  const stage = analysis ? (chosen.length ? 4 : 3) : event ? 2 : 1;

  async function importEvent() {
    const next = events.find((item) => item.id === selectedId); if (!next) return;
    setEvent(next); setAnalysis(null); setSaved(null); setProblemStatement(next.description); setChosen([]); setSteps([]); setNotes(""); setHistory([]); setPlanSaved(false); setError(""); setMessage("");
    const response = await fetch(`/api/problem-solving/plans?eventId=${encodeURIComponent(next.id)}`, { credentials: "same-origin", cache: "no-store" });
    const data = await response.json();
    if (!response.ok) { if (response.status !== 503) setError(data.error || "History could not be loaded."); return; }
    if (data.storage === "device") {
      try {
        const local = window.localStorage.getItem(`${DEVICE_PLAN_PREFIX}${next.id}`);
        if (local) {
          const progress = JSON.parse(local) as DeviceProgress;
          const restoredAnalysis = { ...progress.analysis, causes: normaliseIshikawaCauses(progress.analysis.causes) };
          setAnalysis(restoredAnalysis); setSaved(progress.saved); setProblemStatement(progress.problemStatement || next.description); setChosen(progress.selectedSolutionIds); setSteps(progress.nextSteps); setHistory(progress.history); setPlanSaved(progress.history.some((item) => Boolean(item.planUpdatedAt)));
          setMessage("Previous guest progress was restored from this device.");
        }
      } catch { window.localStorage.removeItem(`${DEVICE_PLAN_PREFIX}${next.id}`); }
    } else { const nextHistory = data.history ?? []; setHistory(nextHistory); setPlanSaved(nextHistory.some((item: History) => Boolean(item.planUpdatedAt))); }
  }
  async function solve() {
    if (!event || busy || (analysis && !window.confirm("Run a new analysis version? The existing version will remain in history."))) return;
    setBusy(true); setError(""); setMessage("");
    try { const response = await fetch("/api/problem-solving/analyse", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, notes }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); const entry = { ...data.saved, createdBy: data.persisted === false ? "Guest on this device" : "You", provider: data.provider, planUpdatedAt: null }; const nextProblemStatement = problemStatement.trim() || event.description; setAnalysis(data.analysis); setSaved(data.saved); setProblemStatement(nextProblemStatement); setSteps(data.analysis.nextSteps); setChosen([]); setPlanSaved(false); setMessage(data.persisted === false ? "Analysis ready. Guest progress will stay on this device." : `Analysis version ${data.saved.version} was saved.`); setHistory((h) => [entry, ...h]); if (data.persisted === false) window.localStorage.setItem(`${DEVICE_PLAN_PREFIX}${event.id}`, JSON.stringify({ analysis: data.analysis, saved: data.saved, problemStatement: nextProblemStatement, selectedSolutionIds: [], nextSteps: data.analysis.nextSteps, history: [entry, ...history] } satisfies DeviceProgress)); }
    catch (e) { setError(e instanceof Error ? e.message : "The event could not be analysed."); } finally { setBusy(false); }
  }
  async function savePlan() {
    if (!event || !saved || busy) return; setBusy(true); setError(""); setMessage("");
    try { const response = await fetch("/api/problem-solving/plans", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analysisId: saved.id, qualityEventId: event.id, selectedSolutionIds: chosen, nextSteps: steps }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); const updatedHistory = history.map((item) => item.id === saved.id ? { ...item, planUpdatedAt: data.result.savedAt } : item); setHistory(updatedHistory); setPlanSaved(true); if (data.result.persisted === false && analysis) window.localStorage.setItem(`${DEVICE_PLAN_PREFIX}${event.id}`, JSON.stringify({ analysis, saved, problemStatement, selectedSolutionIds: chosen, nextSteps: steps, history: updatedHistory } satisfies DeviceProgress)); setMessage(data.result.persisted === false ? "The action plan was saved on this device." : "The action plan was saved successfully."); }
    catch (e) { setError(e instanceof Error ? e.message : "The action plan could not be saved."); } finally { setBusy(false); }
  }
  const updateStep = (index: number, change: Partial<NextStep>) => { setPlanSaved(false); setSteps((all) => all.map((step, i) => i === index ? { ...step, ...change } : step)); };
  const updateCauseFindings = (category: CauseCategory["category"], findings: string[]) => { setPlanSaved(false); setAnalysis((current) => current ? { ...current, causes: current.causes.map((cause) => cause.category === category ? { ...cause, findings } : cause) } : current); };

  return <div className="ps-workflow">
    <nav className="ps-progress" aria-label="Problem-solving progress">{["Select Event", "Review Problem", "Diagnose", "Choose Actions"].map((label, i) => <div className={stage >= i + 1 ? "active" : ""} key={label}><span>{i + 1}</span><strong>{label}</strong></div>)}</nav>
    {error && <div className="ps-alert error" role="alert">{error}</div>}{message && <div className="ps-alert success" role="status">{message}</div>}
    <section className="ps-panel"><Heading eyebrow="QUALITY EVENT" title="Select a source record" text="Search the live Event Log by reference, job, issue, category or department." /><div className="ps-event-picker"><label><span>Search quality events</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Start typing an event reference or description" /></label><label><span>Matching event</span><select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} disabled={loading}><option value="">{loading ? "Loading events…" : "Select an event"}</option>{matches.map((item) => <option value={item.id} key={item.id}>{item.id} · {item.description.slice(0, 90)}</option>)}</select></label><button type="button" disabled={!selectedId} onClick={importEvent}>Import event</button></div></section>
    {event && <section className="ps-panel ps-problem"><Heading eyebrow="PROBLEM" title="Review the imported event" /><dl>{[["Reference", event.id], ["Status", event.status], ["Department", event.department], ["Category", event.category], ["Date", event.dateLabel], ["Job", event.jobNumber], ["Severity", event.severity ?? "Not recorded"], ["Assigned to", event.assignedTo]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl><div className="ps-description"><strong>Event description</strong><p>{event.description}</p>{event.rootCause && <><strong>Recorded cause</strong><p>{event.rootCause}</p></>}</div><label><span>Analysis notes (kept separate from the source event)</span><textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add observations, constraints or evidence…" /></label><button className="ps-primary" type="button" disabled={busy} onClick={solve}>{busy ? "Analysing and saving…" : analysis ? "Run new analysis version" : "Solve It"}</button></section>}
    {analysis && event && <>
      <section className="ps-panel"><Heading eyebrow="DIAGNOSING PROBLEM" title="Ishikawa cause review" text={analysis.summary} />{!analysis.researchAvailable && <div className="ps-research-note">{analysis.researchMessage}</div>}<IshikawaDiagram analysis={analysis} problemStatement={problemStatement} onProblemStatementChange={(value) => { setPlanSaved(false); setProblemStatement(value); }} onFindingsChange={updateCauseFindings} />{analysis.sources.length > 0 && <div className="ps-sources"><h3>Research sources</h3><ol>{analysis.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><span>{source.publisher} · {source.relevance}</span></li>)}</ol></div>}</section>
      <section className="ps-panel"><Heading eyebrow="SUGGESTED SOLUTIONS" title="Choose practical actions" text="Select recommendations to carry into the action plan." /><div className="ps-solutions">{analysis.solutions.map((solution) => <label key={solution.id}><input type="checkbox" checked={chosen.includes(solution.id)} onChange={(e) => { setPlanSaved(false); setChosen((all) => e.target.checked ? [...all, solution.id] : all.filter((id) => id !== solution.id)); }} /><span><strong>{solution.title}</strong><em>{solution.priority}</em><small>{solution.rationale}</small></span></label>)}</div></section>
      <section className="ps-panel"><Heading eyebrow="NEXT STEPS" title="Build the action plan" /><div className="ps-step-list">{steps.map((step, i) => <article key={step.id}><span>STEP {i + 1}</span><label>Action<input value={step.action} onChange={(e) => updateStep(i, { action: e.target.value })} /></label><label>Owner<input value={step.owner} onChange={(e) => updateStep(i, { owner: e.target.value })} placeholder="Assign an owner" /></label><label>Due date<input type="date" value={step.dueDate} onChange={(e) => updateStep(i, { dueDate: e.target.value })} /></label><label>Priority<select value={step.priority} onChange={(e) => updateStep(i, { priority: e.target.value as NextStep["priority"] })}><option>High</option><option>Medium</option><option>Low</option></select></label><button type="button" onClick={() => { setPlanSaved(false); setSteps((all) => all.filter((_, n) => n !== i)); }}>Remove</button></article>)}</div><div className="ps-actions"><button type="button" onClick={() => { setPlanSaved(false); setSteps((all) => [...all, { id: crypto.randomUUID(), action: "", owner: "", dueDate: "", priority: "Medium" }]); }}>＋ Add next step</button><button className="ps-primary" type="button" disabled={busy || !steps.length || steps.some((s) => !s.action.trim())} onClick={savePlan}>{busy ? "Saving…" : "Save action plan"}</button></div></section>
      <section className="ps-panel problem-pdf-panel"><Heading eyebrow="COMPLETE REPORT" title="Print or share the completed problem-solving record" text="The report includes the source event, problem statement, fishbone, detailed causes, selected solutions, action plan and audit history." /><ProblemSolvingPdfActions disabled={!planSaved} data={{ event, problemStatement, analysisNotes: notes, analysis, selectedSolutionIds: chosen, nextSteps: steps, history }} /></section>
    </>}
    {event && <section className="ps-panel ps-history"><Heading eyebrow="HISTORY & AUDIT" title="Previous work on this event" />{history.length ? <ol>{history.map((item) => <li key={item.id}><strong>Version {item.version}</strong><span>{new Date(item.createdAt).toLocaleString()} · {item.createdBy} · {item.provider}{item.planUpdatedAt ? " · Action plan saved" : ""}</span></li>)}</ol> : <p>No previous analyses are recorded for this event.</p>}</section>}
  </div>;
}

function Heading({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) { return <div className="ps-section-heading"><span>{eyebrow}</span><h2>{title}</h2>{text && <p>{text}</p>}</div>; }
