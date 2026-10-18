import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Everything except the public results pages needs a signed-in user. Also forces a password change after an admin-issued
 *  temporary password. This only checks "signed in"; what a person may DO is enforced by route checks and database RLS. */
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => req.cookies.getAll(), setAll: (all) => { all.forEach(({ name, value }) => req.cookies.set(name, value)); res = NextResponse.next({ request: req }); all.forEach(({ name, value, options }) => res.cookies.set(name, value, options)); } },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) { const u = req.nextUrl.clone(); u.pathname = "/login"; u.search = ""; u.searchParams.set("next", req.nextUrl.pathname); return NextResponse.redirect(u); }
  if (user.user_metadata?.must_change_password === true && !req.nextUrl.pathname.startsWith("/account/password")) { const u = req.nextUrl.clone(); u.pathname = "/account/password"; u.search = ""; return NextResponse.redirect(u); }
  return res;
}
export const config = { matcher: ["/agent/:path*", "/admin/:path*", "/account/:path*", "/collation-agent/:path*"] };
