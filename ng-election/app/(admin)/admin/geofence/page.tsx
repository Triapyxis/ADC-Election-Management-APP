import { userClient } from "@/lib/supabase/user";
import { OverrideButton } from "@/components/OverrideButton";
import { totals, countByOutcome, onDuty, riskFlags, type Check, type Coverage } from "@/lib/dashboard";
export const dynamic = "force-dynamic";

const STAFF = ["supervisor", "lga_coordinator", "state_admin", "election_admin", "super_admin"];
const LABEL: Record<string, string> = { within_radius: "Within radius", outside_radius: "Outside radius", poor_accuracy: "Poor GPS accuracy", gps_missing: "No GPS", stale_location: "Stale location", pu_coordinates_unverified: "Unit location unverified", pu_coordinates_missing: "Unit location missing", pending_offline_validation: "Offline, awaiting validation" };
const n = (v: number) => Math.round(v).toLocaleString("en-NG");

export default async function Geofence({ searchParams }: { searchParams: Promise<{ outcome?: string }> }) {
  const { outcome } = await searchParams; const sb = await userClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user?.id ?? "");
  if (!roles?.some((r) => STAFF.includes(r.role))) return <section><h1 className="text-2xl font-semibold">Not available</h1><p className="mt-2 text-ink-soft">This dashboard is for supervisors and administrators.</p></section>;

  const [cov, checks, ovr] = await Promise.all([
    sb.rpc("geofence_coverage"),
    sb.from("geofence_checks").select("id,agent_id,polling_unit_id,outcome,trigger,received_at,distance_m,reported_lat,reported_lon,polling_units(official_code,name,latitude,longitude)").order("received_at", { ascending: false }).limit(500),
    sb.from("geofence_overrides").select("id,supervisor_id,reason,created_at,check_id").order("created_at", { ascending: false }).limit(100),
  ]);
  if (cov.error || checks.error) return <section><h1 className="text-2xl font-semibold">Dashboard unavailable</h1><p className="mt-2 text-ink-soft">Could not load location data. Reload to try again.</p></section>;

  const rows = (cov.data ?? []) as Coverage[]; const t = totals(rows);
  const raw = (checks.data ?? []) as any[];
  const cs: Check[] = raw.map((r) => ({ id: r.id, agentId: r.agent_id, puId: r.polling_unit_id, outcome: r.outcome, trigger: r.trigger, at: new Date(r.received_at), lat: r.reported_lat, lon: r.reported_lon, puLat: r.polling_units?.latitude ?? null, puLon: r.polling_units?.longitude ?? null }));
  const counts = countByOutcome(cs), risks = riskFlags(cs, (ovr.data ?? []).map((o) => ({ supervisorId: o.supervisor_id })));
  const shown = raw.filter((r) => !outcome || r.outcome === outcome).slice(0, 100);

  return (
    <div className="space-y-10">
      <header><h1 className="text-2xl font-semibold">Geofence and field compliance</h1><p className="mt-1 max-w-prose text-sm text-ink-soft">Staff only. Location flags are prompts for review. They do not invalidate results and are not proof of misconduct.</p></header>

      <section aria-labelledby="cov"><h2 id="cov" className="text-lg font-semibold">Polling-unit location coverage</h2>
        <dl className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
          {[["Polling units", t.total], ["With coordinates", t.with_coordinates], ["Verified locations", t.verified], ["Geofence-ready", t.geofence_ready], ["Agents on duty (est.)", onDuty(cs)]].map(([k, v]) => <div key={k as string}><dt className="text-ink-soft">{k}</dt><dd className="text-xl font-semibold tabular-nums">{n(Number(v ?? 0))}</dd></div>)}
        </dl>
       {t.total ? ( <p className="mt-2 text-sm text-ink-soft">  {(t.pctCoordinates ?? 0).toFixed(1)}% have coordinates,{" "}   {(t.pctVerified ?? 0).toFixed(1)}% verified,{" "}
    {(t.pctReady ?? 0).toFixed(1)}% ready for geofencing.
    Unverified locations are never treated as ready.
  </p>
) : (
  <p className="mt-2 text-ink-soft">
    No polling-unit data in your area.
  </p>
)}
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[40rem] text-left text-sm"><thead className="text-ink-soft"><tr><th className="py-1">State</th><th className="text-right">Units</th><th className="text-right">Coordinates</th><th className="text-right">Verified</th><th className="text-right">Ready</th><th className="text-right">Pending</th><th className="text-right">Low confidence</th><th className="text-right">Failed</th><th className="text-right">Conflicting</th></tr></thead>
          <tbody className="divide-y divide-rule tabular-nums">{rows.map((r) => <tr key={r.state_name}><td className="py-1.5 font-sans">{r.state_name}</td>{[r.total, r.with_coordinates, r.verified, r.geofence_ready, r.pending, r.low_confidence, r.failed, r.conflicting].map((v, i) => <td key={i} className="text-right">{n(Number(v))}</td>)}</tr>)}</tbody></table></div></section>

      <section aria-labelledby="ev"><h2 id="ev" className="text-lg font-semibold">Recent location checks</h2>
        <p className="mt-1 text-sm text-ink-soft">Latest {cs.length} checks in your area.</p>
        <nav aria-label="Filter by outcome" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm"><a href="?" className={!outcome ? "font-semibold underline" : "text-green underline"}>All</a>{Object.entries(counts).map(([k, v]) => <a key={k} href={`?outcome=${k}`} className={outcome === k ? "font-semibold underline" : "text-green underline"}>{LABEL[k] ?? k} ({v})</a>)}</nav>
        {!shown.length ? <p className="mt-3 text-ink-soft">No location checks recorded yet.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[40rem] text-left text-sm"><thead className="text-ink-soft"><tr><th className="py-1">Time</th><th>Polling unit</th><th>Outcome</th><th className="text-right">Distance</th><th>Trigger</th><th></th></tr></thead>
          <tbody className="divide-y divide-rule">{shown.map((r) => <tr key={r.id}><td className="py-1.5">{new Date(r.received_at).toLocaleString("en-NG")}</td><td>{r.polling_units?.official_code} {r.polling_units?.name}</td><td>{LABEL[r.outcome] ?? r.outcome}</td><td className="text-right tabular-nums">{r.distance_m == null ? "n/a" : `${Math.round(r.distance_m)} m`}</td><td>{r.trigger}</td><td>{r.outcome !== "within_radius" && roles?.some((x) => x.role === "supervisor") ? <OverrideButton checkId={r.id} /> : null}</td></tr>)}</tbody></table></div>}</section>

      <section aria-labelledby="rk"><h2 id="rk" className="text-lg font-semibold">Review prompts</h2>
        {!risks.length ? <p className="mt-2 text-ink-soft">Nothing flagged in the checks loaded.</p> : <ul className="mt-2 space-y-1 text-sm">{risks.map((r, i) => <li key={i}>{r.detail}. <span className="text-ink-soft">Subject {r.subject.slice(0, 8)}</span></li>)}</ul>}</section>

      <section aria-labelledby="ov"><h2 id="ov" className="text-lg font-semibold">Supervisor overrides</h2>
        {!ovr.data?.length ? <p className="mt-2 text-ink-soft">No overrides recorded.</p> : <ul className="mt-2 divide-y divide-rule text-sm">{ovr.data.map((o) => <li key={o.id} className="py-2">{new Date(o.created_at).toLocaleString("en-NG")}, supervisor {o.supervisor_id.slice(0, 8)}: {o.reason}</li>)}</ul>}</section>
    </div>);
}
