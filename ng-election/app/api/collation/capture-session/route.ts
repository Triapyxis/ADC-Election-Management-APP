import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { userClient, serviceClient } from "@/lib/supabase/user";
import { evaluateGeofence } from "@/lib/geofence";

const json = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { "Cache-Control": "no-store" } });
const validCoord = (n: unknown, min: number, max: number): n is number => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;

export async function POST(req: Request) {
  const sb = await userClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  let b: any; try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  if (!b?.centreId || !/^[0-9a-f-]{36}$/i.test(String(b.centreId)) || !b?.evidenceType || !["ec8a", "incident_photo", "incident_video"].includes(b.evidenceType)) return json({ error: "Choose a valid evidence type." }, 422);
  const l = b.location;
  if (!validCoord(l?.lat, -90, 90) || !validCoord(l?.lon, -180, 180) || !validCoord(l?.accuracyM, 0, 50) || typeof l?.time !== "string") return json({ error: "A fresh GPS reading with accuracy of 50 metres or better is required." }, 422);
  const locationTime = new Date(l.time);
  if (!Number.isFinite(locationTime.getTime())) return json({ error: "Invalid GPS timestamp." }, 422);
  const svc = serviceClient();
  const now = new Date();
  const { data: assignment } = await svc.from("collation_assignments").select("id,agent_id,centre_id,starts_at,expires_at,status,collation_centres(id,election_id,contest_type,name,latitude,longitude,geocode_status,geofence_radius_m,active)").eq("agent_id", user.id).eq("status", "active").lte("starts_at", now.toISOString()).gt("expires_at", now.toISOString());
  const a = (assignment ?? []).find((x: any) => x.centre_id === b.centreId && x.collation_centres?.active === true);
  if (!a) return json({ error: "No active collation-centre assignment. Contact your election administrator." }, 403);
  const c: any = a.collation_centres;
  if (c.geocode_status !== "verified") return json({ error: "This centre's coordinates have not been verified. Contact an administrator." }, 409);
  const { data: role } = await svc.from("user_roles").select("role").eq("user_id", user.id).eq("role", "collation_agent").maybeSingle();
  if (!role) return json({ error: "Collation-centre agent role required." }, 403);
  const { data: access } = await svc.from("election_agent_access").select("access_mode,opens_at,closes_at").eq("election_id", c.election_id).eq("contest_type", c.contest_type).maybeSingle();
  const open = access && (access.access_mode === "open" || (access.access_mode === "scheduled" && access.opens_at && access.closes_at && now >= new Date(access.opens_at) && now < new Date(access.closes_at)));
  if (!open) return json({ error: "Collation evidence capture is closed for this election type." }, 423);
  const g = evaluateGeofence({ lat: l.lat, lon: l.lon, accuracyM: l.accuracyM, locationTime, receivedAt: now }, { lat: c.latitude, lon: c.longitude, geocodeStatus: c.geocode_status }, { radiusM: c.geofence_radius_m, maxAccuracyM: 50, maxEvidenceAgeS: 120 });
  if (g.outcome !== "within_radius") return json({ error: `Geofence check failed: ${g.outcome}. Move to the assigned centre and retry.`, geofence: g }, 403);
  const token = randomBytes(32).toString("base64url");
  const { data: session, error } = await svc.from("collation_capture_sessions").insert({
    agent_id: user.id, assignment_id: a.id, centre_id: c.id, election_id: c.election_id, contest_type: c.contest_type,
    evidence_type: b.evidenceType, nonce_hash: createHash("sha256").update(token).digest("hex"),
    expires_at: new Date(now.getTime() + 3 * 60 * 1000).toISOString(), initial_lat: l.lat, initial_lon: l.lon,
    initial_accuracy_m: l.accuracyM, initial_location_time: locationTime.toISOString(), initial_distance_m: g.distanceM,
    initial_geofence_outcome: "within_radius"
  }).select("id,expires_at").single();
  if (error || !session) return json({ error: "Could not start a secure capture session." }, 500);
  await svc.from("collation_evidence_audit").insert({ actor_id: user.id, action: "capture_session_issued", detail: { session_id: session.id, centre_id: c.id, election_id: c.election_id, evidence_type: b.evidenceType, initial_geofence_outcome: g.outcome, distance_m: g.distanceM } });
  return json({ sessionId: session.id, token, expiresAt: session.expires_at, centreName: c.name, radiusM: c.geofence_radius_m }, 201);
}
