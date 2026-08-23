import { NextResponse } from "next/server";
import { qualityEventJobNumber } from "../../../lib/quality-event-reference";
import { resolveQualitySheetColumns } from "../../../lib/quality-sheet-columns";

const SHEET_ID = "1aKVB1RjaQSoEW9yw14YJ2asSrsSwDDR3EB2KnSfPRMc";
const SHEET_GID = "407617143";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];

    if (character === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(field);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }

  return rows;
}

function clean(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

function normaliseStatus(value: string) {
  const status = clean(value).toLowerCase();
  if (status.startsWith("complete")) return "Completed";
  if (status.includes("progress") || status.includes("ongoing")) return "In progress";
  if (status.includes("investigation")) return "Investigation";
  return status ? clean(value) : "Open / unclassified";
}

function normaliseCategory(value: string) {
  const category = clean(value).toUpperCase();
  if (!category) return "Unclassified";

  const labels: Record<string, string> = {
    D: "Defect",
    T: "Training",
    F: "Foam",
    P: "Procedure",
    S: "System",
  };

  const codes = Array.from(new Set(category.match(/[DTFPS]/g) ?? []));
  if (codes.length) return codes.map((code) => labels[code]).join(" + ");
  return clean(value);
}

function normaliseOrigin(value: string) {
  const origin = clean(value).toUpperCase();
  if (origin.startsWith("E")) return "External";
  if (origin.startsWith("I")) return "Internal";
  return origin ? clean(value) : "Unclassified";
}

function parseDate(value: string) {
  const match = clean(value).match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += 2000;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.toISOString();
}

export async function GET() {
  try {
    const response = await fetch(SHEET_URL, {
      cache: "no-store",
      headers: { "User-Agent": "Vivad quality workspace" },
    });

    if (!response.ok) {
      throw new Error(`Google Sheets returned ${response.status}`);
    }

    const csv = await response.text();
    const [headerRow = [], ...dataRows] = parseCsv(csv);
    const columns = resolveQualitySheetColumns(headerRow);
    const events = dataRows
      .filter((row) => row.some((cell) => clean(cell)))
      .map((row, index) => {
        const sourceRowNumber = index + 2;
        const jobNumber = qualityEventJobNumber(row[columns.jobNumber], row[columns.date], sourceRowNumber);
        return {
          id: `${jobNumber}-${sourceRowNumber}`,
          status: normaliseStatus(row[columns.status]),
          progression: clean(row[columns.progression]),
          category: normaliseCategory(row[columns.category]),
          origin: normaliseOrigin(row[columns.origin]),
          date: parseDate(row[columns.date]),
          dateLabel: clean(row[columns.date]) || "Date not recorded",
          dateClosed: parseDate(row[columns.dateClosed]),
          dateClosedLabel: clean(row[columns.dateClosed]) || "Not closed",
          jobNumber,
          department: clean(row[columns.department]) || "Unclassified",
          reportedBy: clean(row[columns.reportedBy]) || "Unassigned",
          assignedTo: clean(row[columns.assignedTo]) || "Unassigned",
          description: clean(row[columns.description]) || "No description recorded",
          severity: Number.parseInt(clean(row[columns.severity]), 10) || null,
          rootCause: clean(row[columns.rootCause]),
          action: clean(row[columns.action]),
          remediationCost: clean(row[columns.remediationCost]),
          sopOutcome: clean(row[columns.sopOutcome]),
          processed: clean(row[columns.processed]),
        };
      });

    return NextResponse.json({
      events,
      refreshedAt: new Date().toISOString(),
      source: "Vivad Non-Conformance Event Log",
    });
  } catch (error) {
    return NextResponse.json(
      {
        events: [],
        error: error instanceof Error ? error.message : "The event log could not be loaded.",
      },
      { status: 502 },
    );
  }
}
