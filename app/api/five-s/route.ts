import { NextResponse } from "next/server";
import {
  calculateFiveSScore,
  FIVE_S_HEADINGS,
  FIVE_S_SCORES,
  FiveSAuditRow,
  fiveSAuditActions,
  getFiveSAuditConfig,
  parseFiveSAuditCsv,
} from "../../../lib/five-s-audit";
import { applyFiveSOverrides, saveFiveSOverride } from "../../../lib/five-s-audit-store";

export const dynamic = "force-dynamic";

const SHEET_ID = "1yr3iZTR3lRZOlL2gOKsPgCniD0TJMnNC";
export async function GET(request: Request) {
  const department = new URL(request.url).searchParams.get("department") || "";
  const config = getFiveSAuditConfig(department);
  if (!config) {
    return NextResponse.json({ available: false, department, rows: [], actions: [], overallScore: 0 });
  }

  try {
    const auditUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(config.sheetName)}`;
    const response = await fetch(auditUrl, {
      cache: "no-store",
      headers: { "User-Agent": "Vivad SPARK 5S workspace" },
    });
    if (!response.ok) throw new Error(`Google Sheets returned ${response.status}`);

    const sourceRows = parseFiveSAuditCsv(await response.text());
    let rows = sourceRows;
    let storageAvailable = true;
    try {
      rows = await applyFiveSOverrides(department, sourceRows);
    } catch (error) {
      storageAvailable = false;
      console.warn("5S working-copy storage is unavailable", error instanceof Error ? error.message : error);
    }

    return NextResponse.json({
      available: true,
      department,
      rows,
      actions: fiveSAuditActions(rows),
      overallScore: calculateFiveSScore(rows),
      storageAvailable,
      refreshedAt: new Date().toISOString(),
      source: `Vivad 5S Audit – ${config.sheetName}`,
      sourceName: config.sheetName,
      sourceUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${config.gid}`,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      available: false,
      department,
      rows: [],
      actions: [],
      overallScore: 0,
      error: error instanceof Error ? error.message : `The ${config.sheetName} could not be loaded.`,
    }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const department = clean(body.department, 40);
    if (!getFiveSAuditConfig(department)) return validationError("Select a valid 5S audit department.");
    const row = validRow(body.row);
    if (!row) return validationError("Enter valid 5S audit values.");
    return NextResponse.json({ result: await saveFiveSOverride(department, row) });
  } catch (error) {
    console.error("5S row update failed", error);
    return NextResponse.json({ error: "The audit row could not be saved. Please try again." }, { status: 503 });
  }
}

function validRow(value: unknown): FiveSAuditRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const sourceRow = Number(row.sourceRow);
  const heading = clean(row.heading, 80);
  const itemNumber = clean(row.itemNumber, 10);
  const auditQuestion = clean(row.auditQuestion, 500);
  const score = clean(row.score, 3).toUpperCase();
  const evidenceComments = clean(row.evidenceComments, 1000);
  if (!Number.isInteger(sourceRow) || sourceRow < 1 || sourceRow > 100) return null;
  if (!FIVE_S_HEADINGS.includes(heading as (typeof FIVE_S_HEADINGS)[number])) return null;
  if (!/^\d{1,2}$/.test(itemNumber) || !auditQuestion) return null;
  if (!FIVE_S_SCORES.includes(score as (typeof FIVE_S_SCORES)[number])) return null;
  return {
    sourceRow, heading, itemNumber, auditQuestion, score, evidenceComments,
    actionRequired: clean(row.actionRequired, 500), owner: clean(row.owner, 120),
    dueDate: clean(row.dueDate, 40), status: clean(row.status, 40),
  };
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/\0/g, "").trim().slice(0, max) : "";
}

function validationError(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
