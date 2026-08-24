import assert from "node:assert/strict";
import test from "node:test";
import { formatSydneyPortalDateTime } from "../lib/portal-date-time.ts";

test("formats the portal clock as a long Sydney date with ordinal and time", () => {
  const value = formatSydneyPortalDateTime(new Date("2026-08-24T22:10:00.000Z"));
  assert.equal(value, "Tuesday 25th August 2026 - 08:10am");
});

test("formats ordinal edge cases correctly", () => {
  assert.match(formatSydneyPortalDateTime(new Date("2026-08-20T22:10:00.000Z")), /Friday 21st August/);
  assert.match(formatSydneyPortalDateTime(new Date("2026-08-21T22:10:00.000Z")), /Saturday 22nd August/);
  assert.match(formatSydneyPortalDateTime(new Date("2026-08-22T22:10:00.000Z")), /Sunday 23rd August/);
});
