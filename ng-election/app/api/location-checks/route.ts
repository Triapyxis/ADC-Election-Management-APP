import { NextResponse } from "next/server";
import { userClient, serviceClient } from "@/lib/supabase/user";
import { evaluateGeofence } from "@/lib/geofence";
const json = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { "Cache-Control": "no-store" } });

/** Open/periodic location check. Server derives the outcome; the client's claims about distance or status are never read. */
export async function POST(req: Request) {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  let b: { pollingUnitId?: string; trigger?: string; deviceTime?: string; location?: { lat: number | null; lon: number | null; accuracyM: number | null; time: string | null } };
  try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  if (!b.pollingUnitId || (b.trigger !== "open" && b.trigger !== "periodic")) return json({ error: "pollingUnitId and trigger (open|periodic) required." }, 422);
  const nowIso = new Date().toISOString();
  const { data: a } = await sb.from("assignments").select("id").eq("agent_id", user.id).eq("polling_unit_id", b.pollingUnitId).eq("status", "active").lte("starts_at", nowIso).gte("expires_at", nowIso).maybeSingle();
  if (!a) return json({ error: "No active assignment for this polling unit." }, 403);
  const svc = serviceClient(); const { data: pu } = await svc.from("polling_units").select("latitude,longitude,geocode_status").eq("id", b.pollingUnitId).single();
  const l = b.location, receivedAt = new Date();
  const g = evaluateGeofence({ lat: l?.lat ?? null, lon: l?.lon ?? null, accuracyM: l?.accuracyM ?? null, locationTime: l?.time ? new Date(l.time) : null, receivedAt }, { lat: pu?.latitude ?? null, lon: pu?.longitude ?? null, geocodeStatus: pu?.geocode_status ?? "pending" });
  await svc.from("geofence_checks").insert({ agent_id: user.id, assignment_id: a.id, polling_unit_id: b.pollingUnitId, trigger: b.trigger, reported_lat: l?.lat ?? null, reported_lon: l?.lon ?? null, reported_accuracy_m: l?.accuracyM ?? null, location_time: l?.time ?? null, received_at: receivedAt.toISOString(), distance_m: g.distanceM, outcome: g.outcome, device_time: b.deviceTime ?? null });
  return json({ outcome: g.outcome, geofenceReady: g.geofenceReady }, 201);
}
