import type { NextStep, ProblemAnalysis, QualityEventSnapshot } from "../../lib/problem-solving-model";

export type ProblemSolvingPdfData = {
  event: QualityEventSnapshot;
  problemStatement: string;
  analysisNotes: string;
  analysis: ProblemAnalysis;
  selectedSolutionIds: string[];
  nextSteps: NextStep[];
  history: Array<{ version: number; createdBy: string; createdAt: string; provider: string; planUpdatedAt: string | null }>;
};

const LOGO_URL = "/vivad-logo.png";

function filenamePart(value: string) {
  return value.normalize("NFKD").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^[. -]+|[. -]+$/g, "").slice(0, 80) || "Event";
}

export function problemSolvingPdfFilename(data: Pick<ProblemSolvingPdfData, "event">) {
  return `Problem-Solving_${filenamePart(data.event.id)}_${new Date().toISOString().slice(0, 10)}.pdf`;
}

async function logoAsDataUrl() {
  const response = await fetch(LOGO_URL);
  if (!response.ok) throw new Error("The Vivad SPARK logo could not be loaded. The PDF was not created.");
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The Vivad SPARK logo could not be read."));
    reader.readAsDataURL(blob);
  });
}

export async function buildProblemSolvingPdf(data: ProblemSolvingPdfData, logoOverride?: string) {
  const { jsPDF } = await import("jspdf");
  const logoData = logoOverride ?? await logoAsDataUrl();
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const logo = pdf.getImageProperties(logoData);
  const pageWidth = 210, left = 15, right = 15, contentWidth = 180, contentTop = 39, contentBottom = 278;
  let y = contentTop;

  const addHeader = () => {
    pdf.setFont("helvetica", "bold"); pdf.setTextColor(42, 112, 201); pdf.setFontSize(8);
    pdf.text("CONTINUOUS IMPROVEMENT  |  LET'S PROBLEM SOLVE", left, 12);
    pdf.setTextColor(65, 71, 78); pdf.setFontSize(14); pdf.text(data.event.id, left, 21);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(105, 111, 118);
    pdf.text(data.event.description || "Problem-solving report", left, 28, { maxWidth: 112 });
    const logoWidth = 54, logoHeight = logoWidth * (logo.height / logo.width);
    pdf.addImage(logoData, logo.fileType, pageWidth - right - logoWidth, 7, logoWidth, logoHeight);
    pdf.setDrawColor(220, 224, 228); pdf.line(left, 35, pageWidth - right, 35);
  };
  const newPage = () => { pdf.addPage(); addHeader(); y = contentTop; };
  const ensure = (height: number) => { if (y + height > contentBottom) newPage(); };
  const heading = (title: string) => { ensure(12); pdf.setFont("helvetica", "bold"); pdf.setTextColor(42, 112, 201); pdf.setFontSize(9); pdf.text(title.toUpperCase(), left, y + 4); y += 9; };
  const paragraph = (text: string, options?: { bold?: boolean; colour?: [number, number, number]; indent?: number }) => {
    const indent = options?.indent ?? 0; pdf.setFont("helvetica", options?.bold ? "bold" : "normal"); pdf.setFontSize(8.5); pdf.setTextColor(...(options?.colour ?? [70, 76, 83]));
    const lines = pdf.splitTextToSize(text || "Not recorded", contentWidth - indent); const height = Math.max(6, lines.length * 4.1); ensure(height + 2); pdf.text(lines, left + indent, y + 3); y += height + 2;
  };
  const field = (label: string, value: string) => { pdf.setFont("helvetica", "bold"); pdf.setTextColor(120, 126, 133); pdf.setFontSize(6.5); pdf.text(label.toUpperCase(), left, y + 3); y += 5; paragraph(value); };

  addHeader();
  heading("Event and problem summary");
  const metadata = [
    ["Status", data.event.status], ["Department", data.event.department], ["Category", data.event.category], ["Date", data.event.dateLabel],
    ["Job", data.event.jobNumber], ["Severity", data.event.severity == null ? "Not recorded" : String(data.event.severity)], ["Assigned to", data.event.assignedTo], ["Reported by", data.event.reportedBy],
  ];
  metadata.forEach(([label, value], index) => {
    const column = index % 2, row = Math.floor(index / 2), boxY = y + row * 13;
    pdf.setFillColor(248, 249, 251); pdf.setDrawColor(224, 227, 231); pdf.rect(left + column * 90, boxY, 90, 13, "FD");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(6); pdf.setTextColor(130, 136, 143); pdf.text(label.toUpperCase(), left + 4 + column * 90, boxY + 4);
    pdf.setFontSize(8); pdf.setTextColor(66, 72, 79); pdf.text(pdf.splitTextToSize(value || "Not recorded", 80).slice(0, 1), left + 4 + column * 90, boxY + 9);
  });
  y += 56;
  field("Problem statement", data.problemStatement);
  field("Event description", data.event.description);
  if (data.event.rootCause) field("Recorded cause", data.event.rootCause);
  if (data.analysisNotes) field("Analysis notes", data.analysisNotes);
  field("Analysis summary", data.analysis.summary);

  heading("Ishikawa fishbone overview");
  ensure(91);
  const fishTop = y, spineY = fishTop + 42, headStart = left + 149;
  pdf.setDrawColor(105, 111, 118); pdf.setLineWidth(0.8); pdf.line(left + 9, spineY, headStart, spineY);
  pdf.setFillColor(103, 108, 113); pdf.triangle(left + 9, spineY, left, spineY - 13, left, spineY + 13, "F");
  pdf.triangle(headStart, spineY - 24, pageWidth - right, spineY, headStart, spineY + 24, "F");
  const order = ["Method", "Machine", "People", "Materials", "Measurement", "Environmental"];
  const colours: Array<[number, number, number]> = [[240,170,43],[232,65,86],[199,44,79],[154,103,215],[57,170,219],[89,184,108]];
  order.forEach((category, index) => {
    const top = index < 3, column = index % 3, jointX = left + 47 + column * 39, endX = jointX - 18, endY = top ? fishTop + 7 : fishTop + 77;
    pdf.setDrawColor(...colours[index]); pdf.setLineWidth(0.7); pdf.line(endX, endY, jointX, spineY); pdf.setFillColor(...colours[index]); pdf.circle(jointX, spineY, 1.5, "F");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(...colours[index]); pdf.text(category, endX, top ? endY - 2 : endY + 5, { align: "center" });
    const cause = data.analysis.causes.find((item) => item.category === category)?.findings[0] || "No cause recorded";
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(5.5); pdf.setTextColor(80, 86, 93); pdf.text(pdf.splitTextToSize(cause, 31).slice(0, 2), endX, top ? endY + 3 : endY - 8, { align: "center" });
  });
  pdf.setTextColor(255,255,255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.text("PROBLEM", headStart + 17, spineY - 3, { align: "center" });
  pdf.setFontSize(5.5); pdf.text(pdf.splitTextToSize(data.problemStatement || "Not recorded", 29).slice(0, 4), headStart + 17, spineY + 3, { align: "center" });
  y += 91;

  heading("Detailed Ishikawa causes");
  data.analysis.causes.forEach((cause) => {
    ensure(15); pdf.setFillColor(247, 249, 252); pdf.setDrawColor(218, 222, 227); pdf.roundedRect(left, y, contentWidth, 8, 2, 2, "FD");
    pdf.setFont("helvetica", "bold"); pdf.setTextColor(66, 72, 79); pdf.setFontSize(8); pdf.text(cause.category, left + 4, y + 5.2); y += 11;
    cause.findings.forEach((finding) => paragraph(`- ${finding}`, { indent: 3 }));
    paragraph(`Evidence check: ${cause.evidenceGap}`, { colour: [139, 99, 27], indent: 3 }); y += 2;
  });

  heading("Selected solutions");
  const selected = data.analysis.solutions.filter((solution) => data.selectedSolutionIds.includes(solution.id));
  (selected.length ? selected : data.analysis.solutions).forEach((solution, index) => {
    paragraph(`${index + 1}. ${solution.title} [${solution.priority}]`, { bold: true }); paragraph(solution.rationale, { indent: 5 });
  });

  heading("Action plan");
  data.nextSteps.forEach((step, index) => {
    const actionLines = pdf.splitTextToSize(step.action || "No action recorded", 164); const blockHeight = Math.max(17, 11 + actionLines.length * 4); ensure(blockHeight + 3);
    pdf.setFillColor(247,249,252); pdf.setDrawColor(216,221,226); pdf.roundedRect(left, y, contentWidth, blockHeight, 2, 2, "FD");
    pdf.setFont("helvetica", "bold"); pdf.setTextColor(42,112,201); pdf.setFontSize(7); pdf.text(`STEP ${index + 1}`, left + 4, y + 5);
    pdf.setTextColor(65,71,78); pdf.setFontSize(8.5); pdf.text(actionLines, left + 23, y + 5);
    pdf.setFont("helvetica", "normal"); pdf.setTextColor(105,111,118); pdf.setFontSize(6.5); pdf.text(`Owner: ${step.owner || "Unassigned"}   |   Due: ${step.dueDate || "Not set"}   |   Priority: ${step.priority}`, left + 23, y + blockHeight - 4);
    y += blockHeight + 4;
  });

  heading("History and audit");
  if (!data.history.length) paragraph("No previous analysis history was recorded.");
  data.history.forEach((item) => paragraph(`Version ${item.version} - ${new Date(item.createdAt).toLocaleString("en-AU")} - ${item.createdBy} - ${item.provider}${item.planUpdatedAt ? " - Action plan saved" : ""}`));

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page); pdf.setDrawColor(220,224,228); pdf.line(left, 283, pageWidth - right, 283); pdf.setFont("helvetica", "normal"); pdf.setTextColor(115,121,128); pdf.setFontSize(7);
    pdf.text(`Problem-solving report | ${data.event.id}`, left, 288); pdf.text(`Page ${page} of ${pages}`, pageWidth - right, 288, { align: "right" });
  }
  return { blob: pdf.output("blob"), filename: problemSolvingPdfFilename(data), pageCount: pages };
}
