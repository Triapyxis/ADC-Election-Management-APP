import test from "node:test"; import assert from "node:assert/strict";
import { validateLocation } from "../lib/location.ts";
import { parse } from "../scripts/providers/nominatim.mjs";
const U = "123e4567-e89b-12d3-a456-426614174000";
test("verify needs in-Nigeria coords and a real note", () => {
  assert.deepEqual(validateLocation({ pollingUnitId: U, status: "verified", latitude: "6.5244", longitude: 3.3792, note: "Checked on satellite imagery" }), []);
  assert.match(validateLocation({ pollingUnitId: U, status: "verified", latitude: 3.4, longitude: 6.5, note: "Checked on imagery" }).join(), /outside Nigeria/);
  assert.ok(validateLocation({ pollingUnitId: U, status: "verified", latitude: "", longitude: "", note: "Checked on imagery" }).length);
  assert.ok(validateLocation({ pollingUnitId: U, status: "verified", latitude: 6.5, longitude: 3.4, note: "ok" }).length);
});
test("flagging for manual correction needs no coordinates but needs a note; no auto 'verified' via other statuses", () => {
  assert.deepEqual(validateLocation({ pollingUnitId: U, status: "needs_manual_correction", note: "Point is in the wrong ward" }), []);
  assert.ok(validateLocation({ pollingUnitId: U, status: "geocoded_unverified", note: "Checked on imagery" }).length);
});
test("nominatim parse: precise vs town-level vs none; no coordinates are ever invented", () => {
  assert.equal(parse([{ lat: "6.5", lon: "3.4", place_rank: 30 }]).confidence, 0.8);
  assert.equal(parse([{ lat: "6.5", lon: "3.4", place_rank: 22 }]).confidence, 0.45);
  assert.equal(parse([{ lat: "6.5", lon: "3.4", place_rank: 8 }]).confidence, 0.2);
  assert.equal(parse([]), null); assert.equal(parse([{ lat: "x", lon: "y" }]), null); assert.equal(parse(null), null);
});
