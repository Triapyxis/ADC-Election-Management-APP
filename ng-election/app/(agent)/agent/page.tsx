import { userClient } from "@/lib/supabase/user";
import { SubmitForm } from "@/components/SubmitForm";
import { LocationMonitor } from "@/components/LocationMonitor";
export const dynamic = "force-dynamic";

export default async function Agent() {
  const sb = await userClient();
  const { data: as } = await sb.from("assignments").select("id,polling_unit_id,starts_at,expires_at,polling_units(official_code,name)").eq("status", "active").lte("starts_at", new Date().toISOString()).gte("expires_at", new Date().toISOString());
  const { data: el } = await sb.from("elections").select("id,name").order("election_date", { ascending: false }).limit(1).maybeSingle();
  const { data: ct } = el ? await sb.from("contests").select("id,name").eq("election_id", el.id).eq("type", "presidential").maybeSingle() : { data: null };
  const { data: cands } = ct ? await sb.from("candidates").select("id,full_name,parties(abbreviation)").eq("contest_id", ct.id) : { data: [] };
  const list = ((cands ?? []) as any[]).map((c) => ({ id: c.id, name: c.full_name, party: c.parties.abbreviation }));

  if (!as?.length) return (<section><h1 className="text-2xl font-semibold">No active assignment</h1><p className="mt-2 max-w-prose text-ink-soft">You can submit results only for polling units you are assigned to, during your authorised period. Ask your supervisor to assign you.</p></section>);
  if (!ct) return (<section><h1 className="text-2xl font-semibold">No contest open for results</h1><p className="mt-2 text-ink-soft">Nothing is configured for submission yet.</p></section>);
  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold">Submit results: {ct.name}</h1>
      {(as as any[]).map((a) => (
        <section key={a.id}><h2 className="font-semibold">{a.polling_units.name}</h2><p className="text-sm text-ink-soft">Polling unit {a.polling_units.official_code}. Valid until {new Date(a.expires_at).toLocaleString("en-NG")}.</p>
          <LocationMonitor pollingUnitId={a.polling_unit_id} />
          <SubmitForm contestId={ct.id} pollingUnitId={a.polling_unit_id} candidates={list} /></section>))}
    </div>
  );
}
