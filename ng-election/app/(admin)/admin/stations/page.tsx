import { userClient } from "@/lib/supabase/user";
import { CreateStation, RevokeStation } from "@/components/StationForms";
import { agoLabel } from "@/lib/roster";
export const dynamic = "force-dynamic";
export default async function Stations() {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user?.id ?? "");
  if (!roles?.some((r) => r.role === "election_admin" || r.role === "super_admin")) return <section><h1 className="text-2xl font-semibold">Not available</h1><p className="mt-2 text-ink-soft">Station keys are managed by election administrators.</p></section>;
  const { data, error } = await sb.from("station_keys").select("id,label,created_at,revoked_at,last_seen_at").order("created_at", { ascending: false });
  const now = new Date();
  return (<div className="space-y-10"><header><h1 className="text-2xl font-semibold">Situation-room stations</h1>
    <p className="mt-1 max-w-prose text-sm text-ink-soft">Each situation-room laptop runs on its own and only receives display data from here. Give every laptop its own key so you can see which is connected and cut one off without affecting the others. A station sees public results and projections you have released. It sees no agent, location or submission data.</p></header>
    <section><h2 className="text-lg font-semibold">Add a laptop</h2><div className="mt-3"><CreateStation /></div></section>
    <section><h2 className="text-lg font-semibold">Laptops</h2>
      {error ? <p className="mt-2 text-ink-soft">Could not load stations. Reload to try again.</p> : !data?.length ? <p className="mt-2 text-ink-soft">None yet.</p> : <ul className="mt-3 divide-y divide-rule border-y border-rule">{data.map((s) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><p className="font-medium">{s.label}{s.revoked_at && <span className="ml-2 text-sm font-normal text-status-disputed">Revoked</span>}</p><p className="text-sm text-ink-soft">Last fetched data: {agoLabel(s.last_seen_at, now)}. Created {new Date(s.created_at).toLocaleDateString("en-NG")}.</p></div>{!s.revoked_at && <RevokeStation id={s.id} />}</li>)}</ul>}</section></div>);
}
