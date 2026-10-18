import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { userClient, serviceClient } from "@/lib/supabase/user";
import { evaluateGeofence } from "@/lib/geofence";
const json = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { "Cache-Control": "no-store" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
export async function POST(req: Request) {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser(); if (!user) return json({ error: "Sign in required." }, 401);
  let b: any; try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  if (!UUID.test(String(b?.assignmentId ?? "")) || !UUID.test(String(b?.electionId ?? "")) || typeof b?.contestType !== "string" || !["presidential","governorship","senatorial","house_of_reps","state_assembly"].includes(b.contestType) || !["incident_photo","incident_video"].includes(b.evidenceType)) return json({ error: "Invalid incident capture request." }, 422);
  const l = b.location; if (!num(l?.lat) || l.lat < -90 || l.lat > 90 || !num(l?.lon) || l.lon < -180 || l.lon > 180 || !num(l?.accuracyM) || l.accuracyM < 0 || l.accuracyM > 50 || typeof l?.time !== "string" || !Number.isFinite(Date.parse(l.time))) return json({ error: "Fresh GPS with accuracy of 50 metres or better is required." }, 422);
  const svc = serviceClient(), now = new Date();
  const { data: assignment } = await svc.from("assignments").select("id,agent_id,polling_unit_id,starts_at,expires_at,status").eq("id", b.assignmentId).eq("agent_id", user.id).eq("status", "active").lte("starts_at", now.toISOString()).gte("expires_at", now.toISOString()).maybeSingle();
  if (!assignment) return json({ error: "No active polling-unit assignment for this account." }, 403);
  const { data: role } = await svc.from("user_roles").select("role").eq("user_id", user.id).eq("role", "field_agent").maybeSingle(); if (!role) return json({ error: "Polling-unit field-agent role required." }, 403);
  const { data: election } = await svc.from("elections").select("id").eq("id", b.electionId).maybeSingle(); if (!election) return json({ error: "Election not found." }, 404);
  const { data: access } = await svc.from("election_agent_access").select("access_mode,opens_at,closes_at").eq("election_id", b.electionId).eq("contest_type", b.contestType).maybeSingle();
  const open = access && (access.access_mode === "open" || (access.access_mode === "scheduled" && access.opens_at && access.closes_at && now >= new Date(access.opens_at) && now < new Date(access.closes_at)));
  if (!open) return json({ error: "Incident capture is locked for this election type." }, 423);
  const { data: pu } = await svc.from("polling_units").select("id,latitude,longitude,geocode_status").eq("id", assignment.polling_unit_id).single();
  if (!pu) return json({ error: "Assigned polling unit not found." }, 404);
  const g = evaluateGeofence({ lat: l.lat, lon: l.lon, accuracyM: l.accuracyM, locationTime: new Date(l.time), receivedAt: now }, { lat: pu.latitude, lon: pu.longitude, geocodeStatus: pu.geocode_status });
  if (g.outcome !== "within_radius") return json({ error: `Initial geofence check failed: ${g.outcome}. Incident evidence must be captured at the assigned polling unit.`, geofence: g }, 403);
  const token = randomBytes(32).toString("base64url");
  const { data: session, error } = await svc.from("polling_incident_capture_sessions").insert({ agent_id: user.id, assignment_id: assignment.id, polling_unit_id: pu.id, election_id: b.electionId, contest_type: b.contestType, evidence_type: b.evidenceType, nonce_hash: createHash("sha256").update(token).digest("hex"), expires_at: new Date(now.getTime() + 3 * 60 * 1000).toISOString(), initial_lat: l.lat, initial_lon: l.lon, initial_accuracy_m: l.accuracyM, initial_location_time: new Date(l.time).toISOString(), initial_distance_m: g.distanceM, initial_geofence_outcome: g.outcome }).select("id,expires_at").single();
  if (error || !session) return json({ error: "Could not start secure incident capture." }, 500);
  await svc.from("polling_incident_audit").insert({ incident_id: null, actor_id: user.id, action: "capture_session_issued", detail: { session_id: session.id, assignment_id: assignment.id, polling_unit_id: pu.id, election_id: b.electionId, contest_type: b.contestType, evidence_type: b.evidenceType, distance_m: g.distanceM } });
  return json({ sessionId: session.id, token, expiresAt: session.expires_at }, 201);
}
