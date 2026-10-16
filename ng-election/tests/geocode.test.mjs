import test from "node:test";
import assert from "node:assert/strict";
import { classify, runBatch, estimate, toUpdate, buildQuery } from "../scripts/lib/geocode.mjs";

const U = (id, o = {}) => ({ id, name: "Kajola Market I", ward: "Ward A", lga: "Ibeju", state: "Lagos", geocodeStatus: "pending", ...o });
const ok = { lat: 6.5, lon: 3.4, confidence: 0.9 };
const noSleep = async () => {};

test("classify: good, low confidence, no result, outside Nigeria", () => {
  assert.equal(classify(ok).outcome, "geocoded_unverified");
  assert.equal(classify({ ...ok, confidence: 0.2 }).outcome, "low_confidence");
  assert.equal(classify(null).outcome, "failed");
  assert.equal(classify({ lat: 51.5, lon: -0.1, confidence: 1 }).reason, "outside_nigeria");
  assert.equal(classify({ lat: NaN, lon: 3, confidence: 1 }).outcome, "failed");
});
test("never produces 'verified'", () => {
  for (const r of [ok, { ...ok, confidence: 1 }]) assert.notEqual(classify(r).outcome, "verified");
});
test("conflicting with existing coordinates is flagged, existing kept", () => {
  const r = classify(ok, { lat: 7.5, lon: 3.4 });
  assert.equal(r.outcome, "conflicting");
  assert.deepEqual(toUpdate({ outcome: "conflicting", lat: 6.5, lon: 3.4 }), { geocode_status: "conflicting" });
});
test("failed result writes no coordinates", () => assert.deepEqual(toUpdate({ outcome: "failed" }), { geocode_status: "failed" }));
test("verified units are skipped; done ids are skipped (resumable)", async () => {
  let calls = 0; const provider = async () => (calls++, ok);
  const { results } = await runBatch({ units: [U(1, { geocodeStatus: "verified" }), U(2, { name: "B" }), U(3, { name: "C" })], provider, providerName: "mock", sleep: noSleep, done: new Set([3]) });
  assert.deepEqual(results.map((r) => r.unitId), [2]); assert.equal(calls, 1);
});
test("cache avoids repeat provider calls for identical queries", async () => {
  let calls = 0; const provider = async () => (calls++, ok);
  const { stats } = await runBatch({ units: [U(1), U(2)], provider, providerName: "mock", sleep: noSleep });
  assert.deepEqual([calls, stats.cacheHits], [1, 1]);
});
test("provider error is recorded as retryable failure, run continues", async () => {
  const provider = async (q) => { if (q.startsWith("Bad")) throw new Error("429"); return ok; };
  const { results } = await runBatch({ units: [U(1, { name: "Bad" }), U(2, { name: "Good" })], provider, providerName: "mock", sleep: noSleep });
  assert.equal(results[0].outcome, "failed"); assert.match(results[0].reason, /429/); assert.equal(results[1].outcome, "geocoded_unverified");
});
test("rate limit: sleeps between uncached calls", async () => {
  const waits = []; const provider = async () => ok;
  await runBatch({ units: [U(1, { name: "A" }), U(2, { name: "B" })], provider, providerName: "m", minGapMs: 500, sleep: async (ms) => waits.push(ms) });
  assert.equal(waits.length, 1); assert.ok(waits[0] > 0 && waits[0] <= 500);
});
test("limit caps a trial run", async () => {
  const { results } = await runBatch({ units: [1, 2, 3, 4].map((i) => U(i, { name: "N" + i })), provider: async () => ok, providerName: "m", sleep: noSleep, limit: 2 });
  assert.equal(results.length, 2);
});
test("estimate and query", () => {
  assert.deepEqual(estimate({ units: 176846, pricePer1000: 5, rps: 10 }), { calls: 176846, costUsd: 884.23, hours: 4.9 });
  assert.equal(buildQuery(U(1)), "Kajola Market I, Ward A, Ibeju, Lagos, Nigeria");
});
