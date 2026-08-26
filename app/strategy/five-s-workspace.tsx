"use client";

import { CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { FIVE_S_HEADINGS, FIVE_S_SCORES, FiveSAuditRow, calculateFiveSScore, fiveSAuditActions, getFiveSAuditConfig } from "../../lib/five-s-audit";
import { printFiveSScorePoster } from "./five-s-score-print";

type FiveSResponse = {
  available: boolean;
  rows: FiveSAuditRow[];
  overallScore: number;
  storageAvailable?: boolean;
  sourceName?: string;
  sourceUrl?: string;
  error?: string;
};

export function FiveSWorkspace({ department }: { department: string }) {
  const [rows, setRows] = useState<FiveSAuditRow[]>([]);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceName, setSourceName] = useState("5S Audit");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState<Record<number, string>>({});
  const [actionDraft, setActionDraft] = useState({ actionRequired: "", owner: "", dueDate: "" });
  const [actionMessage, setActionMessage] = useState("");
  const overallScore = useMemo(() => calculateFiveSScore(rows), [rows]);
  const actions = useMemo(() => fiveSAuditActions(rows), [rows]);
  const scoredCount = rows.filter((row) => /^[0-3]$/.test(row.score)).length;

  useEffect(() => {
    const config = getFiveSAuditConfig(department);
    if (!config) {
      setRows([]);
      setSourceUrl("");
      setError("");
      return;
    }
    const controller = new AbortController();
    setRows([]);
    setSourceUrl("");
    setSourceName(config.sheetName);
    setSaveStatus({});
    setActionDraft({ actionRequired: "", owner: "", dueDate: "" });
    setActionMessage("");
    setLoading(true);
    setError("");
    fetch(`/api/five-s?department=${encodeURIComponent(department)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as FiveSResponse;
        if (!response.ok) throw new Error(data.error || `The ${department} 5S audit could not be loaded.`);
        setRows(data.rows || []);
        setSourceUrl(data.sourceUrl || "");
        setSourceName(data.sourceName || "5S Audit");
        if (data.storageAvailable === false) setError("The live audit is visible, but working-copy storage is not available yet.");
      })
      .catch((reason) => { if (reason.name !== "AbortError") setError(reason.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [department]);

  if (!getFiveSAuditConfig(department)) {
    return <article className="card five-s-placeholder">
      <span className="five-s-placeholder-icon" aria-hidden="true">5S</span>
      <div>
        <h3>Select a department to open its 5S audit</h3>
        <p>Each department has its own score, actions and editable working copy.</p>
      </div>
    </article>;
  }

  function updateRow(sourceRow: number, field: keyof FiveSAuditRow, value: string) {
    setRows((current) => current.map((row) => row.sourceRow === sourceRow ? { ...row, [field]: value } : row));
  }

  async function saveRow(sourceRow: number) {
    const row = rows.find((item) => item.sourceRow === sourceRow);
    if (!row) return;
    await persistRow(row);
  }

  async function persistRow(row: FiveSAuditRow) {
    setSaveStatus((current) => ({ ...current, [row.sourceRow]: "Saving…" }));
    try {
      const response = await fetch("/api/five-s", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department, row }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The row could not be saved.");
      setSaveStatus((current) => ({ ...current, [row.sourceRow]: "Saved" }));
      return true;
    } catch (reason) {
      setSaveStatus((current) => ({ ...current, [row.sourceRow]: reason instanceof Error ? reason.message : "Save failed" }));
      return false;
    }
  }

  async function addAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionMessage("");
    const availableRow = rows.find((row) => !row.actionRequired && !row.owner && !row.dueDate);
    if (!availableRow) {
      setActionMessage("Every audit item already has an action. Remove or complete an existing action before adding another.");
      return;
    }
    const nextRow = { ...availableRow, ...actionDraft, status: "Open" };
    setRows((current) => current.map((row) => row.sourceRow === nextRow.sourceRow ? nextRow : row));
    if (await persistRow(nextRow)) {
      setActionDraft({ actionRequired: "", owner: "", dueDate: "" });
      setActionMessage("Action added and saved.");
    }
  }

  async function removeAction(row: FiveSAuditRow) {
    const nextRow = { ...row, actionRequired: "", owner: "", dueDate: "", status: "" };
    setRows((current) => current.map((item) => item.sourceRow === nextRow.sourceRow ? nextRow : item));
    if (await persistRow(nextRow)) setActionMessage("Action removed.");
  }

  return <div className="five-s-audit-workspace">
    {loading && <div className="five-s-message" role="status">Loading the live {department} 5S audit…</div>}
    {error && <div className="five-s-message error" role="alert">{error}</div>}

    <div className="five-s-summary-grid">
      <article className="card five-s-summary-card sort-card">
        <span className="section-kicker red">1 · Sort</span>
        <h3>Sort</h3>
        <div className="sort-qr-artwork" style={{ height: "auto", overflow: "visible" }}>
          <Image
            src="/printer-5s-sort-qr.png"
            alt="Vivad 5S submission form QR code"
            width={427}
            height={433}
            priority
            style={{ display: "block", width: "100%", maxWidth: 360, height: "auto", objectFit: "contain" }}
          />
        </div>
      </article>

      <article className="card five-s-summary-card score-card">
        <span className="section-kicker">Overall score</span>
        <div className="five-s-score-chart" role="img" aria-label={`${department} 5S audit overall score ${overallScore}%`} style={{ "--five-s-score": `${overallScore * 3.6}deg` } as CSSProperties}>
          <span><strong>{overallScore}%</strong><small>overall</small></span>
        </div>
        <p>{scoredCount} of {rows.length || 20} questions scored</p>
        <button
          className="button button-secondary score-print-button"
          type="button"
          disabled={loading || !rows.length}
          onClick={() => printFiveSScorePoster({ department, overallScore, scoredCount, totalQuestions: rows.length })}
        >
          Print overall score
        </button>
      </article>

      <article className="card five-s-summary-card actions-card">
        <span className="section-kicker">Open follow-up</span>
        <h3>Actions</h3>
        <form className="five-s-action-form" onSubmit={addAction}>
          <label><span>Action required</span><input required value={actionDraft.actionRequired} onChange={(event) => setActionDraft((current) => ({ ...current, actionRequired: event.target.value }))} placeholder="Describe the action to complete" /></label>
          <label><span>Owner</span><input required value={actionDraft.owner} onChange={(event) => setActionDraft((current) => ({ ...current, owner: event.target.value }))} placeholder="Assign an owner" /></label>
          <label><span>Due date</span><input required type="date" value={actionDraft.dueDate} onChange={(event) => setActionDraft((current) => ({ ...current, dueDate: event.target.value }))} /></label>
          <button className="button button-primary" type="submit">Add action</button>
        </form>
        {actionMessage && <p className="five-s-action-message" role="status">{actionMessage}</p>}
        <div className="five-s-actions-table" role="table" aria-label={`${department} 5S audit actions`}>
          <div className="five-s-actions-row head" role="row"><span>Action required</span><span>Owner</span><span>Due date</span><span>Controls</span></div>
          {actions.length ? actions.map((row) => <div className="five-s-actions-row" role="row" key={row.sourceRow}>
            <input aria-label={`Action required for item ${row.itemNumber}`} value={row.actionRequired} onChange={(event) => updateRow(row.sourceRow, "actionRequired", event.target.value)} />
            <input aria-label={`Action owner for item ${row.itemNumber}`} value={row.owner} onChange={(event) => updateRow(row.sourceRow, "owner", event.target.value)} />
            <input aria-label={`Action due date for item ${row.itemNumber}`} type="date" value={row.dueDate} onChange={(event) => updateRow(row.sourceRow, "dueDate", event.target.value)} />
            <div className="five-s-action-controls"><button type="button" onClick={() => saveRow(row.sourceRow)}>Save</button><button className="danger" type="button" aria-label={`Remove action for item ${row.itemNumber}`} onClick={() => removeAction(row)}>Remove</button><small className={saveStatus[row.sourceRow] === "Saved" ? "save-status saved" : "save-status"}>{saveStatus[row.sourceRow] || ""}</small></div>
          </div>) : <p className="five-s-empty">No open actions yet. Add the first follow-up above.</p>}
        </div>
      </article>
    </div>

    <article className="card five-s-sheet-card">
      <div className="card-title-row">
        <div><span className="section-kicker">{sourceName} · columns A–E</span><h3>Working audit</h3><p>Edit a cell and leave it to save the {department} working copy.</p></div>
        {sourceUrl && <a className="button button-secondary" href={sourceUrl} target="_blank" rel="noreferrer">Open source sheet ↗</a>}
      </div>
      <div className="five-s-sheet-scroll">
        <table className="five-s-sheet">
          <thead><tr><th>A · 5S heading</th><th>B · #</th><th>C · Audit question</th><th>D · Score</th><th>E · Evidence / comments</th><th><span className="sr-only">Save status</span></th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.sourceRow}>
            <td><select aria-label={`5S heading for item ${row.itemNumber}`} value={row.heading} onChange={(event) => updateRow(row.sourceRow, "heading", event.target.value)} onBlur={() => saveRow(row.sourceRow)}>{FIVE_S_HEADINGS.map((heading) => <option key={heading}>{heading}</option>)}</select></td>
            <td><input aria-label={`Item number ${row.itemNumber}`} value={row.itemNumber} onChange={(event) => updateRow(row.sourceRow, "itemNumber", event.target.value)} onBlur={() => saveRow(row.sourceRow)} /></td>
            <td><textarea aria-label={`Audit question ${row.itemNumber}`} value={row.auditQuestion} onChange={(event) => updateRow(row.sourceRow, "auditQuestion", event.target.value)} onBlur={() => saveRow(row.sourceRow)} /></td>
            <td><select aria-label={`Score for item ${row.itemNumber}`} value={row.score} onChange={(event) => updateRow(row.sourceRow, "score", event.target.value)} onBlur={() => saveRow(row.sourceRow)}>{FIVE_S_SCORES.map((score) => <option value={score} key={score || "blank"}>{score || "Select"}</option>)}</select></td>
            <td><textarea aria-label={`Evidence for item ${row.itemNumber}`} value={row.evidenceComments} onChange={(event) => updateRow(row.sourceRow, "evidenceComments", event.target.value)} onBlur={() => saveRow(row.sourceRow)} /></td>
            <td><small className={saveStatus[row.sourceRow] === "Saved" ? "save-status saved" : "save-status"}>{saveStatus[row.sourceRow] || ""}</small></td>
          </tr>)}</tbody>
        </table>
      </div>
    </article>
  </div>;
}
