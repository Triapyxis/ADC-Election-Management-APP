import Link from "next/link";
import { userClient } from "@/lib/supabase/user";
import { Ticker } from "@/components/Ticker";
import { LiveRefresh } from "@/components/LiveRefresh";

/** PUBLIC RESULT TRACKER: verified results and official declarations only. No projections, no broadcast tools. */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  let signedIn = false;
  try { signedIn = !!(await (await userClient()).auth.getUser()).data.user; } catch { /* env missing or no session */ }
  return (<>
    <header className="border-b border-rule bg-paper-raised"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
      <Link href="/" className="text-base font-semibold">Nigeria Election Monitor</Link>
      <nav aria-label="Primary" className="flex items-center gap-4 text-sm text-ink-soft"><Link href="/contests" className="hover:underline">Contests</Link>{signedIn ? <Link href="/account" className="hover:underline">My account</Link> : <Link href="/login" className="hover:underline">Staff sign in</Link>}</nav></div></header>
    <Ticker />
    <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    <footer className="mx-auto max-w-6xl px-4 pb-6"><LiveRefresh /></footer>
  </>);
}
