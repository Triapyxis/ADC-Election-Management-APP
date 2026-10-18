import { userClient } from "@/lib/supabase/user";
import type { ReactNode } from "react";
export default async function CollationLayout({ children }: { children: ReactNode }) {
  const sb = await userClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: role } = await sb.from("user_roles").select("role").eq("user_id", user?.id ?? "").eq("role", "collation_agent").maybeSingle();
  return <><header className="bg-green text-white"><div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3"><div><div className="font-semibold">Collation Centre Agent</div><div className="text-xs text-white/80">EC8A evidence and incident reporting</div></div><form action="/logout" method="post"><button className="text-sm underline">Sign out</button></form></div></header><main className="mx-auto max-w-2xl space-y-5 px-4 py-6">{role ? children : <section><h1 className="text-2xl font-semibold">Access not enabled</h1><p className="mt-2 text-ink-soft">This separate app is for authorized collation-centre agents. Ask your election administrator to grant the role and assign a centre.</p></section>}</main></>;
}
