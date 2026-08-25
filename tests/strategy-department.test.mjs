import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const strategy = readFileSync(new URL("../app/strategy/page.tsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../app/components/workspace-navigation.tsx", import.meta.url), "utf8");
const fiveSWorkspace = readFileSync(new URL("../app/strategy/five-s-workspace.tsx", import.meta.url), "utf8");

test("strategy deployment offers every established department and persists the selection", () => {
  for (const department of ["CST", "Prepress", "Printers", "Cutters", "Fab1", "Framing", "Sew", "Light Box", "Office", "Despatch"]) {
    assert.match(strategy, new RegExp(`"${department}"`));
  }
  assert.match(strategy, /aria-label="Strategy department"/);
  assert.match(strategy, /vivad-strategy-department/);
  assert.match(strategy, /window\.localStorage\.setItem\(STRATEGY_DEPARTMENT_KEY/);
});

test("selected department drives its own strategy deployment content", () => {
  assert.match(strategy, /teamPlan\(department\)/);
  assert.match(strategy, /\{plan\.eyebrow\}/);
  assert.match(strategy, /\{plan\.trueNorth\[0\]\}/);
  assert.match(strategy, /plan\.objectives\.map/);
  assert.match(strategy, /plan\.keyResults\.map/);
  assert.match(strategy, /plan\.safetyRows\.map/);
});

test("strategy navigation exposes Overview, Safety, Quality, Delivery and 5S", () => {
  assert.match(strategy, /\["Overview", "Safety", "Quality", "Delivery", "5S"\]/);
  assert.match(navigation, /label: "Quality"[^\n]+href: "\/strategy\?view=Quality"/);
  assert.match(navigation, /label: "Delivery"[^\n]+href: "\/strategy\?view=Delivery"/);
  assert.match(strategy, /view === "Safety"/);
  assert.match(strategy, /view === "Quality"/);
  assert.match(strategy, /view === "Delivery"/);
  assert.match(strategy, /view === "5S"/);
  assert.match(strategy, /\{plan\.team\} 5S/);
  assert.match(strategy, /<FiveSWorkspace department=\{department\}/);
  assert.match(fiveSWorkspace, /department !== "Printers"/);
});

test("legacy strategy links continue to open the renamed views", () => {
  assert.match(strategy, /"X-matrix": "Safety"/);
  assert.match(strategy, /Initiatives: "Quality"/);
  assert.match(strategy, /Reviews: "Delivery"/);
});
