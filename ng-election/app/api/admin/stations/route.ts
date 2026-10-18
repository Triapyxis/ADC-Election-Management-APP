import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { userClient, serviceClient } from "@/lib/supabase/user";
import { hashKey, validateLabel } from "@/lib/stations";
const json = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { "Cache-Control": "no-store" } });
const allowed = ["election_admin", "super_admin", "station_system_admin"];
async function access() {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user.id);
  return roles?.some((r) => allowed.includes(r.role)) ? { sb, user, roles: roles.map((r) => r.role) } : null;
}
/** Create a single-use pairing code; the code itself is returned once and only its hash is stored. */
export async function POST(req: Request) {
  const a = await access(); if (!a) return json({ error: "Not authorised to manage Situation Room stations." }, 403);
  let b: { label?: string }; try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  const issues = validateLabel(b.label); if (issues.length) return json({ error: "Validation failed.", issues }, 422);
  const code = randomBytes(8).toString("hex").toUpperCase();
  const svc = serviceClient();
  const { error } = await svc.from("station_pairing_codes").insert({ label: b.label!.trim(), code_hash: hashKey(code), created_by: a.user.id, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
  return error ? json({ error: "Could not create a pairing code." }, 500) : json({ code, expiresInSeconds: 600 }, 201);
}
export async function PATCH(req: Request) {
  const a = await access(); if (!a) return json({ error: "Not authorised to manage Situation Room stations." }, 403);
  let b: { id?: string }; try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  if (!b.id || !/^[0-9a-f-]{36}$/i.test(b.id)) return json({ error: "id required." }, 422);
  const { data, error } = await serviceClient().from("station_keys").update({ revoked_at: new Date().toISOString(), revoked_by: a.user.id }).eq("id", b.id).is("revoked_at", null).select("id");
  return error || !data?.length ? json({ error: "Not permitted, or already revoked." }, 403) : json({ ok: true });
}
