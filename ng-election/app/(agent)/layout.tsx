import { userClient } from "@/lib/supabase/user";
/** AGENT APP: phone-first, one task. */
export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  const { data } = await sb.from("user_roles").select("role").eq("user_id", user?.id ?? "").eq("role", "field_agent").maybeSingle();
  return (<><header className="bg-green text-white"><div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3"><span className="font-semibold">Field agent</span><form action="/logout" method="post"><button className="text-sm underline">Sign out</button></form></div></header>
    <main className="mx-auto max-w-xl px-4 py-6">{data ? children : <section><h1 className="text-2xl font-semibold">Not available</h1><p className="mt-2 text-ink-soft">This app is for field agents. Ask a supervisor for access.</p></section>}</main></>);
}
