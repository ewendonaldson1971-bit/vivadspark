import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FIVE_S_AUDIT_DEPARTMENTS, calculateFiveSScore, fiveSAuditActions, getFiveSAuditConfig, parseFiveSAuditCsv } from "../lib/five-s-audit.ts";

const csv = `VIVAD 5S AUDIT – PRINTER AREAS,#,Audit Question,Score,Evidence / Comments,Action Required,Owner,Due Date,Status
1. Sort,1,"Remove obsolete inks, media offcuts and empty cores",3,Clear,Keep red-tag station available,Alex,01/09/2026,Open
1. Sort,2,"Keep only required tools at the machine",2,Two extra tools,,,,
2. Set in Order,5,"Label inks and approved tools",N/A,Awaiting machine move,,,,
1. Sort,1,0,0,0,0%,Not scored,,
Overall,20,0,0,0,0%,Not scored,,`;

test("Printer Audit maps live columns A through I", () => {
  const rows = parseFiveSAuditCsv(csv);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], {
    sourceRow: 2,
    heading: "1. Sort",
    itemNumber: "1",
    auditQuestion: "Remove obsolete inks, media offcuts and empty cores",
    score: "3",
    evidenceComments: "Clear",
    actionRequired: "Keep red-tag station available",
    owner: "Alex",
    dueDate: "2026-09-01",
    status: "Open",
  });
});

test("overall 5S score excludes N/A and unscored questions", () => {
  const rows = parseFiveSAuditCsv(csv);
  assert.equal(calculateFiveSScore(rows), 83);
});

test("action panel is sourced from columns F, G and H", () => {
  const actions = fiveSAuditActions(parseFiveSAuditCsv(csv));
  assert.equal(actions.length, 1);
  assert.equal(actions[0].actionRequired, "Keep red-tag station available");
  assert.equal(actions[0].owner, "Alex");
  assert.equal(actions[0].dueDate, "2026-09-01");
});

test("every department is mapped to a live 5S audit template", () => {
  assert.equal(FIVE_S_AUDIT_DEPARTMENTS.length, 10);
  for (const department of FIVE_S_AUDIT_DEPARTMENTS) assert.ok(getFiveSAuditConfig(department));
  assert.equal(getFiveSAuditConfig("Printers")?.sheetName, "Printer Audit");
  assert.equal(getFiveSAuditConfig("Cutters")?.sheetName, "Cutter Audit");
  assert.equal(getFiveSAuditConfig("Fab1")?.sheetName, "Fabrication Audit");
  assert.equal(getFiveSAuditConfig("Framing")?.sheetName, "Fabrication Audit");
  assert.equal(getFiveSAuditConfig("Sew")?.sheetName, "Fabrication Audit");
  assert.equal(getFiveSAuditConfig("Light Box")?.sheetName, "Lightbox Audit");
  assert.equal(getFiveSAuditConfig("Office")?.sheetName, "Office Audit");
  assert.equal(getFiveSAuditConfig("Despatch")?.sheetName, "Despatch Audit");
  assert.equal(getFiveSAuditConfig("All departments"), null);
});

test("department 5S pages use the linked audit workbook and persist editable actions", () => {
  const route = readFileSync(new URL("../app/api/five-s/route.ts", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../app/strategy/five-s-workspace.tsx", import.meta.url), "utf8");
  const scorePrint = readFileSync(new URL("../app/strategy/five-s-score-print.ts", import.meta.url), "utf8");
  const store = readFileSync(new URL("../lib/five-s-audit-store.ts", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../netlify/database/migrations/20260825090000_create_five_s_audit_overrides/migration.sql", import.meta.url), "utf8");
  const actionMigration = readFileSync(new URL("../netlify/database/migrations/20260826120000_add_five_s_action_fields/migration.sql", import.meta.url), "utf8");
  assert.match(route, /1yr3iZTR3lRZOlL2gOKsPgCniD0TJMnNC/);
  assert.match(route, /getFiveSAuditConfig\(department\)/);
  assert.match(route, /saveFiveSOverride\(department, row\)/);
  assert.match(workspace, /A · 5S heading/);
  assert.match(workspace, /B · #/);
  assert.match(workspace, /C · Audit question/);
  assert.match(workspace, /D · Score/);
  assert.match(workspace, /E · Evidence \/ comments/);
  assert.match(workspace, /Action required/);
  assert.match(workspace, /Add action/);
  assert.match(workspace, /Assign an owner/);
  assert.match(workspace, /type="date"/);
  assert.match(workspace, /removeAction/);
  assert.match(store, /action_required, owner, due_date, status/);
  assert.match(store, /action_required = EXCLUDED\.action_required/);
  assert.match(actionMigration, /ADD COLUMN IF NOT EXISTS action_required/);
  assert.match(actionMigration, /ADD COLUMN IF NOT EXISTS owner/);
  assert.match(actionMigration, /ADD COLUMN IF NOT EXISTS due_date/);
  assert.match(workspace, /Overall score/);
  assert.match(workspace, /Print overall score/);
  assert.match(workspace, /printFiveSScorePoster/);
  assert.match(scorePrint, /@page \{ size: A4 landscape/);
  assert.match(scorePrint, /width: 297mm; min-height: 210mm/);
  assert.match(scorePrint, /Area:<\/strong> \$\{safeDepartment\}/);
  assert.match(scorePrint, /Printed:<\/strong> \$\{safeDate\}/);
  assert.match(scorePrint, /\/vivad-logo\.png/);
  assert.match(scorePrint, /printWindow\.print\(\)/);
  assert.match(workspace, /\/printer-5s-sort-qr\.png/);
  assert.match(workspace, /Vivad 5S submission form QR code/);
  assert.match(workspace, /height: "auto", overflow: "visible"/);
  assert.match(workspace, /width: "100%", maxWidth: 360, height: "auto"/);
  assert.match(styles, /\.sort-qr-artwork img \{[^}]*height: auto;[^}]*object-fit: contain;/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS five_s_audit_overrides/);
});
