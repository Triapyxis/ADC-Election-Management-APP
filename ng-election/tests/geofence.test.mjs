import test from "node:test";
import assert from "node:assert/strict";
import { evaluateGeofence, haversineM, impliedSpeedKmh } from "../lib/geofence.ts";

const PU = { lat: 6.5244, lon: 3.3792, geocodeStatus: "verified" };
const now = new Date("2026-10-10T10:00:00Z");
const ev = (o = {}) => ({ lat: 6.5244, lon: 3.3792, accuracyM: 10, locationTime: new Date(now - 5000), receivedAt: now, ...o });
const east = (m) => ({ lon: 3.3792 + m / (111_320 * Math.cos((6.5244 * Math.PI) / 180)) }); // metres due east

test("haversine: 1 degree latitude is ~111.2 km", () => assert.ok(Math.abs(haversineM(0, 0, 1, 0) - 111_195) < 200));
test("at the unit -> within radius", () => assert.equal(evaluateGeofence(ev(), PU).outcome, "within_radius"));
test("199 m within, 201 m outside (200 m rule)", () => {
  assert.equal(evaluateGeofence(ev(east(199)), PU).outcome, "within_radius");
  assert.equal(evaluateGeofence(ev(east(201)), PU).outcome, "outside_radius");
});
test("accuracy 50 m accepted, 51 m rejected as poor_accuracy (even if far away)", () => {
  assert.equal(evaluateGeofence(ev({ accuracyM: 50 }), PU).outcome, "within_radius");
  assert.equal(evaluateGeofence(ev({ accuracyM: 51 }), PU).outcome, "poor_accuracy");
  assert.equal(evaluateGeofence(ev({ accuracyM: 51, ...east(5000) }), PU).outcome, "poor_accuracy");
});
test("missing/denied GPS", () => {
  assert.equal(evaluateGeofence(ev({ lat: null, lon: null }), PU).outcome, "gps_missing");
  assert.equal(evaluateGeofence(ev({ accuracyM: null }), PU).outcome, "gps_missing");
  assert.equal(evaluateGeofence(ev({ lat: NaN }), PU).outcome, "gps_missing");
});
test("stale and future-dated evidence", () => {
  assert.equal(evaluateGeofence(ev({ locationTime: new Date(now - 121_000) }), PU).outcome, "stale_location");
  assert.equal(evaluateGeofence(ev({ locationTime: new Date(+now + 120_000) }), PU).outcome, "stale_location");
});
test("unverified or missing PU coordinates are NOT ready and never pass", () => {
  const u = evaluateGeofence(ev(), { ...PU, geocodeStatus: "geocoded_unverified" });
  assert.deepEqual([u.outcome, u.geofenceReady], ["pu_coordinates_unverified", false]);
  assert.equal(evaluateGeofence(ev(), { lat: null, lon: null, geocodeStatus: "pending" }).outcome, "pu_coordinates_missing");
});
test("a client-supplied distance/inside flag is ignored", () => {
  const r = evaluateGeofence({ ...ev(east(900)), distanceM: 1, inside: true }, PU);
  assert.equal(r.outcome, "outside_radius"); assert.ok(r.distanceM > 800);
});
test("implied speed flags implausible travel", () => {
  const s = impliedSpeedKmh({ lat: 6.52, lon: 3.38, at: new Date("2026-10-10T10:00:00Z") }, { lat: 9.07, lon: 7.4, at: new Date("2026-10-10T10:10:00Z") });
  assert.ok(s > 1000);
});
