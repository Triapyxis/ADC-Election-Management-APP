import test from "node:test"; import assert from "node:assert/strict";
import { createCoalescer, CHANNEL, EVENT } from "../lib/realtime.ts";
function clock() { let t = 0, q = []; return { now: () => t, set: (f, ms) => (q.push({ at: t + ms, f }), q.length), clear: () => { q = []; }, adv(ms) { t += ms; const due = q.filter((x) => x.at <= t); q = q.filter((x) => x.at > t); due.forEach((x) => x.f()); } }; }
test("first trigger runs immediately", () => { const c = clock(); let n = 0; createCoalescer(() => n++, 3000, c.now, c.set, c.clear).trigger(); assert.equal(n, 1); });
test("a burst inside the gap collapses to ONE trailing call", () => {
  const c = clock(); let n = 0; const co = createCoalescer(() => n++, 3000, c.now, c.set, c.clear);
  co.trigger(); c.adv(100); co.trigger(); co.trigger(); co.trigger(); assert.equal(n, 1); c.adv(2900); assert.equal(n, 2); c.adv(10_000); assert.equal(n, 2);
});
test("after the gap, the next trigger is immediate again", () => {
  const c = clock(); let n = 0; const co = createCoalescer(() => n++, 3000, c.now, c.set, c.clear); co.trigger(); c.adv(3001); co.trigger(); assert.equal(n, 2);
});
test("cancel drops a pending trailing call", () => {
  const c = clock(); let n = 0; const co = createCoalescer(() => n++, 3000, c.now, c.set, c.clear); co.trigger(); co.trigger(); co.cancel(); c.adv(5000); assert.equal(n, 1);
});
test("channel constants are stable", () => assert.deepEqual([CHANNEL, EVENT], ["public-results", "changed"]));
