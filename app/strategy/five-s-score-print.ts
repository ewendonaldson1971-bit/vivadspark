type FiveSScorePoster = {
  department: string;
  overallScore: number;
  scoredCount: number;
  totalQuestions: number;
  printedAt?: Date;
};

export function printFiveSScorePoster({ department, overallScore, scoredCount, totalQuestions, printedAt = new Date() }: FiveSScorePoster) {
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
.poster { width: 297mm; min-height: 210mm; padding: 14mm 18mm; display: flex; flex-direction: column; }
.logo { width: 54mm; height: auto; }
.content { min-height: 146mm; display: grid; grid-template-columns: minmax(0, 1fr) 132mm; align-items: center; gap: 18mm; }
.details { padding-left: 8mm; text-align: left; }
.eyebrow { margin: 0 0 5mm; color: #478fe1; font-size: 12pt; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
h1 { margin: 0; color: #3f454c; font-size: 42pt; line-height: 1.05; }
.subtitle { margin: 5mm 0 0; color: #747b83; font-size: 18pt; }
.chart-panel { display: grid; place-items: center; text-align: center; }
.chart { width: 112mm; height: 112mm; display: grid; place-items: center; border-radius: 50%; background: conic-gradient(#478fe1 0deg ${scoreDegrees}deg, #e8edf2 ${scoreDegrees}deg 360deg); }
.chart::before { content: ""; width: 82mm; height: 82mm; grid-area: 1 / 1; border-radius: 50%; background: #fff; box-shadow: inset 0 0 0 1px #e5e9ed; }
.score { z-index: 1; grid-area: 1 / 1; }
.score strong { display: block; color: #3f454c; font-size: 48pt; line-height: 1; }
.score span { display: block; margin-top: 3mm; color: #747b83; font-size: 12pt; letter-spacing: 1px; text-transform: uppercase; }
.questions { margin: 5mm 0 0; color: #5d646c; font-size: 14pt; }
.date { width: 100%; margin: 0; padding-top: 6mm; border-top: 1px solid #dfe3e7; color: #555c64; font-size: 13pt; text-align: right; }
.date strong { color: #3f454c; }
</style></head><body><main class="poster">
<img class="logo" src="${logoUrl}" alt="Vivad SPARK">
<div class="content"><section class="details"><p class="eyebrow">Workplace organisation</p><h1>${safeDepartment} 5S</h1><p class="subtitle">Overall audit score</p></section>
<section class="chart-panel"><div class="chart" role="img" aria-label="Overall score ${score} percent"><div class="score"><strong>${score}%</strong><span>Overall score</span></div></div><p class="questions">${scoredCount} of ${totalQuestions} questions scored</p></section></div>
<p class="date"><strong>Area:</strong> ${safeDepartment}<br><strong>Printed:</strong> ${safeDate}</p>
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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
}
