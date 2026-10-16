import test from "node:test";
import assert from "node:assert/strict";
import { mergeTicker, backoffMs, linkState } from "../lib/ticker.ts";
const t = (id, votes, leader = "APC") => ({ id, label: id, leader, votes, reportedAt: null });

test("existing items update in place; order is preserved", () => {
  const out = mergeTicker([t("lagos", 1), t("kano", 2)], [t("kano", 5, "NNPP"), t("lagos", 9)]);
  assert.deepEqual(out.map((i) => i.id), ["lagos", "kano"]);
  assert.deepEqual([out[0].votes, out[1].votes, out[1].leader], [9, 5, "NNPP"]);
});
test("new items append at the end, never in front", () => {
  assert.deepEqual(mergeTicker([t("a", 1)], [t("b", 1), t("a", 2)]).map((i) => i.id), ["a", "b"]);
});
test("duplicates collapse; ineligible (absent) items are removed", () => {
  const out = mergeTicker([t("a", 1), t("b", 1)], [t("a", 1), t("a", 3)]);
  assert.deepEqual(out.map((i) => [i.id, i.votes]), [["a", 3]]);
});
test("malformed or negative entries are never shown; zero is a legitimate value", () => {
  const out = mergeTicker([], [t("a", -1), t("b", NaN), t("", 4), t("c", 0)]);
  assert.deepEqual(out.map((i) => i.id), ["c"]);
});
test("empty incoming clears the list (nothing public to show)", () => assert.deepEqual(mergeTicker([t("a", 1)], []), []));
test("backoff grows, is capped at 30 s, and has jitter bounds", () => {
  assert.equal(backoffMs(0, () => 1), 1000); assert.equal(backoffMs(0, () => 0), 500);
  assert.ok(backoffMs(2, () => 1) > backoffMs(1, () => 1));
  assert.equal(backoffMs(20, () => 1), 30_000);
});
test("link state", () => {
  assert.equal(linkState(0, true), "live"); assert.equal(linkState(1, true), "reconnecting");
  assert.equal(linkState(3, true), "polling"); assert.equal(linkState(0, false), "offline");
});
