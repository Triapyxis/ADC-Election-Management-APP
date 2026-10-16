import { userClient } from "@/lib/supabase/user";
import { LocationForm } from "@/components/LocationForm";
export const dynamic = "force-dynamic";
const STATUS = ["geocoded_unverified", "low_confidence", "conflicting", "failed", "needs_manual_correction", "pending"];
const LABEL: Record<string, string> = { geocoded_unverified: "Awaiting verification", low_confidence: "Low confidence", conflicting: "Conflicting", failed: "Failed", needs_manual_correction: "Needs manual correction", pending: "Not geocoded" };

export default async function Locations({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams; const st = STATUS.includes(status ?? "") ? status! : "geocoded_unverified";
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user?.id ?? "");
  if (!roles?.some((r) => ["state_admin", "election_admin", "super_admin"].includes(r.role))) return <section><h1 className="text-2xl font-semibold">Not available</h1><p className="mt-2 text-ink-soft">Location review is for state and election administrators.</p></section>;
  const { data, error } = await sb.from("polling_units").select("id,official_code,name,latitude,longitude,wards(name,lgas(name))").eq("geocode_status", st).order("official_code").limit(25);
  return (<div><h1 className="text-2xl font-semibold">Polling-unit locations</h1>
    <p className="mt-1 max-w-prose text-sm text-ink-soft">A geocoded point is a candidate, not proof of where the polling booth is. Verify only after checking it (imagery, local knowledge, field visit) and say how. Unverified units are not used for geofencing.</p>
    <nav aria-label="Status" className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">{STATUS.map((s) => <a key={s} href={`?status=${s}`} className={s === st ? "font-semibold underline" : "text-green underline"}>{LABEL[s]}</a>)}</nav>
    {error ? <p className="mt-6 text-ink-soft">Could not load units. Reload to try again.</p> : !data?.length ? <p className="mt-6 text-ink-soft">No units in this status in your area.</p> : (
      <ul className="mt-6 divide-y divide-rule border-y border-rule">{(data as any[]).map((u) => { const q = encodeURIComponent([u.name, u.wards?.name, u.wards?.lgas?.name, "Nigeria"].filter(Boolean).join(", ")); return (
        <li key={u.id} className="space-y-2 py-4"><p className="font-medium"><span className="tabular-nums text-ink-soft">{u.official_code}</span> {u.name}</p><p className="text-sm text-ink-soft">{u.wards?.name}, {u.wards?.lgas?.name}</p>
          <a className="text-sm text-green underline" target="_blank" rel="noreferrer" href={u.latitude != null ? `https://www.openstreetmap.org/?mlat=${u.latitude}&mlon=${u.longitude}#map=17/${u.latitude}/${u.longitude}` : `https://www.openstreetmap.org/search?query=${q}`}>{u.latitude != null ? "Open current point in OpenStreetMap" : "Search in OpenStreetMap"}</a>
          <LocationForm id={u.id} lat={u.latitude} lon={u.longitude} /></li>); })}</ul>)}</div>);
}
