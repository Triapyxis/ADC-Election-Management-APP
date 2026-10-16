import { userClient } from "@/lib/supabase/user";
import { GenerateButton, PublishButton } from "@/components/ProjectionControls";
export const dynamic = "force-dynamic";
export default async function Projections() {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user?.id ?? "");
  if (!roles?.some((r) => r.role === "election_admin" || r.role === "super_admin")) return <section><h1 className="text-2xl font-semibold">Not available</h1><p className="mt-2 text-ink-soft">Projections are managed by election administrators.</p></section>;
  const [cs, ps] = await Promise.all([sb.from("contests").select("id,name,type").in("type", ["presidential", "governorship"]).order("name").limit(60),
    sb.from("projections").select("id,contest_id,created_at,published,result,method,method_version").order("created_at", { ascending: false }).limit(40)]);
  const name = new Map((cs.data ?? []).map((c) => [c.id, c.name]));
  return (<div className="space-y-10"><header><h1 className="text-2xl font-semibold">Projection control room</h1>
    <p className="mt-1 max-w-prose text-sm text-ink-soft">Projections are estimates, kept apart from verified results and official declarations. Each run records its inputs, method and assumptions. If there is not enough reporting, it produces no numbers. They never appear on the public results tracker. Released projections are visible only to the situation room.</p></header>
    <section><h2 className="text-lg font-semibold">Contests</h2>{!cs.data?.length ? <p className="mt-2 text-ink-soft">No presidential or governorship contests set up.</p> : <ul className="mt-3 divide-y divide-rule border-y border-rule">{cs.data.map((c) => <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><span>{c.name}</span><GenerateButton contestId={c.id} /></li>)}</ul>}</section>
    <section><h2 className="text-lg font-semibold">Recorded projections</h2>{!ps.data?.length ? <p className="mt-2 text-ink-soft">None yet.</p> : <ul className="mt-3 divide-y divide-rule border-y border-rule">{(ps.data as any[]).map((p) => <li key={p.id} className="space-y-1 py-3 text-sm">
      <p className="font-medium">{name.get(p.contest_id) ?? "Contest"}, {new Date(p.created_at).toLocaleString("en-NG")} <span className="font-normal text-ink-soft">({p.method} {p.method_version})</span></p>
      <p>{p.result.status === "ok" ? `Estimate based on ${p.result.coverage.statesIncluded} of ${p.result.coverage.statesTotal} states (${p.result.coverage.unitsReporting.toLocaleString("en-NG")} units reporting).` : `No estimate: ${p.result.reason}`}</p>
      <p className="text-ink-soft">{p.published ? "Released to the situation room" : "Draft, not released"}</p>{p.result.status === "ok" && <PublishButton id={p.id} published={p.published} />}</li>)}</ul>}</section></div>);
}
