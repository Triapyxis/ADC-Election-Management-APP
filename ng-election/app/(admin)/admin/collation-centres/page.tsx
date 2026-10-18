import { userClient } from "@/lib/supabase/user";
import { CollationCentreAdminForm } from "@/components/collation/CollationCentreAdminForm";
export const dynamic = "force-dynamic";
export default async function CollationCentresAdmin() {
  const sb = await userClient();
  const [{ data: elections }, { data: states }, { data: centres }] = await Promise.all([
    sb.from("elections").select("id,name").order("election_date", { ascending: false }).limit(100),
    sb.from("states").select("id,name").order("name"),
    sb.from("collation_centres").select("id,name,address,contest_type,geofence_radius_m,geocode_status,active,created_at").order("created_at", { ascending: false }).limit(100)
  ]);
  return <div className="max-w-4xl space-y-8"><section><h1 className="text-2xl font-semibold">Collation centres and agents</h1><p className="mt-2 text-sm text-ink-soft">Create a centre and assign an existing account in one operation. Capture remains blocked unless the centre coordinates are verified and the election-type access window is open.</p><div className="mt-4"><CollationCentreAdminForm elections={(elections ?? []) as any} states={(states ?? []) as any} /></div></section><section><h2 className="text-lg font-semibold">Configured centres</h2>{!centres?.length ? <p className="mt-2 text-sm text-ink-soft">No collation centres configured yet.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[36rem] text-left text-sm"><thead><tr className="border-b border-rule text-ink-soft"><th className="py-2">Centre</th><th>Election type</th><th>Geofence</th><th>Coordinates</th><th>Status</th></tr></thead><tbody>{centres.map((c: any) => <tr key={c.id} className="border-b border-rule"><td className="py-2">{c.name}<div className="text-xs text-ink-soft">{c.address}</div></td><td>{String(c.contest_type).replaceAll("_", " ")}</td><td>{c.geofence_radius_m} m</td><td>{c.geocode_status}</td><td>{c.active ? "Active" : "Inactive"}</td></tr>)}</tbody></table></div>}</section></div>;
}
