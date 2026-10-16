import { userClient } from "@/lib/supabase/user";
import { DecisionButtons } from "@/components/DecisionButtons";
export const dynamic = "force-dynamic";
const flag: Record<string, string> = { within_radius: "At the polling unit", outside_radius: "Outside the 200 m radius", poor_accuracy: "GPS accuracy too low", gps_missing: "No GPS reading", stale_location: "Location reading too old", pu_coordinates_unverified: "Unit location not verified, check not possible", pu_coordinates_missing: "Unit location unknown, check not possible", not_checked: "Not checked" };

export default async function Verify() {
  const sb = await userClient();
  const { data, error } = await sb.from("result_submissions").select("id,created_at,geofence_status,submitted_by,polling_units(official_code,name),candidate_votes(votes,candidates(parties(abbreviation))),submission_documents(id,content_type)").in("status", ["submitted", "pending_verification"]).order("created_at").limit(50);
  if (error) return <section><h1 className="text-2xl font-semibold">Queue unavailable</h1><p className="mt-2 text-ink-soft">Could not load submissions. Reload to try again.</p></section>;
  return (
    <div><h1 className="text-2xl font-semibold">Results awaiting verification</h1>
      <p className="mt-1 max-w-prose text-sm text-ink-soft">A location flag is a prompt to look closer. It does not make the reported votes invalid. You cannot decide a submission you made yourself.</p>
      {!data?.length ? <p className="mt-6 text-lg">Nothing is waiting for you.</p> : (
        <ul className="mt-6 divide-y divide-rule border-y border-rule">{(data as any[]).map((s) => (
          <li key={s.id} className="grid gap-3 py-4 md:grid-cols-[1fr_auto]">
            <div><p className="font-medium">{s.polling_units?.official_code} {s.polling_units?.name}</p>
              <p className="text-sm text-ink-soft">Submitted {new Date(s.created_at).toLocaleString("en-NG")}. Location: {flag[s.geofence_status] ?? s.geofence_status}</p>
              <p className="mt-1 text-sm tabular-nums">{(s.candidate_votes ?? []).map((v: any) => `${v.candidates?.parties?.abbreviation} ${v.votes}`).join(", ")}</p>
              {(s.submission_documents ?? []).length > 0 ? <p className="mt-1 text-sm">{s.submission_documents.map((d: any, i: number) => <a key={d.id} href={`/api/uploads/${d.id}`} target="_blank" rel="noreferrer" className="mr-3 text-green underline">Result sheet {i + 1}</a>)}</p> : <p className="mt-1 text-sm text-ink-soft">No result sheet attached.</p>}</div>
            <DecisionButtons id={s.id} /></li>))}</ul>)}
    </div>);
}
