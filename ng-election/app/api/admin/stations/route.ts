import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase/user";
import { generateKey, hashKey, validateLabel } from "@/lib/stations";
const json = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { "Cache-Control": "no-store" } });
/** Issue a key for a laptop. The key is returned ONCE; only its hash is stored. RLS limits this to election/super admins. */
export async function POST(req: Request) {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser(); if (!user) return json({ error: "Sign in required." }, 401);
  let b: { label?: string }; try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  const issues = validateLabel(b.label); if (issues.length) return json({ error: "Validation failed.", issues }, 422);
  const key = generateKey();
  const { error } = await sb.from("station_keys").insert({ label: b.label!.trim(), key_hash: hashKey(key), created_by: user.id });
  return error ? json({ error: "Not permitted to issue station keys." }, 403) : json({ key }, 201);
}
export async function PATCH(req: Request) {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser(); if (!user) return json({ error: "Sign in required." }, 401);
  let b: { id?: string }; try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  if (!b.id || !/^[0-9a-f-]{36}$/i.test(b.id)) return json({ error: "id required." }, 422);
  const { data, error } = await sb.from("station_keys").update({ revoked_at: new Date().toISOString(), revoked_by: user.id }).eq("id", b.id).is("revoked_at", null).select("id");
  return error || !data?.length ? json({ error: "Not permitted, or already revoked." }, 403) : json({ ok: true });
}
