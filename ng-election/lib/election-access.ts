export const AGENT_ACCESS_MODES = ["scheduled", "open", "locked"] as const;
export type AgentAccessMode = (typeof AGENT_ACCESS_MODES)[number];
export type AgentAccessControl = {
  id?: string;
  election_id: string;
  contest_type: string;
  access_mode: AgentAccessMode;
  opens_at: string | null;
  closes_at: string | null;
  reason: string | null;
};

export function isAgentAccessOpen(control: Pick<AgentAccessControl, "access_mode" | "opens_at" | "closes_at"> | null | undefined, now = new Date()): boolean {
  if (!control) return false;
  if (control.access_mode === "open") return true;
  if (control.access_mode !== "scheduled" || !control.opens_at || !control.closes_at) return false;
  const opens = Date.parse(control.opens_at), closes = Date.parse(control.closes_at);
  return Number.isFinite(opens) && Number.isFinite(closes) && now.getTime() >= opens && now.getTime() < closes;
}
