import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase/user";
import { generateKey, hashKey } from "@/lib/stations";
const json = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { "Cache-Control": "no-store", "Pragma": "no-cache" } });
// Best-effort per-warm-instance throttle; use platform/WAF rate limiting too for multi-instance deployments.
const attempts = new Map<string, { count: number; reset: number }>();
export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  const now = Date.now(), prev = attempts.get(ip);
  if (prev && prev.reset > now && prev.count >= 12) return json({ error: "Too many pairing attempts. Wait a minute and try again." }, 429);
  attempts.set(ip, !prev || prev.reset <= now ? { count: 1, reset: now + 60_000 } : { count: prev.count + 1, reset: prev.reset });
  let b: { code?: string }; try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  const code = String(b.code ?? "").trim().toUpperCase();
  if (!/^[0-9A-F]{16}$/.test(code)) return json({ error: "Pairing code is invalid or expired." }, 401);
  const svc = serviceClient();
  const { data, error } = await svc.rpc("consume_station_pairing_code", { p_code_hash: hashKey(code) });
  const pairing = Array.isArray(data) ? data[0] : data;
  if (error || !pairing?.pairing_id || !pairing.station_label) return json({ error: "Pairing code is invalid, expired, or already used." }, 401);
  const stationKey = generateKey();
  const { data: station, error: insertError } = await svc.from("station_keys").insert({ label: pairing.station_label, key_hash: hashKey(stationKey), created_by: pairing.creator_id ?? null }).select("id,label").single();
  if (insertError || !station) return json({ error: "The code was consumed but station registration failed. Generate a new pairing code." }, 500);
  return json({ stationKey, stationId: station.id, label: station.label }, 201);
}
