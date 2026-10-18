import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { userClient, serviceClient } from "@/lib/supabase/user";
import { evaluateGeofence } from "@/lib/geofence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { "Cache-Control": "no-store" } });
const MAX_IMAGE = 10 * 1024 * 1024, MAX_VIDEO = 25 * 1024 * 1024;
const num = (v: FormDataEntryValue | null) => v === null ? NaN : Number(v);

export async function POST(req: Request) {
  const sb = await userClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  let form: FormData; try { form = await req.formData(); } catch { return json({ error: "Multipart camera capture required." }, 400); }
  const sessionId = String(form.get("sessionId") ?? ""), token = String(form.get("token") ?? ""), file = form.get("file");
  if (!/^[0-9a-f-]{36}$/i.test(sessionId) || token.length < 30 || !(file instanceof File)) return json({ error: "Valid capture session and camera media are required." }, 422);
  const svc = serviceClient();
  const { data: session } = await svc.from("collation_capture_sessions").select("*").eq("id", sessionId).eq("agent_id", user.id).is("consumed_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!session) return json({ error: "Capture session expired, already used or not owned by this agent. Capture again." }, 409);
  const supplied = createHash("sha256").update(token).digest(), expected = Buffer.from(session.nonce_hash, "hex");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return json({ error: "Invalid capture token." }, 403);
  const type = String(file.type || "").toLowerCase();
  const isVideo = session.evidence_type === "incident_video";
  const allowed = isVideo ? ["video/webm", "video/mp4"] : ["image/jpeg", "image/png", "image/webp"];
  const max = isVideo ? MAX_VIDEO : MAX_IMAGE;
  if (!allowed.includes(type) || file.size <= 0 || file.size > max) return json({ error: `Unsupported camera media or size. Limit: ${Math.round(max / 1024 / 1024)} MB.` }, 422);
  const location = { lat: num(form.get("lat")), lon: num(form.get("lon")), accuracyM: num(form.get("accuracyM")), time: String(form.get("locationTime") ?? "") };
  const locationTime = new Date(location.time), receivedAt = new Date();
  if (!Number.isFinite(location.lat) || !Number.isFinite(location.lon) || !Number.isFinite(location.accuracyM) || !Number.isFinite(locationTime.getTime())) return json({ error: "Fresh location data is required." }, 422);
  const { data: centre } = await svc.from("collation_centres").select("latitude,longitude,geocode_status,geofence_radius_m,active,election_id,contest_type").eq("id", session.centre_id).single();
  if (!centre?.active || centre.election_id !== session.election_id || centre.contest_type !== session.contest_type) return json({ error: "Centre assignment is no longer valid." }, 403);
  const geoTarget = { lat: centre.latitude, lon: centre.longitude, geocodeStatus: centre.geocode_status };
  const geoPolicy = { radiusM: centre.geofence_radius_m, maxAccuracyM: 50, maxEvidenceAgeS: 120 };
  const g = evaluateGeofence({ lat: location.lat, lon: location.lon, accuracyM: location.accuracyM, locationTime, receivedAt }, geoTarget, geoPolicy);
  if (g.outcome !== "within_radius") return json({ error: `Final geofence check failed: ${g.outcome}. Capture again from the assigned centre.`, geofence: g }, 403);
  // Video uploads include periodic GPS samples captured while recording. Every supplied sample is independently checked server-side.
  let locationTrail: any[] = [];
  if (session.evidence_type === "incident_video") {
    let trail: any; try { trail = JSON.parse(String(form.get("locationTrail") ?? "[]")); } catch { return json({ error: "Invalid video location trail." }, 422); }
    if (!Array.isArray(trail) || trail.length < 1 || trail.length > 30) return json({ error: "Video must include periodic location samples from the recording." }, 422);
    locationTrail = trail;
    for (const point of trail) {
      const ptTime = new Date(point?.time);
      if (!Number.isFinite(point?.lat) || !Number.isFinite(point?.lon) || !Number.isFinite(point?.accuracyM) || !Number.isFinite(ptTime.getTime())) return json({ error: "Video location trail contains an invalid sample." }, 422);
      const check = evaluateGeofence({ lat: point.lat, lon: point.lon, accuracyM: point.accuracyM, locationTime: ptTime, receivedAt }, geoTarget, geoPolicy);
      if (check.outcome !== "within_radius") return json({ error: `Video geofence trail failed: ${check.outcome}. Evidence was not accepted.`, geofence: check }, 403);
    }
  }
  const { data: access } = await svc.from("election_agent_access").select("access_mode,opens_at,closes_at").eq("election_id", session.election_id).eq("contest_type", session.contest_type).maybeSingle();
  const now = new Date();
  const open = access && (access.access_mode === "open" || (access.access_mode === "scheduled" && access.opens_at && access.closes_at && now >= new Date(access.opens_at) && now < new Date(access.closes_at)));
  if (!open) return json({ error: "Election evidence capture has been locked." }, 423);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size) return json({ error: "Media size validation failed." }, 422);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const path = `${user.id}/${session.election_id}/${session.centre_id}/${session.id}-${sha256}.${type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : type === "image/webp" ? "webp" : type === "video/mp4" ? "mp4" : "webm"}`;
  const { error: uploadError } = await svc.storage.from("collation-evidence").upload(path, bytes, { contentType: type, upsert: false, cacheControl: "0" });
  if (uploadError) return json({ error: "Secure evidence storage failed. Please capture again." }, 500);
  const category = String(form.get("incidentCategory") ?? "").slice(0, 80) || null;
  const severityRaw = String(form.get("severity") ?? "medium");
  const severity = ["low", "medium", "high", "critical"].includes(severityRaw) ? severityRaw : "medium";
  const description = String(form.get("description") ?? "").slice(0, 4000) || null;
  const capturedAt = String(form.get("capturedAt") ?? "");
  const capturedMs = Date.parse(capturedAt);
  if (!Number.isFinite(capturedMs)) { await svc.storage.from("collation-evidence").remove([path]); return json({ error: "Camera capture/recording start timestamp metadata is required." }, 422); }
  const clientCapturedAt = new Date(capturedMs).toISOString();
  const endedRaw = String(form.get("recordingEndedAt") ?? ""), endedMs = Date.parse(endedRaw);
  if (isVideo && !Number.isFinite(endedMs)) { await svc.storage.from("collation-evidence").remove([path]); return json({ error: "Video recording end timestamp metadata is required." }, 422); }
  const recordingEndedAt = isVideo ? new Date(endedMs).toISOString() : null;
  const recordingDurationSeconds = isVideo && clientCapturedAt ? Math.max(0, Math.min(90, Math.round((Date.parse(recordingEndedAt!) - Date.parse(clientCapturedAt)) / 1000))) : null;
  let deviceMetadata: Record<string, string | null> = {};
  try {
    const parsed = JSON.parse(String(form.get("deviceMetadata") ?? "{}"));
    if (parsed && typeof parsed === "object") deviceMetadata = {
      platform: typeof parsed.platform === "string" ? parsed.platform.slice(0, 120) : null,
      language: typeof parsed.language === "string" ? parsed.language.slice(0, 40) : null,
      userAgent: typeof parsed.userAgent === "string" ? parsed.userAgent.slice(0, 500) : null,
    };
  } catch { /* optional client diagnostics; never used for authorization */ }
  if (session.evidence_type !== "incident_video") locationTrail = [
    { lat: session.initial_lat, lon: session.initial_lon, accuracyM: session.initial_accuracy_m, time: session.initial_location_time },
    { lat: location.lat, lon: location.lon, accuracyM: location.accuracyM, time: locationTime.toISOString() },
  ];
  const insert = await svc.from("collation_evidence").insert({
    agent_id: user.id, assignment_id: session.assignment_id, centre_id: session.centre_id, election_id: session.election_id,
    contest_type: session.contest_type, evidence_type: session.evidence_type, incident_category: session.evidence_type.startsWith("incident") ? category : null,
    severity: session.evidence_type.startsWith("incident") ? severity : null, description: session.evidence_type.startsWith("incident") ? description : null,
    storage_path: path, content_type: type, size_bytes: bytes.length, sha256, capture_session_id: session.id,
    client_captured_at: clientCapturedAt, server_received_at: receivedAt.toISOString(), reported_lat: location.lat, reported_lon: location.lon, reported_accuracy_m: location.accuracyM,
    location_time: locationTime.toISOString(), distance_m: g.distanceM, geofence_outcome: g.outcome, capture_method: "in_app_live_camera",
    initial_lat: session.initial_lat, initial_lon: session.initial_lon, initial_accuracy_m: session.initial_accuracy_m,
    initial_location_time: session.initial_location_time, initial_distance_m: session.initial_distance_m,
    location_trail: locationTrail, recording_started_at: isVideo ? clientCapturedAt : null, recording_ended_at: recordingEndedAt,
    recording_duration_seconds: recordingDurationSeconds,
    device_metadata: { ...deviceMetadata, serverUserAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null },
    evidence_metadata: { metadataVersion: 1, source: "in_app_camera", clientReportedCapturedAt: clientCapturedAt, serverReceiptAuthoritative: true }
  }).select("id,evidence_type,verification_status,server_received_at,sha256,capture_session_id,recording_duration_seconds").single();
  if (insert.error || !insert.data) { await svc.storage.from("collation-evidence").remove([path]); return json({ error: "Evidence record could not be registered." }, 500); }
  await svc.from("collation_capture_sessions").update({ consumed_at: receivedAt.toISOString() }).eq("id", session.id).is("consumed_at", null);
  await svc.from("collation_evidence_audit").insert({ evidence_id: insert.data.id, actor_id: user.id, action: "evidence_submitted", detail: { evidence_type: session.evidence_type, sha256, content_type: type, size_bytes: bytes.length, geofence_outcome: g.outcome, distance_m: g.distanceM, capture_session_id: session.id, recording_duration_seconds: recordingDurationSeconds, location_samples: locationTrail.length, server_received_at: receivedAt.toISOString() } });
  return json({ evidence: insert.data, message: "Evidence received and awaiting independent verification." }, 201);
}
