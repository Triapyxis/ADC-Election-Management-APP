import { userClient, serviceClient } from "@/lib/supabase/user";
import { CreateUserForm, UserActions } from "@/components/UserForms";
import { ROLE_LABEL } from "@/lib/users";
export const dynamic = "force-dynamic";

export default async function Users() {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  const { data: mine } = await sb.from("user_roles").select("role").eq("user_id", user?.id ?? "").eq("role", "super_admin").maybeSingle();
  if (!mine) return <section><h1 className="text-2xl font-semibold">Not available</h1><p className="mt-2 text-ink-soft">Only a super administrator can manage users and access.</p></section>;
  const [list, roles, st] = await Promise.all([serviceClient().auth.admin.listUsers({ perPage: 200 }), sb.from("user_roles").select("user_id,role,state_id,lga_id,states(name),lgas(name)"), sb.from("states").select("id,name").order("name")]);
  if (list.error) return <section><h1 className="text-2xl font-semibold">Users unavailable</h1><p className="mt-2 text-ink-soft">Could not load users. Reload to try again.</p></section>;
  const by = new Map<string, any[]>(); for (const r of (roles.data ?? []) as any[]) (by.get(r.user_id) ?? by.set(r.user_id, []).get(r.user_id)!).push(r);
  const states = (st.data ?? []) as { id: string; name: string }[];
  return (<div className="space-y-10"><header><h1 className="text-2xl font-semibold">Users and access</h1>
    <p className="mt-1 max-w-prose text-sm text-ink-soft">Everyone signs in with a password. Create a login, choose a role and the area they cover, and they see only the modules for that role. A role is a task: agents submit results, verifiers check them, supervisors manage agents. Assign polling units to agents on the Assignments page.</p></header>
    <section><h2 className="text-lg font-semibold">Add a person</h2><div className="mt-3"><CreateUserForm states={states} /></div></section>
    <section><h2 className="text-lg font-semibold">People ({list.data.users.length})</h2>
      <ul className="mt-3 divide-y divide-rule border-y border-rule">{list.data.users.map((u) => { const rs = by.get(u.id) ?? []; const banned = !!(u as any).banned_until && Date.parse((u as any).banned_until) > Date.now(); return (
        <li key={u.id} className="space-y-1 py-3"><p className="font-medium">{u.email}{banned && <span className="ml-2 text-sm font-normal text-status-disputed">Disabled</span>}{u.id === user?.id && <span className="ml-2 text-sm font-normal text-ink-soft">(you)</span>}</p>
          <p className="text-sm text-ink-soft">{rs.length ? rs.map((r) => `${ROLE_LABEL[r.role as keyof typeof ROLE_LABEL] ?? r.role}${r.states?.name ? `, ${r.states.name}` : ""}${r.lgas?.name ? `, ${r.lgas.name}` : ""}`).join(" · ") : "No role: can sign in but cannot open any module."}</p>
          <p className="text-xs text-ink-faint">Last sign-in {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("en-NG") : "never"}</p>
          <UserActions userId={u.id} banned={banned} self={u.id === user?.id} roles={rs.map((r) => r.role)} states={states} /></li>); })}</ul></section></div>);
}
