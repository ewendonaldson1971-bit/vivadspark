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
  assert.match(coaching.summary, /62%/);
  assert.equal(validateStrategyCoaching(coaching), true);
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
  assert.match(page, /STRATEGY_COACHING_KEY/);
  assert.match(route, /process\.env\.OPENAI_API_KEY/);
  assert.match(route, /strategyCoachingJsonSchema/);
  assert.match(route, /buildStrategyCoaching/);
  assert.match(route, /store: false/);
});
