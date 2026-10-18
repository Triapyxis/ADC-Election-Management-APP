import { userClient } from "@/lib/supabase/user";
import { ElectionAccessControls } from "@/components/ElectionAccessControls";
import { CONTEST_TYPES, TYPE_LABEL } from "@/lib/seats";
export const dynamic = "force-dynamic";

export default async function ElectionAccessPage() {
  const sb = await userClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: roleRows } = await sb.from("user_roles").select("role").eq("user_id", user?.id ?? "");
  if (!roleRows?.some((r) => r.role === "super_admin" || r.role === "election_admin")) return <section><h1 className="text-2xl font-semibold">Not available</h1><p className="mt-2 text-sm text-ink-soft">Only the Super Admin and Election Admin can open or lock agent access.</p></section>;
  const [{ data: elections, error: electionError }, { data: controls, error: controlError }] = await Promise.all([
    sb.from("elections").select("id,name,election_date").order("election_date", { ascending: false }).limit(100),
    sb.from("election_agent_access").select("id,election_id,contest_type,access_mode,opens_at,closes_at,reason,updated_at,updated_by").order("updated_at", { ascending: false }),
  ]);
  const contestTypes = CONTEST_TYPES.map((value) => ({ value, label: TYPE_LABEL[value] }));
  return <div className="space-y-6"><header><h1 className="text-2xl font-semibold">Election-Day Agent Access</h1><p className="mt-2 max-w-3xl text-sm text-ink-soft">Open or lock agent submissions independently for each election type. Scheduled mode opens and closes automatically using Nigeria local time entered in this form. Manual open/lock overrides the schedule. New election types are locked until explicitly configured.</p></header>
    {electionError && <p role="alert" className="rounded border border-status-disputed p-3 text-sm">Could not load elections. Check database access and try again.</p>}
    {controlError && <p role="alert" className="rounded border border-status-disputed p-3 text-sm">Could not load access controls. Apply migration 0024_election_agent_access_controls.sql in Supabase, then reload this page.</p>}
    {!controlError && <ElectionAccessControls elections={elections ?? []} controls={(controls ?? []) as any} contestTypes={contestTypes} />}
  </div>;
}
