import { db } from "@/lib/supabase/server";

export type Candidate = { id: string; name: string; photo: string | null; party: string; partyName: string; colour: string | null; votes: number | null };
export type Snapshot = {
  election: { id: string; name: string; date: string; status: string };
  contest: { id: string; name: string };
  candidates: Candidate[];            // sorted by votes desc; votes null = nothing reported yet
  totalVotes: number;
  progress: { expected: number; reporting: number; pending: number; rejected: number };
  stateLeaders: Record<string, { candidateId: string; votes: number }>; // key: lowercase state name
  fetchedAt: string;                  // when this page last synced successfully
  latestSubmissionAt: string | null;  // newest verified submission (a different thing)
};

/** Returns null when no public election/presidential contest exists; throws on query failure. */
export async function getPresidentialSnapshot(): Promise<Snapshot | null> {
  const s = db();
  const { data: el, error: e1 } = await s.from("elections").select("id,name,election_date,status").order("election_date", { ascending: false }).limit(1).maybeSingle();
  if (e1) throw e1; if (!el) return null;
  const { data: ct, error: e2 } = await s.from("contests").select("id,name").eq("election_id", el.id).eq("type", "presidential").maybeSingle();
  if (e2) throw e2; if (!ct) return null;

  const [cands, votes, prog] = await Promise.all([
    s.from("candidates").select("id,full_name,photo_url,parties(abbreviation,name,brand_colour)").eq("contest_id", ct.id),
    s.from("public_state_votes").select("state_id,candidate_id,votes,latest_submission_at,states:state_id(name)").eq("contest_id", ct.id),
    s.from("public_contest_progress").select("*").eq("contest_id", ct.id).maybeSingle(),
  ]);
  for (const r of [cands, votes, prog]) if (r.error) throw r.error;

  const byCand = new Map<string, number>(); const perState = new Map<string, Map<string, number>>();
  let latest: string | null = null;
  for (const v of (votes.data ?? []) as any[]) {
    byCand.set(v.candidate_id, (byCand.get(v.candidate_id) ?? 0) + Number(v.votes));
    const k = String(v.states?.name ?? "").toLowerCase();
    const m = perState.get(k) ?? new Map(); m.set(v.candidate_id, Number(v.votes)); perState.set(k, m);
    if (!latest || v.latest_submission_at > latest) latest = v.latest_submission_at;
  }
  const candidates: Candidate[] = ((cands.data ?? []) as any[]).map((c) => ({
    id: c.id, name: c.full_name, photo: c.photo_url, party: c.parties.abbreviation, partyName: c.parties.name,
    colour: c.parties.brand_colour, votes: byCand.has(c.id) ? byCand.get(c.id)! : null,
  })).sort((a, b) => (b.votes ?? -1) - (a.votes ?? -1));

  const stateLeaders: Snapshot["stateLeaders"] = {};
  for (const [k, m] of perState) { const [id, v] = [...m].sort((a, b) => b[1] - a[1])[0]!; stateLeaders[k] = { candidateId: id, votes: v }; }
  const p: any = prog.data ?? {};
  return {
    election: { id: el.id, name: el.name, date: el.election_date, status: el.status }, contest: ct,
    candidates, totalVotes: [...byCand.values()].reduce((a, b) => a + b, 0),
    progress: { expected: Number(p.expected_units ?? 0), reporting: Number(p.reporting_units ?? 0), pending: Number(p.pending ?? 0), rejected: Number(p.rejected ?? 0) },
    stateLeaders, fetchedAt: new Date().toISOString(), latestSubmissionAt: latest,
  };
}

export type StateSnapshot = { state: { id: string; name: string }; election: { name: string; date: string }; candidates: Candidate[]; totalVotes: number; progress: { expected: number; reporting: number }; fetchedAt: string };

/** null = unknown state or no public presidential contest. Throws on query failure. */
export async function getStateSnapshot(slug: string): Promise<StateSnapshot | null> {
  if (!/^[a-z-]+$/.test(slug)) return null;
  const s = db(); const name = slug.replace(/-/g, " ");
  const { data: st, error: e0 } = await s.from("states").select("id,name").ilike("name", name).maybeSingle();
  if (e0) throw e0; if (!st) return null;
  const { data: el, error: e1 } = await s.from("elections").select("id,name,election_date").order("election_date", { ascending: false }).limit(1).maybeSingle();
  if (e1) throw e1; if (!el) return null;
  const { data: ct, error: e2 } = await s.from("contests").select("id").eq("election_id", el.id).eq("type", "presidential").maybeSingle();
  if (e2) throw e2; if (!ct) return null;
  const [cands, votes, prog] = await Promise.all([
    s.from("candidates").select("id,full_name,photo_url,parties(abbreviation,name,brand_colour)").eq("contest_id", ct.id),
    s.from("public_state_votes").select("candidate_id,votes").eq("contest_id", ct.id).eq("state_id", st.id),
    s.from("public_state_progress").select("expected_units,reporting_units").eq("contest_id", ct.id).eq("state_id", st.id).maybeSingle(),
  ]);
  for (const r of [cands, votes, prog]) if (r.error) throw r.error;
  const by = new Map<string, number>(((votes.data ?? []) as any[]).map((v) => [v.candidate_id, Number(v.votes)]));
  const candidates: Candidate[] = ((cands.data ?? []) as any[]).map((c) => ({ id: c.id, name: c.full_name, photo: c.photo_url, party: c.parties.abbreviation, partyName: c.parties.name, colour: c.parties.brand_colour, votes: by.has(c.id) ? by.get(c.id)! : null })).sort((a, b) => (b.votes ?? -1) - (a.votes ?? -1));
  const p: any = prog.data ?? {};
  return { state: st, election: { name: el.name, date: el.election_date }, candidates, totalVotes: [...by.values()].reduce((a, b) => a + b, 0), progress: { expected: Number(p.expected_units ?? 0), reporting: Number(p.reporting_units ?? 0) }, fetchedAt: new Date().toISOString() };
}
