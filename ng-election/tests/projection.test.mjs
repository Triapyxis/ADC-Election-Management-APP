import test from "node:test"; import assert from "node:assert/strict";
import { project, ASSUMPTIONS } from "../lib/projection.ts";
const S = (name, expected, reporting, votes) => ({ stateId: name, name, expected, reporting, votes });
test("scales verified votes by expected/reporting", () => {
  const r = project([S("A", 1000, 100, { x: 600, y: 400 })]);
  assert.equal(r.status, "ok"); assert.deepEqual(r.projectedVotes, { x: 6000, y: 4000 }); assert.deepEqual(r.projectedShares, { x: 60, y: 40 });
});
test("states below thresholds are EXCLUDED, not guessed", () => {
  const r = project([S("Big", 1000, 100, { x: 1 }), S("Tiny", 1000, 20, { x: 999 }), S("Thin", 100000, 500, { x: 999 }), S("None", 500, 0, {}), S("Zero", 0, 0, {})]);
  assert.deepEqual(r.included, ["Big"]); assert.equal(r.excluded.length, 4);
  assert.match(r.excluded.find((e) => e.name === "Tiny").reason, /fewer than 30/); assert.match(r.excluded.find((e) => e.name === "Thin").reason, /under 10%/);
});
test("insufficient data returns NO numbers", () => {
  const r = project([S("A", 1000, 5, { x: 5 }), S("B", 1000, 0, {})]);
  assert.equal(r.status, "insufficient_data"); assert.equal("projectedVotes" in r, false); assert.equal("projectedShares" in r, false);
  assert.equal(project([]).status, "insufficient_data");
});
test("combines states; shares sum to ~100; coverage reported honestly", () => {
  const r = project([S("A", 1000, 100, { x: 50, y: 50 }), S("B", 2000, 400, { x: 100, y: 300 }), S("C", 900, 10, { x: 9 })]);
  assert.equal(r.status, "ok"); assert.equal(r.coverage.statesIncluded, 2); assert.equal(r.coverage.statesTotal, 3);
  assert.ok(Math.abs(Object.values(r.projectedShares).reduce((a, b) => a + b, 0) - 100) < 0.2);
});
test("inputs are not mutated; assumptions are stated in plain language", () => {
  const input = [S("A", 1000, 100, { x: 10 })], copy = JSON.stringify(input); project(input); assert.equal(JSON.stringify(input), copy);
  assert.ok(ASSUMPTIONS.some((a) => /representative/.test(a)) && ASSUMPTIONS.some((a) => /margin of error/.test(a)));
});
