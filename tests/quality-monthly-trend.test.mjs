import assert from "node:assert/strict";
import test from "node:test";
import { buildQualityMonthlyTrend } from "../lib/quality-monthly-trend.ts";

test("monthly quality trend starts in August 2026 and includes empty months", () => {
  const trend = buildQualityMonthlyTrend([], new Date("2026-10-15T00:00:00Z"));
  assert.deepEqual(trend.map((month) => month.key), ["2026-08", "2026-09", "2026-10"]);
  assert.ok(trend.every((month) => month.open === 0 && month.closed === 0));
});

test("monthly quality trend separates open and closed events side by side", () => {
  const trend = buildQualityMonthlyTrend([
    { date: "2026-08-01T00:00:00.000Z", status: "Open / unclassified" },
    { date: "2026-08-08T00:00:00.000Z", status: "Investigation" },
    { date: "2026-08-10T00:00:00.000Z", status: "Completed" },
    { date: "2026-09-02T00:00:00.000Z", status: "Completed" },
  ], new Date("2026-09-15T00:00:00Z"));
  assert.deepEqual(trend.map(({ key, open, closed }) => ({ key, open, closed })), [
    { key: "2026-08", open: 2, closed: 1 },
    { key: "2026-09", open: 0, closed: 1 },
  ]);
});

test("monthly quality trend ignores events before August 2026", () => {
  const trend = buildQualityMonthlyTrend([
    { date: "2026-07-31T00:00:00.000Z", status: "Completed" },
    { date: null, status: "Open / unclassified" },
  ], new Date("2026-08-24T00:00:00Z"));
  assert.deepEqual(trend.map(({ open, closed }) => ({ open, closed })), [{ open: 0, closed: 0 }]);
});
