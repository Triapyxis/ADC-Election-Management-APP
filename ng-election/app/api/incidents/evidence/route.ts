import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { userClient, serviceClient } from "@/lib/supabase/user";
import { evaluateGeofence } from "@/lib/geofence";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
const json = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { "Cache-Control": "no-store" } });
const MAX_IMAGE = 10 * 1024 * 1024, MAX_VIDEO = 25 * 1024 * 1024, UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validNum = (v: unknown) => typeof v === "number" && Number.isFinite(v);
function tokenOk(token: string, hash: string) { const a = createHash("sha256").update(token).digest(), b = Buffer.from(hash, "hex"); return a.length === b.length && timingSafeEqual(a, b); }
async function getUser() { const sb = await userClient(); const { data: { user } } = await sb.auth.getUser(); return { sb, user }; }
async function readBody(req: Request) { try { return await req.json(); } catch { return null; } }
/** POST creates a one-time signed upload URL bound to an authenticated live-camera session. */
export async function POST(req: Request) {
  const { user } = await getUser(); if (!user) return json({ error: "Sign in required." }, 401);
  const b: any = await readBody(req); if (!b || !UUID.test(String(b.sessionId ?? "")) || typeof b.token !== "string") return json({ error: "Valid camera capture session is required." }, 422);
  const svc = serviceClient(), now = new Date(); const { data: session } = await svc.from("polling_incident_capture_sessions").select("*").eq("id", b.sessionId).eq("agent_id", user.id).is("consumed_at", null).is("storage_path", null).gt("expires_at", now.toISOString()).maybeSingle();
  if (!session || !tokenOk(b.token, session.nonce_hash)) return json({ error: "Capture session expired, already used or invalid. Capture again." }, 409);
  const video = session.evidence_type === "incident_video", allowed = video ? ["video/webm", "video/mp4"] : ["image/jpeg"], max = video ? MAX_VIDEO : MAX_IMAGE;
  if (!allowed.includes(b.contentType) || !Number.isInteger(b.size) || b.size <= 0 || b.size > max) return json({ error: `Unsupported media. ${video ? "Live video must be WebM/MP4 under 25 MB" : "Camera photo must be JPEG under 10 MB"}.` }, 422);
  const ext = b.contentType === "image/jpeg" ? "jpg" : b.contentType === "video/mp4" ? "mp4" : "webm", path = `${user.id}/${session.election_id}/${session.polling_unit_id}/${session.id}.${ext}`;
  const { data, error } = await svc.storage.from("polling-incident-evidence").createSignedUploadUrl(path);
  if (error || !data) return json({ error: "Could not prepare private evidence upload." }, 500);
  const { data: bound, error: updateError } = await svc.from("polling_incident_capture_sessions").update({ storage_path: path }).eq("id", session.id).is("storage_path", null).is("consumed_at", null).select("id").maybeSingle();
  if (updateError || !bound) { await svc.storage.from("polling-incident-evidence").remove([path]); return json({ error: "Could not bind upload to capture session." }, 500); }
  return json({ path, uploadToken: data.token, bucket: "polling-incident-evidence" }, 201);
}
/** PUT finalizes a direct-to-private-storage upload after rechecking GPS, assignment, election lock and hash. */
export async function PUT(req: Request) {
  const { user } = await getUser(); if (!user) return json({ error: "Sign in required." }, 401);
  const b: any = await readBody(req); if (!b || !UUID.test(String(b.sessionId ?? "")) || typeof b.token !== "string" || typeof b.path !== "string") return json({ error: "Invalid incident registration." }, 422);
  const loc = b.location; if (!validNum(loc?.lat) || loc.lat < -90 || loc.lat > 90 || !validNum(loc?.lon) || loc.lon < -180 || loc.lon > 180 || !validNum(loc?.accuracyM) || loc.accuracyM < 0 || loc.accuracyM > 50 || typeof loc?.time !== "string" || !Number.isFinite(Date.parse(loc.time))) return json({ error: "Fresh final GPS with accuracy of 50 metres or better is required." }, 422);
  const svc = serviceClient(), now = new Date(); const { data: session } = await svc.from("polling_incident_capture_sessions").select("*").eq("id", b.sessionId).eq("agent_id", user.id).eq("storage_path", b.path).is("consumed_at", null).gt("expires_at", now.toISOString()).maybeSingle();
  if (!session || !tokenOk(b.token, session.nonce_hash)) return json({ error: "Capture session expired, already used or invalid." }, 409);
  const { data: assignment } = await svc.from("assignments").select("id,polling_unit_id,status,starts_at,expires_at").eq("id", session.assignment_id).eq("agent_id", user.id).eq("polling_unit_id", session.polling_unit_id).eq("status", "active").lte("starts_at", now.toISOString()).gte("expires_at", now.toISOString()).maybeSingle(); if (!assignment) return json({ error: "Polling-unit assignment is no longer active." }, 403);
  const { data: access } = await svc.from("election_agent_access").select("access_mode,opens_at,closes_at").eq("election_id", session.election_id).eq("contest_type", session.contest_type).maybeSingle();
  const open = access && (access.access_mode === "open" || (access.access_mode === "scheduled" && access.opens_at && access.closes_at && now >= new Date(access.opens_at) && now < new Date(access.closes_at))); if (!open) return json({ error: "Incident capture has been locked for this election type." }, 423);
  const { data: pu } = await svc.from("polling_units").select("latitude,longitude,geocode_status").eq("id", session.polling_unit_id).single(); const target = { lat: pu?.latitude ?? null, lon: pu?.longitude ?? null, geocodeStatus: pu?.geocode_status ?? "pending" }, policy = { radiusM: 200, maxAccuracyM: 50, maxEvidenceAgeS: 120 };
  const g = evaluateGeofence({ lat: loc.lat, lon: loc.lon, accuracyM: loc.accuracyM, locationTime: new Date(loc.time), receivedAt: now }, target, policy); if (g.outcome !== "within_radius") return json({ error: `Final geofence check failed: ${g.outcome}. Evidence was not accepted.`, geofence: g }, 403);
  const video = session.evidence_type === "incident_video"; let trail: any[] = [];
  if (video) { if (!Array.isArray(b.locationTrail) || b.locationTrail.length < 1 || b.locationTrail.length > 30) return json({ error: "Video must include GPS samples recorded during filming." }, 422); trail = b.locationTrail; for (const p of trail) { const t = new Date(p?.time), check = evaluateGeofence({ lat: Number(p?.lat), lon: Number(p?.lon), accuracyM: Number(p?.accuracyM), locationTime: t, receivedAt: now }, target, policy); if (check.outcome !== "within_radius") return json({ error: `Video GPS trail failed: ${check.outcome}. Evidence was not accepted.`, geofence: check }, 403); } }
  const category = String(b.incidentCategory ?? "other"), severity = String(b.severity ?? "medium"), description = String(b.description ?? "").trim().slice(0, 4000);
  if (!["violence_or_threat","result_interference","intimidation","process_irregularity","access_or_materials","other"].includes(category) || !["low","medium","high","critical"].includes(severity) || !description) return json({ error: "A valid category, severity and incident description are required." }, 422);
  const { data: listed } = await svc.storage.from("polling-incident-evidence").list(`${user.id}/${session.election_id}/${session.polling_unit_id}`, { limit: 100 }); const basename = b.path.split("/").pop(); const obj = listed?.find(o => o.name === basename); const size = Number((obj?.metadata as any)?.size), type = String((obj?.metadata as any)?.mimetype ?? ""), max = video ? MAX_VIDEO : MAX_IMAGE, allowed = video ? ["video/webm","video/mp4"] : ["image/jpeg"];
  if (!obj || !allowed.includes(type) || !(size > 0 && size <= max)) { await svc.storage.from("polling-incident-evidence").remove([b.path]); return json({ error: "Stored media is not an allowed live-camera file or exceeds the size limit." }, 422); }
  const { data: file, error: downloadError } = await svc.storage.from("polling-incident-evidence").download(b.path); if (downloadError || !file) return json({ error: "Could not verify stored evidence bytes." }, 500); const bytes = Buffer.from(await file.arrayBuffer()), sha256 = createHash("sha256").update(bytes).digest("hex");
  const capturedAtMs = Date.parse(String(b.capturedAt ?? ""));
  if (!Number.isFinite(capturedAtMs)) { await svc.storage.from("polling-incident-evidence").remove([b.path]); return json({ error: "Camera capture/recording start timestamp metadata is required." }, 422); }
  const clientCapturedAt = new Date(capturedAtMs).toISOString();
  const trailJson = (video ? trail : [session.initial_lat != null ? { lat: session.initial_lat, lon: session.initial_lon, accuracyM: session.initial_accuracy_m, time: session.initial_location_time } : null, { lat: loc.lat, lon: loc.lon, accuracyM: loc.accuracyM, time: new Date(loc.time).toISOString() }]).filter(Boolean);
  const device = b.deviceMetadata && typeof b.deviceMetadata === "object" ? {
    platform: typeof b.deviceMetadata.platform === "string" ? b.deviceMetadata.platform.slice(0, 120) : null,
    language: typeof b.deviceMetadata.language === "string" ? b.deviceMetadata.language.slice(0, 40) : null,
    userAgent: typeof b.deviceMetadata.userAgent === "string" ? b.deviceMetadata.userAgent.slice(0, 500) : null,
  } : {};
  const recordingStartedAt = video && clientCapturedAt ? clientCapturedAt : null;
  const endedMs = Date.parse(String(b.recordingEndedAt ?? ""));
  if (video && !Number.isFinite(endedMs)) { await svc.storage.from("polling-incident-evidence").remove([b.path]); return json({ error: "Video recording end timestamp metadata is required." }, 422); }
  const recordingEndedAt = video ? new Date(endedMs).toISOString() : null;
  const recordingDurationSeconds = video && recordingStartedAt ? Math.max(0, Math.min(90, Math.round((Date.parse(recordingEndedAt!) - Date.parse(recordingStartedAt)) / 1000))) : null;
  const { data: incident, error } = await svc.from("polling_incidents").insert({
    agent_id: user.id, assignment_id: session.assignment_id, polling_unit_id: session.polling_unit_id, election_id: session.election_id,
    contest_type: session.contest_type, evidence_type: session.evidence_type, incident_category: category, severity, description,
    storage_path: b.path, content_type: type, size_bytes: size, sha256, capture_method: "in_app_live_camera", capture_session_id: session.id,
    client_captured_at: clientCapturedAt, server_received_at: now.toISOString(), reported_lat: loc.lat, reported_lon: loc.lon,
    reported_accuracy_m: loc.accuracyM, location_time: new Date(loc.time).toISOString(), distance_m: g.distanceM, geofence_outcome: g.outcome,
    initial_lat: session.initial_lat, initial_lon: session.initial_lon, initial_accuracy_m: session.initial_accuracy_m,
    initial_location_time: session.initial_location_time, initial_distance_m: session.initial_distance_m,
    location_trail: trailJson, recording_started_at: recordingStartedAt, recording_ended_at: recordingEndedAt,
    recording_duration_seconds: recordingDurationSeconds,
    device_metadata: { ...device, serverUserAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null },
    evidence_metadata: { metadataVersion: 1, source: "in_app_camera", clientReportedCapturedAt: clientCapturedAt, serverReceiptAuthoritative: true }
  }).select("id,verification_status,server_received_at,sha256,capture_session_id,recording_duration_seconds").single();
  if (error || !incident) { await svc.storage.from("polling-incident-evidence").remove([b.path]); return json({ error: "Incident could not be registered." }, 500); }
  await svc.from("polling_incident_capture_sessions").update({ consumed_at: now.toISOString() }).eq("id", session.id).is("consumed_at", null);
  await svc.from("polling_incident_audit").insert({ incident_id: incident.id, actor_id: user.id, action: "incident_submitted", detail: { evidence_type: session.evidence_type, sha256, content_type: type, size_bytes: bytes.length, geofence_outcome: g.outcome, distance_m: g.distanceM, location_samples: video ? trail.length : 1 } });
  return json({ incident, message: "Incident received and queued for independent review." }, 201);
}
