import test from "node:test"; import assert from "node:assert/strict";
import { seatsLed, CONTEST_TYPES } from "../lib/seats.ts";
test("seats led are counted by party and sorted", () => {
  const r = seatsLed([{ party: "A", colour: null, margin: 5 }, { party: "B", colour: null, margin: 1 }, { party: "A", colour: null, margin: 9 }]);
  assert.deepEqual(r.parties.map((p) => [p.party, p.seats]), [["A", 2], ["B", 1]]); assert.equal(r.tied, 0);
});
test("a tie leads for nobody and is counted separately", () => {
  const r = seatsLed([{ party: "A", colour: null, margin: 0 }, { party: "B", colour: null, margin: 3 }]);
  assert.deepEqual([r.parties.length, r.parties[0].party, r.tied], [1, "B", 1]);
});
test("no results -> empty, not fabricated", () => assert.deepEqual(seatsLed([]), { parties: [], tied: 0 }));
test("covers all five contest types in the brief", () => assert.equal(CONTEST_TYPES.length, 5));
