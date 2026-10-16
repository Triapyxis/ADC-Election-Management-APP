export const MAX_ASSIGNMENT_DAYS = 14; // policy default, adjust per operation
export type AssignmentInput = { agentEmail: string; pollingUnitId: string; startsAt: string; expiresAt: string };
export function validateAssignment(i: AssignmentInput, now = new Date()): string[] {
  const out: string[] = []; const s = Date.parse(i.startsAt), e = Date.parse(i.expiresAt);
  if (!/^\S+@\S+\.\S+$/.test(i.agentEmail ?? "")) out.push("Enter the agent's email address.");
  if (!i.pollingUnitId) out.push("Select a polling unit.");
  if (Number.isNaN(s) || Number.isNaN(e)) { out.push("Start and expiry times are required."); return out; }
  if (e <= s) out.push("Expiry must be after the start time.");
  if (e <= now.getTime()) out.push("Expiry is already in the past.");
  if (e - s > MAX_ASSIGNMENT_DAYS * 864e5) out.push(`An assignment cannot last longer than ${MAX_ASSIGNMENT_DAYS} days.`);
  return out;
}
