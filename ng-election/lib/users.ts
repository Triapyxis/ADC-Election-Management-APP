export const ROLES = ["super_admin", "election_admin", "state_admin", "lga_coordinator", "supervisor", "verifier", "field_agent"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABEL: Record<Role, string> = { super_admin: "Super administrator", election_admin: "Election administrator", state_admin: "State administrator", lga_coordinator: "LGA coordinator", supervisor: "Supervisor", verifier: "Verifier", field_agent: "Field agent" };
const NATIONAL: Role[] = ["super_admin", "election_admin"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateRoleGrant(i: { role?: string; stateId?: string | null; lgaId?: string | null }): string[] {
  const o: string[] = [];
  if (!(ROLES as readonly string[]).includes(i.role ?? "")) { o.push("Choose a role."); return o; }
  const national = NATIONAL.includes(i.role as Role);
  if (!national && !UUID.test(i.stateId ?? "")) o.push("Choose the state this person will work in.");
  if (national && i.stateId) o.push("National roles are not limited to a state.");
  if (i.role === "lga_coordinator" && !UUID.test(i.lgaId ?? "")) o.push("An LGA coordinator needs an LGA.");
  if (i.lgaId && !UUID.test(i.lgaId)) o.push("LGA is not valid.");
  if (i.lgaId && !i.stateId) o.push("Choose a state before an LGA.");
  return o;
}
export function validateNewUser(i: { email?: string; password?: string; role?: string; stateId?: string | null; lgaId?: string | null }): string[] {
  const o: string[] = [];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.email ?? "")) o.push("Enter a valid email address.");
  if (i.password !== undefined && i.password !== "") {
    if (i.password.length < 12) o.push("A password needs at least 12 characters.");
    if (i.password.length > 72) o.push("A password can be at most 72 characters.");
    if (i.password.toLowerCase() === (i.email ?? "").toLowerCase()) o.push("The password cannot be the email address.");
  }
  return [...o, ...validateRoleGrant(i)];
}
/** Temporary password for the super admin to hand over. Unbiased random draw; no look-alike characters. */
export function genTempPassword(len = 16): string {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; let out = "";
  while (out.length < len) for (const b of crypto.getRandomValues(new Uint8Array(len * 2))) { if (b < 220 && out.length < len) out += A[b % A.length]; }
  return out;
}
