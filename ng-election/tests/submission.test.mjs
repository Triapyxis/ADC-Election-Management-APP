import test from "node:test"; import assert from "node:assert/strict";
import { validateSubmission } from "../lib/submission.ts";
const C = ["a", "b", "c"];
const ok = (o = {}) => ({ contestId: "x", pollingUnitId: "y", idempotencyKey: "k1", votes: [{ candidateId: "a", votes: 10 }, { candidateId: "b", votes: 0 }, { candidateId: "c", votes: 5 }], ...o });
const msgs = (i) => validateSubmission(i, C).map((x) => x.message).join(" | ");

test("valid submission, explicit zero accepted", () => assert.deepEqual(validateSubmission(ok(), C), []));
test("missing candidate is an error (no silent zero)", () => assert.match(msgs(ok({ votes: ok().votes.slice(0, 2) })), /Missing votes for candidate c/));
test("negative, fractional, huge, NaN counts rejected", () => {
  for (const v of [-1, 1.5, 2_000_000, NaN]) assert.match(msgs(ok({ votes: [{ candidateId: "a", votes: v }, { candidateId: "b", votes: 0 }, { candidateId: "c", votes: 0 }] })), /whole numbers/);
});
test("duplicate and foreign candidates rejected", () => {
  assert.match(msgs(ok({ votes: [...ok().votes, { candidateId: "a", votes: 1 }] })), /more than once/);
  assert.match(msgs(ok({ votes: [...ok().votes, { candidateId: "zzz", votes: 1 }] })), /not in this contest/);
});
test("totals must not exceed accredited voters", () => {
  assert.match(msgs(ok({ accredited: 14 })), /exceeds accredited/);
  assert.deepEqual(validateSubmission(ok({ accredited: 15 }), C), []);
  assert.match(msgs(ok({ accredited: 15, rejectedBallots: 1 })), /exceeds accredited/);
});
test("empty votes, missing key, bad device time", () => {
  assert.match(msgs(ok({ votes: [] })), /every candidate/);
  assert.match(msgs(ok({ idempotencyKey: "" })), /key/);
  assert.match(msgs(ok({ deviceTime: "not a date" })), /Device time/);
});
