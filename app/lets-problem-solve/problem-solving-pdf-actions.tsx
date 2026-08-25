"use client";

import { useEffect, useRef, useState } from "react";
import { buildProblemSolvingPdf, type ProblemSolvingPdfData } from "./problem-solving-pdf";

export function ProblemSolvingPdfActions({ data, disabled }: { data: ProblemSolvingPdfData; disabled: boolean }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [result, setResult] = useState<{ blob: Blob; url: string; filename: string } | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null), closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);
  useEffect(() => { if (result) closeRef.current?.focus(); }, [result]);

  async function generate() {
    setBusy(true); setError(""); setMessage("Creating the complete problem-solving PDF…");
    try {
      const pdf = await buildProblemSolvingPdf(data); const url = URL.createObjectURL(pdf.blob);
      setResult((current) => { if (current) URL.revokeObjectURL(current.url); return { blob: pdf.blob, url, filename: pdf.filename }; });
      setMessage(`PDF ready - ${pdf.pageCount} ${pdf.pageCount === 1 ? "page" : "pages"}.`);
    } catch (caught) { setMessage(""); setError(caught instanceof Error ? caught.message : "The PDF could not be generated."); }
    finally { setBusy(false); }
  }
  function download() { if (!result) return; const link = document.createElement("a"); link.href = result.url; link.download = result.filename; link.click(); setMessage("PDF downloaded successfully."); }
  function print() { if (!result) return; const target = frameRef.current?.contentWindow; if (target) { target.focus(); target.print(); } else window.open(result.url, "_blank", "noopener,noreferrer"); }
  async function share() {
    if (!result) return; const file = new File([result.blob], result.filename, { type: "application/pdf" });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try { await navigator.share({ title: `Problem-solving report ${data.event.id}`, files: [file] }); setMessage("PDF shared successfully."); return; }
      catch (caught) { if (caught instanceof DOMException && caught.name === "AbortError") return; }
    }
    download(); setMessage("Sharing is unavailable, so the PDF was downloaded instead.");
  }
  function close() { setResult((current) => { if (current) URL.revokeObjectURL(current.url); return null; }); setMessage(""); }

  return <div className="problem-pdf-actions">
    <button className="ps-primary" type="button" disabled={disabled || busy} onClick={generate} aria-haspopup="dialog">{busy ? "Creating PDF…" : "Preview and print completed report"}</button>
    {disabled && <p>Save the completed action plan to enable the PDF report.</p>}
    {(message || error) && <span className={error ? "error" : ""} role={error ? "alert" : "status"}>{error || message}</span>}
    {result && <div className="sop-pdf-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="sop-pdf-dialog" role="dialog" aria-modal="true" aria-labelledby="problem-pdf-title" onKeyDown={(event) => { if (event.key === "Escape") close(); }}>
        <header><div><span>LET&apos;S PROBLEM SOLVE PDF</span><h2 id="problem-pdf-title">{data.event.id} - Complete report</h2></div><button ref={closeRef} type="button" aria-label="Close problem-solving PDF preview" onClick={close}>×</button></header>
        <div className="sop-pdf-toolbar" aria-label="Problem-solving PDF actions"><a href={result.url} target="_blank" rel="noreferrer">Open PDF</a><button type="button" onClick={print}>Print</button><button type="button" onClick={share}>Share</button><button className="primary" type="button" onClick={download}>Download</button></div>
        <iframe ref={frameRef} src={result.url} title={`Problem-solving PDF preview for ${data.event.id}`} />
      </section>
    </div>}
  </div>;
}
