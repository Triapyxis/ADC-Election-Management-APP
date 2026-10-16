import Link from "next/link";
import { userClient } from "@/lib/supabase/user";
import { ADMIN_ROLES, appsForRoles, linksForRoles } from "@/lib/nav";
/** ADMIN APP: coordinates users, setup, verification, agents, locations and projections for the other apps. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  const { data } = await sb.from("user_roles").select("role").eq("user_id", user?.id ?? ""); const roles = (data ?? []).map((r) => r.role);
  const ok = roles.some((r) => ADMIN_ROLES.includes(r)), mods = linksForRoles(roles), others = appsForRoles(roles).filter((a) => a.href !== "/admin");
  return (<div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
    <aside className="border-b border-rule bg-ink text-paper md:min-h-screen md:border-b-0 md:border-r"><div className="px-4 py-4"><Link href="/admin" className="text-base font-semibold">Admin</Link></div>
      <nav aria-label="Admin modules" className="px-2 pb-3 text-sm"><ul className="flex flex-wrap gap-x-1 md:block">{mods.map((l) => <li key={l.href}><Link href={l.href} className="block rounded px-2 py-1.5 hover:bg-white/10">{l.label}</Link></li>)}</ul></nav>
      <div className="hidden border-t border-white/15 px-4 py-3 text-xs text-paper/70 md:block"><p className="mb-1 uppercase tracking-wide">Other apps</p>{others.map((a) => <Link key={a.href} href={a.href} className="block py-1 hover:underline">{a.label}</Link>)}<form action="/logout" method="post" className="mt-3"><button className="underline">Sign out</button></form></div></aside>
    <main className="px-4 py-6 md:px-8">{ok ? children : <section><h1 className="text-2xl font-semibold">Not available</h1><p className="mt-2 text-ink-soft">Admin is for administrators, supervisors and verifiers.</p></section>}</main></div>);
}
