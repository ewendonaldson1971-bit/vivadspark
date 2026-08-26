type FiveSScorePoster = {
  department: string;
  overallScore: number;
  scoredCount: number;
  totalQuestions: number;
  actions?: Array<{ actionRequired: string; owner: string; dueDate: string }>;
  printedAt?: Date;
};

export function printFiveSScorePoster({ department, overallScore, scoredCount, totalQuestions, actions = [], printedAt = new Date() }: FiveSScorePoster) {
  const frame = document.createElement("iframe");
  frame.title = `${department} 5S overall score print preview`;
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "1px", height: "1px", border: "0", opacity: "0" });
  document.body.appendChild(frame);

  const printWindow = frame.contentWindow;
  const printDocument = frame.contentDocument;
  if (!printWindow || !printDocument) {
    frame.remove();
    throw new Error("The print preview could not be opened.");
  }

  const safeDepartment = escapeHtml(department);
  const safeDate = escapeHtml(formatPosterDate(printedAt));
  const score = Math.max(0, Math.min(100, Math.round(overallScore)));
  const scoreDegrees = score * 3.6;
  const logoUrl = new URL("/vivad-logo.png", window.location.origin).href;
  const actionRows = actions.length
    ? actions.map((action) => `<tr><td>${escapeHtml(action.actionRequired)}</td><td>${escapeHtml(action.owner || "Unassigned")}</td><td>${escapeHtml(formatDueDate(action.dueDate))}</td></tr>`).join("")
    : '<tr><td class="no-actions" colspan="3">No open actions recorded.</td></tr>';
  const tableClass = actions.length > 12 ? "actions-table dense" : "actions-table";
  let printStarted = false;

  const cleanup = () => frame.remove();
  const startPrint = () => {
    if (printStarted || !frame.isConnected) return;
    printStarted = true;
    printWindow.focus();
    printWindow.print();
  };

  printWindow.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(cleanup, 60_000);

  printDocument.open();
  printDocument.write(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${safeDepartment} 5S overall score</title><style>
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; background: #fff; color: #3f454c; font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.poster { width: 297mm; min-height: 210mm; padding: 12mm 15mm; display: flex; flex-direction: column; }
.header { display: flex; align-items: center; justify-content: space-between; gap: 12mm; padding-bottom: 5mm; border-bottom: 1px solid #dfe3e7; }
.logo { width: 50mm; height: auto; }
.title { text-align: right; }
.eyebrow { margin: 0 0 2mm; color: #478fe1; font-size: 9pt; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; }
h1 { margin: 0; color: #3f454c; font-size: 25pt; line-height: 1.05; }
.title p { margin: 2mm 0 0; color: #747b83; font-size: 10pt; }
.content { flex: 1; display: grid; grid-template-columns: 94mm minmax(0, 1fr); align-items: stretch; gap: 10mm; padding: 7mm 0; }
.score-panel, .actions-panel { border: 1px solid #dfe3e7; border-radius: 4mm; background: #fff; }
.score-panel { display: flex; align-items: center; justify-content: center; flex-direction: column; padding: 7mm; text-align: center; }
.panel-label { margin: 0 0 5mm; color: #478fe1; font-size: 9pt; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; }
.chart { width: 82mm; height: 82mm; display: grid; place-items: center; border-radius: 50%; background: conic-gradient(#478fe1 0deg ${scoreDegrees}deg, #e8edf2 ${scoreDegrees}deg 360deg); }
.chart::before { content: ""; width: 60mm; height: 60mm; grid-area: 1 / 1; border-radius: 50%; background: #fff; box-shadow: inset 0 0 0 1px #e5e9ed; }
.score { z-index: 1; grid-area: 1 / 1; }
.score strong { display: block; color: #3f454c; font-size: 38pt; line-height: 1; }
.score span { display: block; margin-top: 2mm; color: #747b83; font-size: 9pt; letter-spacing: 1px; text-transform: uppercase; }
.questions { margin: 4mm 0 0; color: #5d646c; font-size: 10pt; }
.actions-panel { padding: 6mm; }
.actions-panel h2 { margin: 0 0 4mm; color: #3f454c; font-size: 17pt; }
.actions-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.actions-table th { padding: 2.5mm 2mm; border-bottom: 1px solid #dfe3e7; background: #f7f9fb; color: #747b83; font-size: 7.5pt; letter-spacing: .5px; text-align: left; text-transform: uppercase; }
.actions-table td { padding: 2.5mm 2mm; border-bottom: 1px solid #e8ebee; color: #4b5259; font-size: 8.5pt; line-height: 1.2; overflow-wrap: anywhere; vertical-align: top; }
.actions-table th:nth-child(1) { width: 62%; }.actions-table th:nth-child(2) { width: 20%; }.actions-table th:nth-child(3) { width: 18%; }
.actions-table.dense th { padding: 1.7mm; font-size: 7pt; }.actions-table.dense td { padding: 1.5mm 1.7mm; font-size: 7.2pt; line-height: 1.1; }
.no-actions { padding: 12mm 3mm !important; color: #747b83 !important; text-align: center; }
.footer { width: 100%; margin: 0; padding-top: 4mm; border-top: 1px solid #dfe3e7; color: #555c64; font-size: 10pt; text-align: right; }
.footer strong { color: #3f454c; }
</style></head><body><main class="poster">
<header class="header"><img class="logo" src="${logoUrl}" alt="Vivad SPARK"><div class="title"><p class="eyebrow">Workplace organisation</p><h1>${safeDepartment} 5S report</h1><p>${safeDate}</p></div></header>
<div class="content"><section class="score-panel"><p class="panel-label">Overall score</p><div class="chart" role="img" aria-label="Overall score ${score} percent"><div class="score"><strong>${score}%</strong><span>Overall score</span></div></div><p class="questions">${scoredCount} of ${totalQuestions} questions scored</p></section>
<section class="actions-panel"><p class="panel-label">Open follow-up</p><h2>Actions</h2><table class="${tableClass}"><thead><tr><th>Action required</th><th>Owner</th><th>Due date</th></tr></thead><tbody>${actionRows}</tbody></table></section></div>
<p class="footer"><strong>Department:</strong> ${safeDepartment} &nbsp;&nbsp; <strong>Printed:</strong> ${safeDate}</p>
</main></body></html>`);
  printDocument.close();

  const logo = printDocument.querySelector("img");
  if (logo?.complete) window.setTimeout(startPrint, 100);
  else if (logo) {
    logo.addEventListener("load", startPrint, { once: true });
    logo.addEventListener("error", startPrint, { once: true });
  }
  window.setTimeout(startPrint, 1_000);
}

function formatPosterDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Sydney",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  const day = Number(value("day"));
  return `${value("weekday")} ${day}${ordinal(day)} ${value("month")} ${value("year")}`;
}

function ordinal(day: number) {
  if (day >= 11 && day <= 13) return "th";
  if (day % 10 === 1) return "st";
  if (day % 10 === 2) return "nd";
  if (day % 10 === 3) return "rd";
  return "th";
}

function formatDueDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || "Not set";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
}
