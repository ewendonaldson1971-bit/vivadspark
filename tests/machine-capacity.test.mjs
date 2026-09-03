import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseMachineCapacityCsv } from "../lib/machine-capacity.ts";

test("machine capability feed maps workstation names and bounded percentages", () => {
  const rows = parseMachineCapacityCsv("Workstation,Capacity,Machine Status\nDurst 512R,70%,Online\nZund,105%,Online\nMatic,-2%,Offline");
  assert.deepEqual(rows, [
    { machine: "Durst 512R", capacity: 70, status: "Online" },
    { machine: "Zund", capacity: 100, status: "Online" },
    { machine: "Matic", capacity: 0, status: "Offline" },
  ]);
});

test("landing panel renders an accessible live machine capability clustered bar chart", async () => {
  const [page, route, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/machine-capacity/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /\/api\/machine-capacity/);
  assert.match(page, /Our machines status at a glance/);
  assert.match(page, /Machine capability percentages/);
  assert.match(page, /clustered bar chart/);
  assert.match(page, /<rect/);
  assert.match(page, /machine\.capacity}%/);
  assert.match(route, /1wxcLbLd9oli2HDIc-_Yec61YmwQjwZDT5F838gLVPtQ/);
  assert.match(route, /204999678/);
  assert.match(route, /cache: "no-store"/);
  assert.match(css, /\.capacity-bar/);
  assert.doesNotMatch(css, /\.portal-support \{ display: none; \}/);
});
