import test from "node:test"; import assert from "node:assert/strict";
import { validateAssignment } from "../lib/assignment.ts";
const now = new Date("2026-10-10T08:00:00Z");
const ok = (o = {}) => ({ agentEmail: "a@x.ng", pollingUnitId: "pu", startsAt: "2026-10-10T08:00:00Z", expiresAt: "2026-10-11T08:00:00Z", ...o });
test("valid", () => assert.deepEqual(validateAssignment(ok(), now), []));
test("expiry before start / in the past / too long", () => {
  assert.ok(validateAssignment(ok({ expiresAt: "2026-10-10T07:00:00Z" }), now).length);
  assert.match(validateAssignment(ok({ startsAt: "2026-10-01T00:00:00Z", expiresAt: "2026-10-02T00:00:00Z" }), now).join(), /past/);
  assert.match(validateAssignment(ok({ expiresAt: "2026-11-30T00:00:00Z" }), now).join(), /longer than 14/);
});
test("bad email, missing unit, bad dates", () => {
  assert.ok(validateAssignment(ok({ agentEmail: "nope" }), now).length);
  assert.ok(validateAssignment(ok({ pollingUnitId: "" }), now).length);
  assert.match(validateAssignment(ok({ startsAt: "x" }), now).join(), /required/);
});
