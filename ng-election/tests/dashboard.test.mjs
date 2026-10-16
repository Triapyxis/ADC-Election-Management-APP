import test from "node:test"; import assert from "node:assert/strict";
import { totals, onDuty, riskFlags, countByOutcome } from "../lib/dashboard.ts";
const T = (o) => ({ id: "c", agentId: "a1", puId: "p1", outcome: "within_radius", trigger: "periodic", at: new Date("2026-10-10T10:00:00Z"), lat: 6.5, lon: 3.4, puLat: 6.5, puLon: 3.4, ...o });
const cov = (o) => ({ state_name: "X", total: 100, with_coordinates: 60, verified: 40, geofence_ready: 40, pending: 40, geocoded_unverified: 20, low_confidence: 0, failed: 0, conflicting: 0, needs_manual: 0, ...o });

test("totals sum states and compute shares; geofence-ready is a subset of coordinates", () => {
  const t = totals([cov(), cov({ state_name: "Y", total: 300, with_coordinates: 0, verified: 0, geofence_ready: 0, pending: 300, geocoded_unverified: 0 })]);
  assert.deepEqual([t.total, t.with_coordinates, t.pctCoordinates, t.pctReady], [400, 60, 15, 10]);
});
test("empty coverage gives zeros, not NaN", () => assert.equal(totals([]).pctReady, 0));
test("on duty = distinct agents checked within 20 minutes", () => {
  const now = new Date("2026-10-10T10:20:00Z");
  assert.equal(onDuty([T({ agentId: "a" }), T({ agentId: "a" }), T({ agentId: "b", at: new Date("2026-10-10T09:00:00Z") })], now), 1);
});
test("implausible travel flagged; ordinary movement is not", () => {
  const far = T({ id: "2", lat: 9.07, lon: 7.4, at: new Date("2026-10-10T10:10:00Z") });
  assert.equal(riskFlags([T(), far]).filter((r) => r.kind === "implausible_travel").length, 1);
  assert.equal(riskFlags([T(), T({ id: "2", lat: 6.51, lon: 3.41, at: new Date("2026-10-10T10:30:00Z") })]).length, 0);
});
test("identical reading at distant units flagged; same unit repeated is not", () => {
  const a = T({ puId: "p1", puLat: 6.5, puLon: 3.4 }), b = T({ id: "2", puId: "p2", puLat: 9.0, puLon: 7.4, at: new Date("2026-10-10T11:00:00Z") });
  assert.ok(riskFlags([a, b]).some((r) => r.kind === "identical_coordinates"));
  assert.equal(riskFlags([a, T({ id: "3", at: new Date("2026-10-10T11:00:00Z") })]).filter((r) => r.kind === "identical_coordinates").length, 0);
});
test("excess overrides flagged at the limit", () => {
  assert.equal(riskFlags([], [{ supervisorId: "s" }, { supervisorId: "s" }]).length, 0);
  assert.equal(riskFlags([], [1, 2, 3].map(() => ({ supervisorId: "s" })))[0].kind, "many_overrides");
});
test("outcome counts", () => assert.deepEqual(countByOutcome([T(), T({ outcome: "outside_radius" }), T()]), { within_radius: 2, outside_radius: 1 }));
