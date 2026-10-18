import { userClient } from "@/lib/supabase/user";
import { SubmitForm } from "@/components/SubmitForm";
import { LocationMonitor } from "@/components/LocationMonitor";
import { isAgentAccessOpen, type AgentAccessControl } from "@/lib/election-access";
import { TYPE_LABEL } from "@/lib/seats";
import { PollingIncidentCapture } from "@/components/PollingIncidentCapture";
export const dynamic = "force-dynamic";

export default async function Agent() {
  const sb = await userClient();
  const now = new Date().toISOString();
  const { data: assignments } = await sb.from("assignments").select("id,polling_unit_id,starts_at,expires_at,polling_units(official_code,name,senatorial_district_id,federal_constituency_id,wards(lgas(state_id)))").eq("status", "active").lte("starts_at", now).gte("expires_at", now);
  const { data: election } = await sb.from("elections").select("id,name,election_date").order("election_date", { ascending: false }).limit(1).maybeSingle();

  if (!assignments?.length) return <section><h1 className="text-2xl font-semibold">No active assignment</h1><p className="mt-2 max-w-prose text-ink-soft">You can submit results only for polling units you are assigned to, during your authorised period. Ask your supervisor to assign you.</p></section>;
  if (!election) return <section><h1 className="text-2xl font-semibold">No election configured</h1><p className="mt-2 text-ink-soft">The Election Admin has not made an election available for agent submissions.</p></section>;

  const [{ data: contestRows }, { data: accessRows }] = await Promise.all([
    sb.from("contests").select("id,name,type,state_id,senatorial_district_id,federal_constituency_id,candidates(id,full_name,parties(abbreviation))").eq("election_id", election.id).limit(1500),
    sb.from("election_agent_access").select("election_id,contest_type,access_mode,opens_at,closes_at,reason").eq("election_id", election.id),
  ]);
  const contests = (contestRows ?? []) as any[];
  const controls = (accessRows ?? []) as AgentAccessControl[];
  const controlFor = (type: string) => controls.find((c) => c.contest_type === type) ?? null;
  const enabledTypes = new Set(controls.filter((c) => isAgentAccessOpen(c)).map((c) => c.contest_type));
  const rows: { assignment: any; contest: any; candidates: { id: string; name: string; party: string }[] }[] = [];

  for (const assignment of assignments as any[]) {
    const pu = assignment.polling_units;
    const stateId = pu?.wards?.lgas?.state_id;
    for (const contest of contests) {
      if (!enabledTypes.has(contest.type)) continue;
      const matchesUnit = contest.type === "presidential"
        || (contest.type === "governorship" && !!stateId && contest.state_id === stateId)
        || (contest.type === "senatorial" && !!pu?.senatorial_district_id && contest.senatorial_district_id === pu.senatorial_district_id)
        || (contest.type === "house_of_reps" && !!pu?.federal_constituency_id && contest.federal_constituency_id === pu.federal_constituency_id)
        // The current data model scopes State Assembly contests to state; constituency-level mapping is not yet in the source data.
        || (contest.type === "state_assembly" && !!stateId && contest.state_id === stateId);
      if (!matchesUnit) continue;
      const candidates = ((contest.candidates ?? []) as any[]).map((c) => ({ id: c.id, name: c.full_name, party: c.parties?.abbreviation ?? "Independent" }));
      if (candidates.length) rows.push({ assignment, contest, candidates });
    }
  }

  return <div className="space-y-8">
    <header><h1 className="text-2xl font-semibold">Agent results submission</h1><p className="mt-1 text-sm text-ink-soft">Election: {election.name}. Only contest types currently opened by the Election Admin are available. Each contest is matched to your assigned polling unit's geography.</p></header>
    {enabledTypes.size > 0 && <section className="space-y-4"><h2 className="text-xl font-semibold">Incident reporting</h2><p className="text-sm text-ink-soft">Report election incidents from your active assigned polling unit. Evidence must be captured live in this app; imported photos and videos are not accepted.</p>{(assignments as any[]).map((assignment) => <PollingIncidentCapture key={`incident:${assignment.id}`} assignmentId={assignment.id} electionId={election.id} contestTypes={[...enabledTypes]} pollingUnitName={`${assignment.polling_units?.official_code ?? "Polling unit"} — ${assignment.polling_units?.name ?? "Assigned location"}`} />)}</section>}
    {!rows.length ? <section className="max-w-3xl rounded-lg border border-rule p-5"><h2 className="text-lg font-semibold">No open contests for your assignments</h2><p className="mt-2 text-sm text-ink-soft">There may be no configured candidates for your polling unit, or the Election Admin has not opened the relevant election type. Access is locked by default when no schedule has been saved.</p><ul className="mt-4 space-y-2 text-sm">{["presidential", "governorship", "senatorial", "house_of_reps", "state_assembly"].map((type) => { const c = controlFor(type); const open = isAgentAccessOpen(c); return <li key={type} className="flex flex-wrap justify-between gap-2 border-b border-rule pb-2"><span>{TYPE_LABEL[type as keyof typeof TYPE_LABEL]}</span><strong>{open ? "Open — no matching configured contest" : "Locked"}</strong>{c?.reason && <span className="w-full text-ink-soft">{c.reason}</span>}</li>; })}</ul></section> : <div className="space-y-6">{rows.map(({ assignment, contest, candidates }) => <section key={`${assignment.id}:${contest.id}`} className="space-y-3 rounded-lg border border-rule p-4"><header><p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{TYPE_LABEL[contest.type as keyof typeof TYPE_LABEL] ?? contest.type}</p><h2 className="text-lg font-semibold">{contest.name}</h2><p className="text-sm text-ink-soft">Polling unit {assignment.polling_units.official_code} — {assignment.polling_units.name}. Assignment valid until {new Date(assignment.expires_at).toLocaleString("en-NG")}.</p></header><LocationMonitor pollingUnitId={assignment.polling_unit_id} /><SubmitForm contestId={contest.id} pollingUnitId={assignment.polling_unit_id} candidates={candidates} /></section>)}</div>}
  </div>;
}
