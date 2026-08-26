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
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; background: #fff; color: #3f454c; font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.poster { width: 210mm; min-height: 297mm; padding: 18mm; display: flex; align-items: center; flex-direction: column; text-align: center; }
.logo { width: 62mm; height: auto; margin-bottom: 18mm; }
.eyebrow { margin: 0 0 4mm; color: #478fe1; font-size: 12pt; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
h1 { margin: 0; color: #3f454c; font-size: 32pt; line-height: 1.1; }
.subtitle { margin: 4mm 0 14mm; color: #747b83; font-size: 15pt; }
.chart { width: 118mm; height: 118mm; display: grid; place-items: center; border-radius: 50%; background: conic-gradient(#478fe1 0deg ${scoreDegrees}deg, #e8edf2 ${scoreDegrees}deg 360deg); }
.chart::before { content: ""; width: 86mm; height: 86mm; grid-area: 1 / 1; border-radius: 50%; background: #fff; box-shadow: inset 0 0 0 1px #e5e9ed; }
.score { z-index: 1; grid-area: 1 / 1; }
.score strong { display: block; color: #3f454c; font-size: 48pt; line-height: 1; }
.score span { display: block; margin-top: 3mm; color: #747b83; font-size: 12pt; letter-spacing: 1px; text-transform: uppercase; }
.questions { margin: 10mm 0 0; color: #5d646c; font-size: 14pt; }
.date { width: 100%; margin-top: auto; padding-top: 8mm; border-top: 1px solid #dfe3e7; color: #555c64; font-size: 14pt; }
.date strong { color: #3f454c; }
</style></head><body><main class="poster">
<img class="logo" src="${logoUrl}" alt="Vivad SPARK">
<p class="eyebrow">Workplace organisation</p>
<h1>${safeDepartment} 5S</h1>
<p class="subtitle">Overall audit score</p>
<div class="chart" role="img" aria-label="Overall score ${score} percent"><div class="score"><strong>${score}%</strong><span>Overall score</span></div></div>
<p class="questions">${scoredCount} of ${totalQuestions} questions scored</p>
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
