import assert from "node:assert/strict";
import test from "node:test";
import { resolveQualitySheetColumns } from "../lib/quality-sheet-columns.ts";

const sourceHeaders = [
  "207289",
  "category\nD=defect\nT= training",
  "issue spotted\nI= internally or E= Externally",
  "Date",
  "Days Open",
  "Date Closed",
  "Job Number",
  "Department",
  "NCE written and Reported By",
  "who is the BEST person/s to help investigate and solve this issue",
  "What has occured? Description/ Link to RCA",
  "Severity",
  "Root Cause",
  "Potential solution / Remedial Action / notes",
  "Cost of Remediation",
  "Relevent SOPs Link / outcome",
  "NCE Processed",
  "Keeper?",
];

test("live quality-sheet headers map open date from column D", () => {
  const columns = resolveQualitySheetColumns(sourceHeaders);
  assert.equal(columns.date, 3);
  assert.equal(columns.dateClosed, 5);
  assert.equal(columns.jobNumber, 6);
});

test("quality-sheet fields remain aligned with their source headers", () => {
  const columns = resolveQualitySheetColumns(sourceHeaders);
  assert.deepEqual(columns, {
    status: 0, category: 1, origin: 2, date: 3, progression: 4, dateClosed: 5,
    jobNumber: 6, department: 7, reportedBy: 8, assignedTo: 9, description: 10,
    severity: 11, rootCause: 12, action: 13, remediationCost: 14, sopOutcome: 15, processed: 16,
  });
});

test("header matching survives harmless source-column reordering", () => {
  const reordered = [...sourceHeaders];
  const [date] = reordered.splice(3, 1);
  reordered.push(date);
  assert.equal(resolveQualitySheetColumns(reordered).date, reordered.length - 1);
});
