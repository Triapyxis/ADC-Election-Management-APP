export type NavLink = { href: string; label: string };
const L = (href: string, label: string): NavLink => ({ href, label });
export const ADMIN_ROLES = ["super_admin", "election_admin", "state_admin", "lga_coordinator", "supervisor", "verifier"];
const ADMIN_MODULES: Record<string, NavLink[]> = {
  super_admin: [L("/admin/users", "Users and access"), L("/admin/setup", "Election setup"), L("/admin/declarations", "Official declarations"), L("/admin/projections", "Projections"), L("/admin/stations", "Situation-room stations"), L("/admin/locations", "Polling-unit locations"), L("/admin/geofence", "Geofence dashboard"), L("/admin/agents", "Field agents"), L("/admin/assignments", "Assignments")],
  election_admin: [L("/admin/setup", "Election setup"), L("/admin/declarations", "Official declarations"), L("/admin/projections", "Projections"), L("/admin/stations", "Situation-room stations"), L("/admin/locations", "Polling-unit locations"), L("/admin/geofence", "Geofence dashboard"), L("/admin/agents", "Field agents"), L("/admin/assignments", "Assignments")],
  state_admin: [L("/admin/locations", "Polling-unit locations"), L("/admin/geofence", "Geofence dashboard"), L("/admin/agents", "Field agents"), L("/admin/assignments", "Assignments")],
  lga_coordinator: [L("/admin/geofence", "Geofence dashboard"), L("/admin/agents", "Field agents"), L("/admin/assignments", "Assignments")],
  supervisor: [L("/admin/geofence", "Geofence dashboard"), L("/admin/agents", "Field agents"), L("/admin/assignments", "Assignments")],
  verifier: [L("/admin/verify", "Verify results")],
};
const dedupe = (ls: NavLink[]) => { const seen = new Set<string>(); return ls.filter((l) => !seen.has(l.href) && !!seen.add(l.href)); };
/** Modules inside the ADMIN app for these roles. Navigation only: the server and database still enforce access. */
export const linksForRoles = (roles: string[]): NavLink[] => dedupe(roles.flatMap((r) => ADMIN_MODULES[r] ?? []));
/** The web apps a person may open (the situation room is a separate laptop app and is not listed here). */
export function appsForRoles(roles: string[]): (NavLink & { desc: string })[] {
  const a = [{ href: "/", label: "Public result tracker", desc: "Verified results and official declarations. Open to everyone." }];
  if (roles.includes("field_agent")) a.push({ href: "/agent", label: "Agent app", desc: "Submit polling-unit results and location checks." });
  if (roles.some((r) => ADMIN_ROLES.includes(r))) a.push({ href: "/admin", label: "Admin", desc: "Coordinates users, setup, verification, agents and projections." });
  return a;
}
