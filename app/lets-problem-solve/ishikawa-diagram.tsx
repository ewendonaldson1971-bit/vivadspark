"use client";

import { FormEvent, useState } from "react";
import type { CauseCategory, ProblemAnalysis } from "../../lib/problem-solving-model";

type Props = {
  analysis: ProblemAnalysis;
  problemStatement: string;
  onProblemStatementChange: (value: string) => void;
  onFindingsChange: (category: CauseCategory["category"], findings: string[]) => void;
};

const tones: Record<CauseCategory["category"], string> = {
  Method: "amber",
  Machine: "red",
  People: "crimson",
  Environmental: "green",
  Measurement: "blue",
  Materials: "purple",
};

export function IshikawaDiagram({ analysis, problemStatement, onProblemStatementChange, onFindingsChange }: Props) {
  const [drafts, setDrafts] = useState<Partial<Record<CauseCategory["category"], string>>>({});
  const byCategory = Object.fromEntries(analysis.causes.map((cause) => [cause.category, cause])) as Record<CauseCategory["category"], CauseCategory>;
  const diagramOrder: CauseCategory["category"][] = ["Method", "Machine", "People", "Materials", "Measurement", "Environmental"];

  function addFinding(event: FormEvent, cause: CauseCategory) {
    event.preventDefault();
    const finding = drafts[cause.category]?.trim();
    if (!finding) return;
    onFindingsChange(cause.category, [...cause.findings, finding]);
    setDrafts((current) => ({ ...current, [cause.category]: "" }));
  }

  return <div className="ishikawa-workspace">
    <label className="ishikawa-problem-input">
      <span>Problem statement for the fish head</span>
      <input value={problemStatement} maxLength={240} onChange={(event) => onProblemStatementChange(event.target.value)} placeholder="Describe the problem to be solved" />
    </label>

    <div className="ishikawa-brainstorm" aria-label="Ishikawa brainstorming categories">
      {analysis.causes.map((cause) => <details key={cause.category} className={`ishikawa-dropdown ${tones[cause.category]}`}>
        <summary><span>{cause.category}</span><small>{cause.findings.length} {cause.findings.length === 1 ? "cause" : "causes"}</small></summary>
        <form onSubmit={(event) => addFinding(event, cause)}>
          <label><span>Add brainstorm item</span><input value={drafts[cause.category] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [cause.category]: event.target.value }))} placeholder={`Add a ${cause.category.toLowerCase()} cause`} /></label>
          <button type="submit" disabled={!drafts[cause.category]?.trim()}>Add cause</button>
        </form>
        <ul>{cause.findings.map((finding, index) => <li key={`${finding}-${index}`}><span>{finding}</span><button type="button" aria-label={`Remove ${finding} from ${cause.category}`} onClick={() => onFindingsChange(cause.category, cause.findings.filter((_, itemIndex) => itemIndex !== index))}>×</button></li>)}</ul>
      </details>)}
    </div>

    <div className="ishikawa-canvas-scroll" tabIndex={0} aria-label="Interactive Ishikawa fishbone diagram">
      <div className="ishikawa-canvas">
        <svg viewBox="0 0 1100 520" role="img" aria-labelledby="ishikawa-svg-title ishikawa-svg-description">
          <title id="ishikawa-svg-title">Ishikawa cause and effect diagram</title>
          <desc id="ishikawa-svg-description">Six cause branches lead to the selected problem statement.</desc>
          <path className="fish-tail" d="M90 260 18 188 49 260 18 332Z" />
          <path className="fish-spine" d="M48 260H880" />
          <path className="fish-head" d="M870 124 Q1045 160 1082 260 Q1045 360 870 396 Q910 260 870 124Z" />
          <g className="fish-branches"><path d="M225 84 360 260M475 84 575 260M720 84 790 260M225 436 360 260M475 436 575 260M720 436 790 260" /></g>
          <g className="fish-joints"><circle cx="360" cy="260" r="6"/><circle cx="575" cy="260" r="6"/><circle cx="790" cy="260" r="6"/></g>
        </svg>
        {diagramOrder.map((category, index) => <article className={`ishikawa-branch branch-${index + 1} ${tones[category]}`} key={category}>
          <h3>{category}</h3>
          {byCategory[category].findings.length ? <ul>{byCategory[category].findings.map((finding, findingIndex) => <li key={`${finding}-${findingIndex}`}>{finding}</li>)}</ul> : <p>Add brainstorm causes above.</p>}
        </article>)}
        <div className="ishikawa-head-copy"><span>Problem</span><strong>{problemStatement.trim() || "Enter the problem statement above"}</strong></div>
      </div>
    </div>
  </div>;
}
