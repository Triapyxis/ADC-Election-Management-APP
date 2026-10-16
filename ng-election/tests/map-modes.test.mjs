import test from "node:test"; import assert from "node:assert/strict";
import { shade, leadingByState, NEUTRAL, MODES } from "../lib/map-modes.ts";
test("shade: unknown or zero expected is neutral, never a low-reporting shade", () => {
  assert.equal(shade(null, 10), NEUTRAL); assert.equal(shade(5, 0), NEUTRAL); assert.equal(shade(null, null), NEUTRAL);
});
test("shade darkens as reporting grows and clamps at 100%", () => {
  const sum = (c) => c.match(/\d+/g).map(Number).reduce((a, b) => a + b);
  assert.ok(sum(shade(0, 10)) > sum(shade(5, 10))); assert.ok(sum(shade(5, 10)) > sum(shade(10, 10))); assert.equal(shade(20, 10), shade(10, 10));
});
test("leadingByState: most contests led wins the state", () => {
  const r = leadingByState([{ stateKey: "lagos", party: "A", colour: "#111111", margin: 5 }, { stateKey: "lagos", party: "A", colour: "#111111", margin: 2 }, { stateKey: "lagos", party: "B", colour: null, margin: 9 }]);
  assert.deepEqual([r.lagos.party, r.lagos.seats], ["A", 2]);
});
test("dead heat between parties and all-tied contests stay neutral (absent)", () => {
  const r = leadingByState([{ stateKey: "kano", party: "A", colour: null, margin: 1 }, { stateKey: "kano", party: "B", colour: null, margin: 1 }, { stateKey: "ogun", party: "A", colour: null, margin: 0 }]);
  assert.deepEqual(Object.keys(r), []);
});
test("five modes", () => assert.equal(MODES.length, 5));
