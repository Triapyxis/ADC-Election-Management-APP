import test from "node:test"; import assert from "node:assert/strict";
import { generateKey, hashKey, parseBearer, validateLabel } from "../lib/stations.ts";
test("keys are long, prefixed, unique; hash is stable and not the key", () => {
  const a = generateKey(), b = generateKey(); assert.match(a, /^sr_[A-Za-z0-9_-]{43}$/); assert.notEqual(a, b);
  assert.equal(hashKey(a), hashKey(a)); assert.notEqual(hashKey(a), a); assert.match(hashKey(a), /^[0-9a-f]{64}$/);
});
test("bearer parsing accepts only a well-formed station key", () => {
  const k = generateKey(); assert.equal(parseBearer(`Bearer ${k}`), k);
  for (const h of [null, undefined, "", k, `Basic ${k}`, "Bearer sr_short", `Bearer ${k}x`, `Bearer ${k.slice(1)}`]) assert.equal(parseBearer(h), null, String(h));
});
test("label", () => { assert.deepEqual(validateLabel("Studio laptop 1"), []); assert.ok(validateLabel("a").length); assert.ok(validateLabel("x".repeat(61)).length); assert.ok(validateLabel(undefined).length); });
