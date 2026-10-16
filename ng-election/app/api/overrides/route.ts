import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase/user";
const json = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { "Cache-Control": "no-store" } });
/** Supervisor override of a location flag. RLS: supervisor role + check in scope; identity and time recorded, audit trigger logs it. */
export async function POST(req: Request) {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  let b: { checkId?: string; reason?: string }; try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  if (!b.checkId) return json({ error: "checkId required." }, 422);
  if ((b.reason ?? "").trim().length < 10) return json({ error: "A reason of at least 10 characters is required." }, 422);
  const { error } = await sb.from("geofence_overrides").insert({ check_id: b.checkId, supervisor_id: user.id, reason: b.reason!.trim() });
  return error ? json({ error: "Not permitted to override this check." }, 403) : json({ ok: true }, 201);
}
