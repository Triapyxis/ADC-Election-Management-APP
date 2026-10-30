
import Link from "next/link";
import { userClient } from "@/lib/supabase/user";
import { Ticker } from "@/components/Ticker";
import { LiveRefresh } from "@/components/LiveRefresh";
import { CivicActions } from "@/components/CivicActions";

/** PUBLIC RESULT TRACKER: verified results and official declarations only. */
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let signedIn = false;

  try {
    signedIn = !!(await (await userClient()).auth.getUser()).data.user;
  } catch {
    // Public results remain accessible if authentication is unavailable.
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-30 border-b border-rule bg-white/95 shadow-card backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="group flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-forest text-lg font-bold text-white shadow-card">
              N
            </span>
            <span>
              <span className="block text-base font-bold tracking-tight text-brand-forest">
                Nigeria Election Monitor
              </span>
              <span className="block text-xs text-ink-soft">
                Independent election results &amp; monitoring
              </span>
            </span>
          </Link>

          <nav
            aria-label="Primary navigation"
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            <Link
              href="/"
              className="rounded-lg px-3 py-2 font-medium text-ink-soft transition hover:bg-brand-mint hover:text-brand-forest"
            >
              Overview
            </Link>

            <Link
              href="/contests"
              className="rounded-lg px-3 py-2 font-medium text-ink-soft transition hover:bg-brand-mint hover:text-brand-forest"
            >
              Contests
            </Link>

            {signedIn ? (
              <Link
                href="/account"
                className="rounded-lg bg-brand-forest px-4 py-2 font-semibold text-white transition hover:bg-brand-primary"
              >
                My account
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-lg bg-brand-forest px-4 py-2 font-semibold text-white transition hover:bg-brand-primary"
              >
                Staff sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <Ticker />

      <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-10">
        <CivicActions />
        {children}
      </main>

      <footer className="mt-12 border-t border-rule bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            Nigeria Election Monitor · Verified results and official
            declarations.
          </p>
          <LiveRefresh />
        </div>
      </footer>
    </div>
  );
}
