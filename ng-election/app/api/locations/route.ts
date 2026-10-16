import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase/user";
import { validateLocation, type LocationInput } from "@/lib/location";
const json = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { "Cache-Control": "no-store" } });
/** Verify or flag a polling-unit location. Authorization = RLS + function checks (state_admin and above, in scope). */
export async function POST(req: Request) {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  let b: LocationInput; try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  const issues = validateLocation(b); if (issues.length) return json({ error: "Validation failed.", issues }, 422);
  const { error } = await sb.rpc("set_pu_location", { p_pu: b.pollingUnitId, p_lat: b.status === "verified" ? Number(b.latitude) : null, p_lon: b.status === "verified" ? Number(b.longitude) : null, p_status: b.status, p_note: b.note!.trim() });
  return error ? json({ error: "Not permitted for this polling unit, or the location was rejected." }, 403) : json({ ok: true }, 201);
}
