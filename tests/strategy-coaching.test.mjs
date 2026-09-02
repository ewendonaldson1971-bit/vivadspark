import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildStrategyCoaching, sanitiseStrategyCoachingInput, validStrategyCoachingInput, validateStrategyCoaching } from "../lib/strategy-coaching.ts";

test("daily strategy coaching prioritises the lowest supplied S/Q/D score", () => {
  const input = { department: "Despatch", safety: 81, quality: 62, delivery: 76, context: "Repeat packing defect on the afternoon shift." };
  assert.equal(validStrategyCoachingInput(input), true);
  const coaching = buildStrategyCoaching(input);
  assert.equal(coaching.focusArea, "Quality");
  assert.equal(coaching.suggestions.length, 3);
  assert.equal(coaching.factResponses.length, 1);
  assert.match(coaching.factResponses[0].recommendedAction, /inspect affected packages/i);
  assert.match(coaching.summary, /62%/);
  assert.equal(validateStrategyCoaching(coaching), true);
});

test("changed real-world blockers produce different, direct coaching", () => {
  const packaging = buildStrategyCoaching({ department: "Despatch", safety: 81, quality: 74, delivery: 76, context: "Our quality suffered because packages got damaged while being handled.\nThe delivery team has not been taking photos of deliveries." });
  const equipment = buildStrategyCoaching({ department: "Despatch", safety: 81, quality: 74, delivery: 76, context: "The wrapping machine failed twice and stopped the afternoon shift." });
  assert.equal(packaging.factResponses.length, 2);
  assert.match(packaging.factResponses[0].interpretation, /quality containment issue/i);
  assert.match(packaging.factResponses[0].recommendedAction, /observe one package through the full handling route/i);
  assert.match(packaging.factResponses[1].recommendedAction, /delivery photo mandatory/i);
  assert.match(equipment.factResponses[0].recommendedAction, /maintenance/i);
  assert.notDeepEqual(packaging.suggestions, equipment.suggestions);
});

test("strategy coaching rejects invalid percentages and sanitises bounded context", () => {
  assert.equal(validStrategyCoachingInput({ department: "CST", safety: 101, quality: 80, delivery: 80, context: "" }), false);
  const sanitised = sanitiseStrategyCoachingInput({ department: " Printers ", safety: 80.04, quality: 90.06, delivery: 70, context: "x".repeat(2200) });
  assert.equal(sanitised.department, "Printers");
  assert.deepEqual(sanitised.scores, { safety: 80, quality: 90.1, delivery: 70 });
  assert.equal(sanitised.operationalContext.length, 2000);
});

test("Momentum submits authenticated daily data and displays generated coaching", async () => {
  const [page, route] = await Promise.all([
    readFile(new URL("../app/strategy/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/strategy/coaching/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Generate tomorrow’s coaching/);
  assert.match(page, /\/api\/strategy\/coaching/);
  assert.match(page, /credentials: "same-origin"/);
  assert.match(page, /savedCoaching\.coaching\.suggestions/);
  assert.match(page, /What your facts mean/);
  assert.match(page, /Best response:/);
  assert.match(page, /STRATEGY_COACHING_KEY/);
  assert.match(route, /process\.env\.OPENAI_API_KEY/);
  assert.match(route, /strategyCoachingJsonSchema/);
  assert.match(route, /buildStrategyCoaching/);
  assert.match(route, /Extract every distinct fact or blocker/);
  assert.match(route, /store: false/);
});
