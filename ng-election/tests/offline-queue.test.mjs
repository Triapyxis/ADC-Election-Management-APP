import test from "node:test"; import assert from "node:assert/strict";
import { enqueue, flush } from "../lib/offline-queue.ts";
const mk = (...keys) => keys.reduce((q, k) => enqueue(q, k, { k }), []);

test("enqueue is idempotent and starts as pending_server_validation", () => {
  const q = enqueue(mk("a"), "a", { other: 1 }); assert.equal(q.length, 1); assert.equal(q[0].state, "pending_server_validation");
});
test("success drops item; order preserved", async () => {
  const seen = []; const { queue, sent } = await flush(mk("a", "b"), async (_, k) => (seen.push(k), { status: 201 }));
  assert.deepEqual([seen, sent, queue.length], [["a", "b"], ["a", "b"], 0]);
});
test("network error keeps item and halts (no data loss, no hammering)", async () => {
  let calls = 0; const { queue } = await flush(mk("a", "b"), async () => { calls++; throw new Error("offline"); });
  assert.deepEqual([queue.length, calls, queue[0].state], [2, 1, "pending_server_validation"]);
});
test("5xx and 401 keep pending and halt", async () => {
  for (const status of [500, 503, 401]) { let calls = 0; const { queue } = await flush(mk("a", "b"), async () => (calls++, { status })); assert.deepEqual([queue.length, calls], [2, 1]); }
});
test("422/403 -> needs_attention with the error, not retried, later items still sent", async () => {
  const r1 = await flush(mk("a", "b"), async (_, k) => k === "a" ? { status: 422, error: "Missing votes" } : { status: 201 });
  assert.deepEqual([r1.queue.length, r1.queue[0].state, r1.queue[0].error, r1.sent], [1, "needs_attention", "Missing votes", ["b"]]);
  let calls = 0; await flush(r1.queue, async () => (calls++, { status: 201 })); assert.equal(calls, 0);
});
