import test from "node:test"; import assert from "node:assert/strict";
import { validateSetup, validateDeclaration } from "../lib/setup.ts";
const U = "123e4567-e89b-12d3-a456-426614174000";
test("election", () => {
  assert.deepEqual(validateSetup("election", { name: "N", electionDate: "2027-02-20", status: "upcoming" }), []);
  assert.ok(validateSetup("election", { name: "N", electionDate: "2027-13-45", status: "upcoming" }).length);
  assert.ok(validateSetup("election", { name: "N", electionDate: "2027-02-20", status: "won" }).length);
});
test("party: abbreviation, colour and https logo rules", () => {
  assert.deepEqual(validateSetup("party", { abbreviation: "APC", name: "X", brandColour: "#0b6b3a", logoUrl: "https://a.ng/l.png" }), []);
  assert.ok(validateSetup("party", { abbreviation: "apc", name: "X" }).length);
  assert.ok(validateSetup("party", { abbreviation: "APC", name: "X", brandColour: "green" }).length);
  assert.ok(validateSetup("party", { abbreviation: "APC", name: "X", logoUrl: "http://a.ng/l.png" }).length);
});
test("contest: type required; at most one area", () => {
  assert.deepEqual(validateSetup("contest", { electionId: U, type: "senatorial", name: "Kano North", senatorialDistrictId: U }), []);
  assert.ok(validateSetup("contest", { electionId: U, type: "senatorial", name: "x", stateId: U, senatorialDistrictId: U }).length);
  assert.ok(validateSetup("contest", { electionId: U, type: "mayor", name: "x" }).length);
});
test("candidate needs ids and name; photo must be https", () => {
  assert.deepEqual(validateSetup("candidate", { contestId: U, partyId: U, fullName: "A B" }), []);
  assert.ok(validateSetup("candidate", { contestId: "x", partyId: U, fullName: "A" }).length);
  assert.ok(validateSetup("candidate", { contestId: U, partyId: U, fullName: "A", photoUrl: "javascript:alert(1)" }).length);
});
test("declaration needs ids and a real source reference", () => {
  assert.deepEqual(validateDeclaration({ contestId: U, candidateId: U, sourceReference: "INEC notice EC8E/2027/001" }), []);
  assert.ok(validateDeclaration({ contestId: U, candidateId: U, sourceReference: "ok" }).length);
});
