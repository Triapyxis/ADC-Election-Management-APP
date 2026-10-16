import test from "node:test"; import assert from "node:assert/strict";
import { createFeedCache, createToucher } from "../lib/feed-cache.ts";
const clock = () => { let t = 1000; return { now: () => t, adv: (ms) => (t += ms) }; };
test("within the TTL the loader is not called again", async () => {
  const c = clock(), cache = createFeedCache({ ttlMs: 3000, now: c.now }); let n = 0; const load = async () => ++n;
  assert.equal((await cache.get(load)).value, 1); c.adv(2999); const r = await cache.get(load); assert.deepEqual([r.value, n, r.stale], [1, 1, false]);
  c.adv(2); assert.equal((await cache.get(load)).value, 2);
});
test("many simultaneous callers share ONE load (a stampede of laptops costs one query set)", async () => {
  const c = clock(), cache = createFeedCache({ now: c.now }); let n = 0; const load = () => new Promise((r) => setTimeout(() => r(++n), 20));
  const all = await Promise.all(Array.from({ length: 50 }, () => cache.get(load))); assert.equal(n, 1); assert.ok(all.every((x) => x.value === 1));
});
test("a failed load serves the previous value flagged stale, up to the stale limit; then it errors", async () => {
  const c = clock(), cache = createFeedCache({ ttlMs: 1000, maxStaleMs: 60000, now: c.now }); await cache.get(async () => "good");
  c.adv(5000); const r = await cache.get(async () => { throw new Error("db down"); }); assert.deepEqual([r.value, r.stale], ["good", true]);
  c.adv(70000); await assert.rejects(cache.get(async () => { throw new Error("db down"); }), /db down/);
});
test("with no previous value an error propagates, and the error is not cached", async () => {
  const c = clock(), cache = createFeedCache({ now: c.now }); await assert.rejects(cache.get(async () => { throw new Error("x"); }));
  assert.equal((await cache.get(async () => "ok")).value, "ok");
});
test("toucher allows one write per gap per id", () => {
  const c = clock(), t = createToucher(60000, c.now); assert.equal(t("a"), true); assert.equal(t("a"), false); assert.equal(t("b"), true); c.adv(60001); assert.equal(t("a"), true);
});
