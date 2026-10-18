import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { userClient, serviceClient } from "@/lib/supabase/user";
import { evaluateGeofence } from "@/lib/geofence";
const json = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { "Cache-Control": "no-store" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const coord = (n: unknown, min: number, max: number): n is number => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
export async function POST(req: Request) {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  let b: any; try { b = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
  if (!UUID.test(String(b?.submissionId ?? ""))) return json({ error: "A valid result submission is required." }, 422);
  const l = b.location;
  if (!coord(l?.lat, -90, 90) || !coord(l?.lon, -180, 180) || !coord(l?.accuracyM, 0, 50) || typeof l?.time !== "string" || !Number.isFinite(new Date(l.time).getTime())) return json({ error: "Fresh GPS with accuracy of 50 metres or better is required." }, 422);
  const now = new Date(), nowIso = now.toISOString();
  const { data: sub } = await sb.from("result_submissions").select("id,polling_unit_id").eq("id", b.submissionId).eq("submitted_by", user.id).maybeSingle();
  if (!sub) return json({ error: "Submission not found or not owned by you." }, 403);
  const svc = serviceClient();
  const { data: assignment } = await svc.from("assignments").select("id").eq("agent_id", user.id).eq("polling_unit_id", sub.polling_unit_id).eq("status", "active").lte("starts_at", nowIso).gte("expires_at", nowIso).maybeSingle();
  if (!assignment) return json({ error: "No active assignment for this polling unit." }, 403);
  const { data: pu } = await svc.from("polling_units").select("latitude,longitude,geocode_status").eq("id", sub.polling_unit_id).single();
  const g = evaluateGeofence({ lat: l.lat, lon: l.lon, accuracyM: l.accuracyM, locationTime: new Date(l.time), receivedAt: now }, { lat: pu?.latitude ?? null, lon: pu?.longitude ?? null, geocodeStatus: pu?.geocode_status ?? "pending" });
  if (g.outcome !== "within_radius") return json({ error: `Geofence check failed: ${g.outcome}. Move to your assigned polling unit and retry.`, geofence: g }, 403);
  const token = randomBytes(32).toString("base64url");
  const { data: session, error } = await svc.from("polling_capture_sessions").insert({ agent_id: user.id, assignment_id: assignment.id, polling_unit_id: sub.polling_unit_id, submission_id: sub.id, nonce_hash: createHash("sha256").update(token).digest("hex"), initial_lat: l.lat, initial_lon: l.lon, initial_accuracy_m: l.accuracyM, initial_location_time: new Date(l.time).toISOString(), initial_distance_m: g.distanceM, expires_at: new Date(now.getTime() + 3 * 60 * 1000).toISOString() }).select("id,expires_at").single();
  if (error || !session) return json({ error: "Could not start secure camera capture." }, 500);
  return json({ sessionId: session.id, token, expiresAt: session.expires_at }, 201);
}
