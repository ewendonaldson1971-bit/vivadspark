import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const matrix = readFileSync(new URL("../app/vivadocs/skills-matrix.tsx", import.meta.url), "utf8");

test("the watched matrix includes every current Training Academy video", () => {
  assert.match(matrix, /trainingVideos\.forEach\(\(video\) => videos\.set/);
  assert.doesNotMatch(matrix, /trainingVideos\.filter/);
  assert.match(matrix, /every video currently available in the Training Academy/);
});

test("historical completed videos remain represented in the matrix", () => {
  assert.match(matrix, /videoCompletions\.forEach\(\(record\) =>/);
  assert.match(matrix, /if \(!videos\.has\(record\.videoUid\)\) videos\.set/);
  assert.match(matrix, /videoCompletionsByCell/);
});

test("the department selection still scopes the displayed team members", () => {
  assert.match(matrix, /people\.filter\(\(person\) => person\.department === department\)/);
  assert.match(matrix, /aria-label="Select department"/);
});
