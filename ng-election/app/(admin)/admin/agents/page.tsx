import { userClient } from "@/lib/supabase/user";
import { dutyStatus, agoLabel } from "@/lib/roster";
export const dynamic = "force-dynamic";
const STAFF = ["supervisor", "lga_coordinator", "state_admin", "election_admin", "super_admin"];
const DUTY = { no_assignment: "No active assignment", never_checked: "Assigned, no check yet", on_duty: "Checked in recently", overdue: "No check in over 20 min" } as const;
const OUT: Record<string, string> = { within_radius: "At unit", outside_radius: "Outside radius", poor_accuracy: "Poor accuracy", gps_missing: "No GPS", stale_location: "Stale", pu_coordinates_unverified: "Unit unverified", pu_coordinates_missing: "Unit location missing" };

export default async function Agents({ searchParams }: { searchParams: Promise<{ q?: string; show?: string }> }) {
  const { q = "", show = "all" } = await searchParams; const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user?.id ?? "");
  if (!roles?.some((r) => STAFF.includes(r.role))) return <section><h1 className="text-2xl font-semibold">Not available</h1><p className="mt-2 text-ink-soft">The agent roster is for supervisors and administrators.</p></section>;
  const { data, error } = await sb.rpc("staff_agent_roster");
  if (error) return <section><h1 className="text-2xl font-semibold">Roster unavailable</h1><p className="mt-2 text-ink-soft">Could not load agents. Reload to try again.</p></section>;
  const now = new Date();
  const rows = ((data ?? []) as any[]).map((r) => ({ ...r, duty: dutyStatus(Number(r.active_assignments), r.last_check_at, now) }))
    .filter((r) => (!q || r.email.toLowerCase().includes(q.toLowerCase())) && (show === "all" || r.duty === show));
  const n = (v: unknown) => Number(v).toLocaleString("en-NG");
  return (<div><h1 className="text-2xl font-semibold">Field agents</h1>
    <p className="mt-1 max-w-prose text-sm text-ink-soft">Agents assigned within your area. An overdue check is a prompt to call, not proof of a problem: phones lock, lose signal or run out of battery.</p>
    <form className="mt-4 flex flex-wrap items-end gap-3 text-sm"><label>Search email<input name="q" defaultValue={q} className="mt-1 block border border-rule bg-paper-raised px-3 py-1.5" /></label>
      <label>Show<select name="show" defaultValue={show} className="mt-1 block border border-rule bg-paper-raised px-3 py-1.5"><option value="all">All</option>{Object.entries(DUTY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label><button className="bg-green px-4 py-1.5 text-white">Apply</button></form>
    {!rows.length ? <p className="mt-6 text-ink-soft">No agents match.</p> : <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[46rem] text-left text-sm"><thead className="text-ink-soft"><tr><th className="py-1">Agent</th><th>Duty</th><th>Last check</th><th className="text-right">Submitted</th><th className="text-right">Verified</th><th className="text-right">Pending</th><th className="text-right">Rejected</th><th className="text-right">Location flags</th></tr></thead>
      <tbody className="divide-y divide-rule">{rows.map((r) => <tr key={r.agent_id}><td className="py-2">{r.email}</td><td>{DUTY[r.duty as keyof typeof DUTY]}</td><td>{agoLabel(r.last_check_at, now)}{r.last_outcome ? `, ${OUT[r.last_outcome] ?? r.last_outcome}` : ""}</td>{[r.submissions, r.verified, r.pending, r.rejected, r.flagged_checks].map((v, i) => <td key={i} className="text-right tabular-nums">{n(v)}</td>)}</tr>)}</tbody></table></div>}</div>);
}
