import Link from "next/link";
import { userClient } from "@/lib/supabase/user";
import { linksForRoles } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/users";
export const dynamic = "force-dynamic";
export default async function Account() {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  const { data } = await sb.from("user_roles").select("role,states(name),lgas(name)").eq("user_id", user?.id ?? "");
  const roles = (data ?? []) as any[], links = linksForRoles(roles.map((r) => r.role));
  return (<div className="max-w-xl"><h1 className="text-2xl font-semibold">Your account</h1><p className="mt-1 text-ink-soft">{user?.email}</p>
    <p className="mt-4 text-sm">{roles.length ? roles.map((r) => `${ROLE_LABEL[r.role as keyof typeof ROLE_LABEL] ?? r.role}${r.states?.name ? `, ${r.states.name}` : ""}${r.lgas?.name ? `, ${r.lgas.name}` : ""}`).join(" · ") : "You have no role yet. Ask a super administrator to give you access."}</p>
    {links.length > 0 && <ul className="mt-6 divide-y divide-rule border-y border-rule">{links.map((l) => <li key={l.href}><Link href={l.href} className="block py-3 hover:bg-rule/30">{l.label}</Link></li>)}</ul>}
    <p className="mt-6 text-sm"><Link href="/account/password" className="text-green underline">Change password</Link></p></div>);
}
