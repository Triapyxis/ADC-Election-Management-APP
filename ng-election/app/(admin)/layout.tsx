
import Link from "next/link";
import { userClient } from "@/lib/supabase/user";
import { ADMIN_ROLES, appsForRoles, linksForRoles } from "@/lib/nav";

/** ADMIN APP: coordinates users, setup, verification, agents, locations and projections. */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sb = await userClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const { data } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", user?.id ?? "");

  const roles = (data ?? []).map((r) => r.role);
  const ok = roles.some((r) => ADMIN_ROLES.includes(r));
  const mods = linksForRoles(roles);
  const others = appsForRoles(roles).filter(
    (a) => a.href !== "/admin"
  );

  return (
    <div className="min-h-screen bg-paper md:grid md:grid-cols-[260px_1fr]">
      <aside className="flex flex-col border-b border-brand-deep bg-brand-forest text-white md:min-h-screen md:border-b-0">
        <div className="border-b border-white/10 px-5 py-5">
          <Link href="/admin" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-mint text-lg font-bold text-brand-forest">
              N
            </span>
            <span>
              <span className="block font-bold tracking-tight">
                Election Monitor
              </span>
              <span className="block text-xs text-white/60">
                Operations centre
              </span>
            </span>
          </Link>
        </div>

        <div className="px-5 pb-2 pt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-sage">
            Workspace
          </p>
        </div>

        <nav
          aria-label="Admin modules"
          className="flex-1 px-3 pb-4 text-sm"
        >
          <ul className="flex flex-wrap gap-1 md:block">
            {mods.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="block rounded-lg px-3 py-2.5 text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-white/10 px-5 py-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-sage">
            Other applications
          </p>

          <div className="space-y-1">
            {others.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="block py-1 text-sm text-white/70 transition hover:text-white"
              >
                {a.label}
              </Link>
            ))}
          </div>

          <form action="/logout" method="post" className="mt-5">
            <button className="w-full rounded-lg border border-white/20 px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-white">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="flex items-center justify-between border-b border-rule bg-white px-5 py-4 sm:px-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-brand-action">
              Election operations
            </p>
            <p className="mt-1 text-sm font-semibold text-brand-forest">
              Administration workspace
            </p>
          </div>
          <span className="rounded-full border border-brand-mint bg-brand-mint/50 px-3 py-1 text-xs font-semibold text-brand-primary">
            Secure workspace
          </span>
        </header>

        <main className="px-4 py-6 sm:px-8 sm:py-8">
          {ok ? (
            children
          ) : (
            <section className="rounded-2xl border border-rule bg-white p-6 shadow-card">
              <h1 className="text-2xl font-bold text-brand-forest">
                Not available
              </h1>
              <p className="mt-2 text-ink-soft">
                Admin is for administrators, supervisors and verifiers.
              </p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
