import type { SupabaseClient } from "@supabase/supabase-js";
import { seatsLed } from "./seats.ts";

export type FeedSeats = { parties: { party: string; colour: string | null; seats: number }[]; tied: number; counted: number; total: number };
export type Feed = {
  syncedAt: string; election: { name: string; date: string; status: string } | null;
  president: { contest: string; candidates: { id: string; name: string; party: string; colour: string | null; votes: number | null }[]; totalVotes: number;
    progress: { expected: number; reporting: number; pending: number; rejected: number }; stateLeaders: Record<string, { party: string; colour: string | null; votes: number }> } | null;
  seats: Record<"senate" | "house" | "governorship", FeedSeats | null>;
  states: { key: string; name: string; expected: number; reporting: number }[];
  projection: { contest: string; shares: { party: string; name: string; share: number }[]; coverage: { statesIncluded: number; statesTotal: number }; createdAt: string; assumptions: string[] } | null;
};
const SEAT_TYPES = { senate: "senatorial", house: "house_of_reps", governorship: "governorship" } as const;

/** Everything a situation-room laptop may show. Public data plus RELEASED projections. No agent, location or submission-level data. */
export async function getFeed(sb: SupabaseClient): Promise<Feed> {
  const out: Feed = { syncedAt: new Date().toISOString(), election: null, president: null, seats: { senate: null, house: null, governorship: null }, states: [], projection: null };
  const safe = async (f: () => Promise<void>) => { try { await f(); } catch { /* section stays null: the laptop shows "no data", never a guess */ } };
  let electionId: string | null = null;
  await safe(async () => {
    const { data: el } = await sb.from("elections").select("id,name,election_date,status").order("election_date", { ascending: false }).limit(1).maybeSingle();
    if (el) { electionId = el.id; out.election = { name: el.name, date: el.election_date, status: el.status }; }
  });
  if (!electionId) return out;
  await safe(async () => {
    const { data: ct } = await sb.from("contests").select("id,name").eq("election_id", electionId!).eq("type", "presidential").maybeSingle(); if (!ct) return;
    const [cands, votes, prog, sp, st] = await Promise.all([
      sb.from("candidates").select("id,full_name,parties(abbreviation,brand_colour)").eq("contest_id", ct.id),
      sb.from("public_state_votes").select("state_id,candidate_id,votes").eq("contest_id", ct.id),
      sb.from("public_contest_progress").select("expected_units,reporting_units,pending,rejected").eq("contest_id", ct.id).maybeSingle(),
      sb.from("public_state_progress").select("state_id,expected_units,reporting_units").eq("contest_id", ct.id),
      sb.from("states").select("id,name")]);
    for (const r of [cands, votes, prog, sp, st]) if (r.error) throw r.error;
    const name = new Map((st.data ?? []).map((s: any) => [s.id, String(s.name)]));
    const by = new Map<string, number>(), per = new Map<string, Map<string, number>>();
    for (const v of (votes.data ?? []) as any[]) { by.set(v.candidate_id, (by.get(v.candidate_id) ?? 0) + Number(v.votes)); const m = per.get(v.state_id) ?? new Map(); m.set(v.candidate_id, Number(v.votes)); per.set(v.state_id, m); }
    const candidates = ((cands.data ?? []) as any[]).map((c) => ({ id: c.id, name: c.full_name, party: c.parties.abbreviation, colour: c.parties.brand_colour ?? null, votes: by.has(c.id) ? by.get(c.id)! : null })).sort((a, b) => (b.votes ?? -1) - (a.votes ?? -1));
    const stateLeaders: Record<string, { party: string; colour: string | null; votes: number }> = {};
    for (const [sid, m] of per) { const top = [...m].sort((a, b) => b[1] - a[1]); if (top.length > 1 && top[0]![1] === top[1]![1]) continue; const c = candidates.find((x) => x.id === top[0]![0]); const k = (name.get(sid) ?? "").toLowerCase(); if (c && k) stateLeaders[k] = { party: c.party, colour: c.colour, votes: top[0]![1] }; }
    const p: any = prog.data ?? {};
    out.president = { contest: ct.name, candidates, totalVotes: [...by.values()].reduce((a, b) => a + b, 0), progress: { expected: Number(p.expected_units ?? 0), reporting: Number(p.reporting_units ?? 0), pending: Number(p.pending ?? 0), rejected: Number(p.rejected ?? 0) }, stateLeaders };
    out.states = ((sp.data ?? []) as any[]).map((r) => ({ key: (name.get(r.state_id) ?? "").toLowerCase(), name: name.get(r.state_id) ?? "", expected: Number(r.expected_units), reporting: Number(r.reporting_units) })).filter((s) => s.name).sort((a, b) => a.name.localeCompare(b.name));
  });
  for (const [k, type] of Object.entries(SEAT_TYPES) as [keyof typeof SEAT_TYPES, string][]) await safe(async () => {
    const [led, tot] = await Promise.all([sb.from("public_contest_leaders").select("party,brand_colour,margin").eq("type", type).limit(2000), sb.from("contests").select("id", { count: "exact", head: true }).eq("election_id", electionId!).eq("type", type)]);
    if (led.error || tot.error) throw led.error ?? tot.error;
    const r = seatsLed(((led.data ?? []) as any[]).map((x) => ({ party: x.party, colour: x.brand_colour, margin: Number(x.margin) })));
    out.seats[k] = { parties: r.parties, tied: r.tied, counted: r.parties.reduce((a, p) => a + p.seats, 0) + r.tied, total: tot.count ?? 0 };
  });
  await safe(async () => {
    const { data: p } = await sb.from("projections").select("contest_id,assumptions,result,created_at,contests(name)").eq("published", true).order("published_at", { ascending: false }).limit(1).maybeSingle();
    if (!p || (p as any).result?.status !== "ok") return;
    const { data: cs } = await sb.from("candidates").select("id,full_name,parties(abbreviation)").eq("contest_id", (p as any).contest_id);
    const shares = ((cs ?? []) as any[]).map((c) => ({ party: c.parties.abbreviation, name: c.full_name, share: (p as any).result.projectedShares?.[c.id] as number | undefined })).filter((s) => s.share != null).sort((a, b) => b.share! - a.share!) as { party: string; name: string; share: number }[];
    out.projection = { contest: (p as any).contests?.name ?? "Contest", shares, coverage: (p as any).result.coverage, createdAt: (p as any).created_at, assumptions: (p as any).assumptions };
  });
  return out;
}
