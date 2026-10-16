import { db } from "@/lib/supabase/server";

import type { Area } from "./area.ts";
export type { Area };
export { UUID, progressLabel } from "./area.ts";

export async function presidentialContest() {
  const s = db();
  const { data: el, error: e1 } = await s.from("elections").select("id,name").order("election_date", { ascending: false }).limit(1).maybeSingle();
  if (e1) throw e1; if (!el) return null;
  const { data: ct, error: e2 } = await s.from("contests").select("id").eq("election_id", el.id).eq("type", "presidential").maybeSingle();
  if (e2) throw e2; return ct ? { contestId: ct.id as string, electionName: el.name as string } : null;
}
export async function lgaSummary(contest: string, state: string): Promise<Area[]> {
  const { data, error } = await db().rpc("public_lga_summary", { p_contest: contest, p_state: state }); if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.lga_id, name: r.lga_name, expected: Number(r.expected), reporting: Number(r.reporting) }));
}
export async function wardSummary(contest: string, lga: string): Promise<Area[]> {
  const { data, error } = await db().rpc("public_ward_summary", { p_contest: contest, p_lga: lga }); if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.ward_id, name: r.ward_name, expected: Number(r.expected), reporting: Number(r.reporting) }));
}
export type Unit = { id: string; code: string; name: string; votes: Record<string, number> | null };
/** votes === null means no verified result for that unit (unreported), distinct from a recorded zero. */
export async function unitResults(contest: string, ward: string): Promise<Unit[]> {
  const { data, error } = await db().rpc("public_unit_results", { p_contest: contest, p_ward: ward }); if (error) throw error;
  const m = new Map<string, Unit>();
  for (const r of (data ?? []) as any[]) {
    const u = m.get(r.pu_id) ?? { id: r.pu_id, code: r.official_code, name: r.pu_name, votes: null }; m.set(r.pu_id, u);
    if (r.candidate_id) (u.votes ??= {})[r.candidate_id] = Number(r.votes);
  }
  return [...m.values()];
}
