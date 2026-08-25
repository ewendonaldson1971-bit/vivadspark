"use client";

import { CSSProperties, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { FIVE_S_HEADINGS, FIVE_S_SCORES, FiveSAuditRow, calculateFiveSScore, printerAuditActions } from "../../lib/five-s-audit";

type FiveSResponse = {
  available: boolean;
  rows: FiveSAuditRow[];
  overallScore: number;
  storageAvailable?: boolean;
  sourceUrl?: string;
  error?: string;
};

export function FiveSWorkspace({ department }: { department: string }) {
  const [rows, setRows] = useState<FiveSAuditRow[]>([]);
  const [sourceUrl, setSourceUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState<Record<number, string>>({});
  const overallScore = useMemo(() => calculateFiveSScore(rows), [rows]);
  const actions = useMemo(() => printerAuditActions(rows), [rows]);

  useEffect(() => {
    if (department !== "Printers") {
      setRows([]);
      setError("");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/five-s?department=${encodeURIComponent(department)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as FiveSResponse;
        if (!response.ok) throw new Error(data.error || "The Printer Audit could not be loaded.");
        setRows(data.rows || []);
        setSourceUrl(data.sourceUrl || "");
        if (data.storageAvailable === false) setError("The live audit is visible, but working-copy storage is not available yet.");
      })
      .catch((reason) => { if (reason.name !== "AbortError") setError(reason.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [department]);

  if (department !== "Printers") {
    return <article className="card five-s-placeholder">
      <span className="five-s-placeholder-icon" aria-hidden="true">5S</span>
      <div>
        <h3>{department === "All departments" ? "Select Printers to view the trial" : `${department} 5S workspace`}</h3>
        <p>The live audit trial is currently available for Printers. Other departments will be connected next.</p>
      </div>
    </article>;
  }

  function updateRow(sourceRow: number, field: keyof FiveSAuditRow, value: string) {
    setRows((current) => current.map((row) => row.sourceRow === sourceRow ? { ...row, [field]: value } : row));
  }

  async function saveRow(sourceRow: number) {
    const row = rows.find((item) => item.sourceRow === sourceRow);
    if (!row) return;
    setSaveStatus((current) => ({ ...current, [sourceRow]: "Saving…" }));
    try {
      const response = await fetch("/api/five-s", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department, row }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The row could not be saved.");
      setSaveStatus((current) => ({ ...current, [sourceRow]: "Saved" }));
    } catch (reason) {
      setSaveStatus((current) => ({ ...current, [sourceRow]: reason instanceof Error ? reason.message : "Save failed" }));
    }
  }

  return <div className="five-s-printer-workspace">
    {loading && <div className="five-s-message" role="status">Loading the live Printer Audit…</div>}
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
        <div className="five-s-score-chart" role="img" aria-label={`Printer Audit overall score ${overallScore}%`} style={{ "--five-s-score": `${overallScore * 3.6}deg` } as CSSProperties}>
          <span><strong>{overallScore}%</strong><small>overall</small></span>
        </div>
        <p>{rows.filter((row) => /^[0-3]$/.test(row.score)).length} of {rows.length || 20} questions scored</p>
      </article>

      <article className="card five-s-summary-card actions-card">
        <span className="section-kicker">Open follow-up</span>
        <h3>Actions</h3>
        <div className="five-s-actions-table" role="table" aria-label="Printer Audit actions">
          <div className="five-s-actions-row head" role="row"><span>Action required</span><span>Owner</span><span>Due date</span></div>
          {actions.length ? actions.map((row) => <div className="five-s-actions-row" role="row" key={row.sourceRow}><span>{row.actionRequired || "—"}</span><span>{row.owner || "Unassigned"}</span><span>{row.dueDate || "Not set"}</span></div>) : <p className="five-s-empty">No actions are recorded in columns F–H yet.</p>}
        </div>
      </article>
    </div>

    <article className="card five-s-sheet-card">
      <div className="card-title-row">
        <div><span className="section-kicker">Printer Audit · columns A–E</span><h3>Working audit</h3><p>Edit a cell and leave it to save the app working copy.</p></div>
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
