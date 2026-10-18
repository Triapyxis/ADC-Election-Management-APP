import test from "node:test"; import assert from "node:assert/strict";
import { validateNewUser, validateRoleGrant, genTempPassword, ROLES } from "../lib/users.ts";
const U = "123e4567-e89b-12d3-a456-426614174000";
test("scoped roles need a state; national roles must not have one", () => {
  assert.deepEqual(validateRoleGrant({ role: "supervisor", stateId: U }), []); assert.ok(validateRoleGrant({ role: "supervisor" }).length);
  assert.deepEqual(validateRoleGrant({ role: "super_admin" }), []); assert.ok(validateRoleGrant({ role: "election_admin", stateId: U }).length); assert.ok(validateRoleGrant({ role: "boss", stateId: U }).length);
});
test("LGA coordinator needs an LGA; an LGA needs a state", () => {
  assert.ok(validateRoleGrant({ role: "lga_coordinator", stateId: U }).length); assert.deepEqual(validateRoleGrant({ role: "lga_coordinator", stateId: U, lgaId: U }), []); assert.ok(validateRoleGrant({ role: "verifier", lgaId: U }).length);
});
test("new user rules; password optional (generated)", () => {
  assert.deepEqual(validateNewUser({ email: "a@b.ng", role: "super_admin" }), []); assert.ok(validateNewUser({ email: "nope", role: "super_admin" }).length);
  assert.ok(validateNewUser({ email: "a@b.ng", password: "short", role: "super_admin" }).length); assert.ok(validateNewUser({ email: "a@b.ng", password: "x".repeat(73), role: "super_admin" }).length);
  assert.deepEqual(validateNewUser({ email: "a@b.ng", password: "a-long-enough-pass", role: "super_admin" }), []);
});
test("temp password: length, no look-alikes, differs", () => {
  const a = genTempPassword(), b = genTempPassword(); assert.equal(a.length, 16); assert.ok(!/[0O1lI]/.test(a + b)); assert.notEqual(a, b); assert.equal(ROLES.length, 8); assert.deepEqual(validateRoleGrant({ role: "station_system_admin" }), []);
});
