import test from "node:test"; import assert from "node:assert/strict";
import { appsForRoles, linksForRoles } from "../lib/nav.ts";
const hrefs = (r) => appsForRoles(r).map((a) => a.href);
test("public tracker is always listed; nothing else without a role", () => assert.deepEqual(hrefs([]), ["/"]));
test("agent sees only the agent app", () => assert.deepEqual(hrefs(["field_agent"]), ["/", "/agent"]));
test("verifier and supervisor see admin only; super admin sees admin", () => {
  assert.deepEqual(hrefs(["verifier"]), ["/", "/admin"]); assert.deepEqual(hrefs(["supervisor"]), ["/", "/admin"]); assert.deepEqual(hrefs(["super_admin"]), ["/", "/admin"]); assert.ok(!hrefs(["super_admin"]).includes("/room"));
});
test("admin modules follow the role; only super admin gets Users", () => {
  assert.ok(linksForRoles(["super_admin"]).some((l) => l.href === "/admin/users")); assert.ok(!linksForRoles(["election_admin"]).some((l) => l.href === "/admin/users"));
  assert.deepEqual(linksForRoles(["verifier"]).map((l) => l.href), ["/admin/verify"]); assert.deepEqual(linksForRoles(["field_agent"]), []);
  const m = linksForRoles(["supervisor", "lga_coordinator"]).map((l) => l.href); assert.equal(new Set(m).size, m.length);
});
