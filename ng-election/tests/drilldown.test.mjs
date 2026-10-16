import test from "node:test"; import assert from "node:assert/strict";
import { progressLabel, UUID } from "../lib/area.ts";
test("progress label: normal, none expected, none reporting", () => {
  assert.equal(progressLabel(1, 4), "1 of 4 reporting (25.0%)");
  assert.equal(progressLabel(0, 0), "No polling units");
  assert.equal(progressLabel(0, 10), "0 of 10 reporting (0.0%)");
});
test("uuid guard accepts uuids, rejects injection-ish input", () => {
  assert.ok(UUID.test("123e4567-e89b-12d3-a456-426614174000")); assert.ok(!UUID.test("x' or 1=1"));
});
