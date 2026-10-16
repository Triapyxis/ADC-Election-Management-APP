import test from "node:test"; import assert from "node:assert/strict";
import { dutyStatus, agoLabel } from "../lib/roster.ts";
const now = new Date("2026-10-10T10:00:00Z"), ago = (m) => new Date(+now - m * 60_000).toISOString();
test("duty status", () => {
  assert.equal(dutyStatus(0, ago(1), now), "no_assignment");
  assert.equal(dutyStatus(1, null, now), "never_checked");
  assert.equal(dutyStatus(2, ago(20), now), "on_duty");
  assert.equal(dutyStatus(1, ago(21), now), "overdue");
});
test("ago label", () => {
  assert.deepEqual([agoLabel(null, now), agoLabel(ago(0), now), agoLabel(ago(12), now), agoLabel(ago(120), now), agoLabel(ago(3000), now)], ["Never", "Just now", "12 min ago", "2 h ago", "2 d ago"]);
});
