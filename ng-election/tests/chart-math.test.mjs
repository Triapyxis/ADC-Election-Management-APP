import test from "node:test"; import assert from "node:assert/strict";
import { shares, arcs } from "../lib/chart-math.ts";
test("shares: unreported is null, not zero; percentages use counted total", () => {
  const s = shares([{ id: "a", votes: 75 }, { id: "b", votes: 25 }, { id: "c", votes: null }]);
  assert.deepEqual(s.rows.map((r) => r.pct), [75, 25, null]); assert.equal(s.total, 100);
});
test("shares: nothing counted -> no percentages (no divide by zero)", () => {
  assert.deepEqual(shares([{ id: "a", votes: 0 }, { id: "b", votes: null }]).rows.map((r) => r.pct), [null, null]);
});
test("a real zero beside counted votes is 0%, distinct from missing", () => {
  assert.deepEqual(shares([{ id: "a", votes: 10 }, { id: "b", votes: 0 }, { id: "c", votes: null }]).rows.map((r) => r.pct), [100, 0, null]);
});
test("arcs: segments sum to the circumference; zero/missing omitted; offsets accumulate", () => {
  const a = arcs([60, 40, 0, null]), C = 2 * Math.PI * 40;
  assert.equal(a[2], null); assert.equal(a[3], null);
  assert.ok(Math.abs(a[0].dash + a[1].dash - C) < 1e-9); assert.ok(Math.abs(a[1].offset + a[0].dash) < 1e-9);
});
