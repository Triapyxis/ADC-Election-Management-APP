import { userClient } from "@/lib/supabase/user";
import { AssignmentForm } from "@/components/AssignmentForm";
import { RevokeButton } from "@/components/RevokeButton";
export const dynamic = "force-dynamic";
export default async function Assignments() {
  const sb = await userClient();
  const { data } = await sb.from("assignments").select("id,starts_at,expires_at,status,polling_units(official_code,name)").order("created_at", { ascending: false }).limit(50);
  const now = Date.now();
  return (
    <div className="space-y-10">
      <section><h1 className="text-2xl font-semibold">Assign an agent</h1><p className="mt-1 max-w-prose text-sm text-ink-soft">You can only assign agents to polling units within your own area. The server checks this.</p><div className="mt-4"><AssignmentForm /></div></section>
      <section><h2 className="text-lg font-semibold">Recent assignments</h2>
        {!data?.length ? <p className="mt-2 text-ink-soft">No assignments in your area yet.</p> : (
          <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[32rem] text-left text-sm"><thead className="text-ink-soft"><tr><th className="py-1">Polling unit</th><th>Starts</th><th>Expires</th><th>State</th><th></th></tr></thead><tbody className="divide-y divide-rule">
            {(data as any[]).map((a) => { const live = a.status === "active" && Date.parse(a.starts_at) <= now && now <= Date.parse(a.expires_at); return (
              <tr key={a.id}><td className="py-2">{a.polling_units?.official_code} {a.polling_units?.name}</td><td>{new Date(a.starts_at).toLocaleString("en-NG")}</td><td>{new Date(a.expires_at).toLocaleString("en-NG")}</td><td>{a.status === "revoked" ? "Revoked" : live ? "Active" : now > Date.parse(a.expires_at) ? "Expired" : "Scheduled"}</td><td>{a.status === "active" && now <= Date.parse(a.expires_at) ? <RevokeButton id={a.id} /> : null}</td></tr>); })}
          </tbody></table></div>)}</section>
    </div>);
}
