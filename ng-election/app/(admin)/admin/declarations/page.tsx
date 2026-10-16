import { userClient } from "@/lib/supabase/user";
import { AdminForm } from "@/components/AdminForm";
export const dynamic = "force-dynamic";

export default async function Declarations() {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user?.id ?? "");
  if (!roles?.some((r) => r.role === "election_admin" || r.role === "super_admin")) return <section><h1 className="text-2xl font-semibold">Not available</h1><p className="mt-2 text-ink-soft">Declarations are recorded by election administrators.</p></section>;
  const [cs, ds] = await Promise.all([
    sb.from("contests").select("id,name,candidates(id,full_name,parties(abbreviation))").order("name").limit(50),
    sb.from("declarations").select("contest_id,candidate_id,source_reference").is("revoked_at", null)]);
  const done = new Map((ds.data ?? []).map((d) => [d.contest_id, d]));
  return (<div><h1 className="text-2xl font-semibold">Official declarations</h1>
    <p className="mt-1 max-w-prose text-sm text-ink-soft">Record a declaration only from an official source, and cite it. This does not change any vote count. Declarations can be revoked, never deleted.</p>
    <ul className="mt-6 divide-y divide-rule border-y border-rule">{((cs.data ?? []) as any[]).map((c) => { const d = done.get(c.id); return (<li key={c.id} className="py-4"><p className="font-medium">{c.name}</p>
      {d ? <><p className="text-sm">Declared: {c.candidates.find((x: any) => x.id === d.candidate_id)?.full_name}. Source: {d.source_reference}</p>
          <details className="mt-2"><summary className="cursor-pointer text-sm text-green underline">Revoke</summary><div className="mt-2"><AdminForm endpoint="/api/declarations" method="PATCH" fixed={{ contestId: c.id }} fields={[{ name: "reason", label: "Reason for revoking" }]} submit="Revoke declaration" /></div></details></>
        : <details className="mt-2"><summary className="cursor-pointer text-sm text-green underline">Record declaration</summary><div className="mt-2"><AdminForm endpoint="/api/declarations" fixed={{ contestId: c.id }} fields={[{ name: "candidateId", label: "Declared winner", type: "select", options: c.candidates.map((x: any) => ({ value: x.id, label: `${x.parties?.abbreviation}: ${x.full_name}` })) }, { name: "sourceReference", label: "Official source reference" }]} submit="Record declaration" /></div></details>}</li>); })}</ul></div>);
}
