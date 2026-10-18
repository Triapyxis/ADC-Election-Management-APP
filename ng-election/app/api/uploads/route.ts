import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { userClient, serviceClient } from "@/lib/supabase/user";
import { safeName, BUCKET, MAX_BYTES, MAX_DOCS } from "@/lib/upload";
import { evaluateGeofence } from "@/lib/geofence";
const json = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { "Cache-Control": "no-store" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validCoord = (n: unknown, min: number, max: number): n is number => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
function tokenMatches(token: string, hash: string) { const a = createHash("sha256").update(token).digest(), b = Buffer.from(hash, "hex"); return a.length === b.length && timingSafeEqual(a, b); }

/** Create a signed URL only for a valid, one-time polling-unit camera capture session. */
export async function POST(req: Request) {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser(); if (!user) return json({ error: "Sign in required." }, 401);
  let b: any; try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  if (!UUID.test(String(b?.submissionId ?? "")) || !UUID.test(String(b?.sessionId ?? "")) || typeof b?.token !== "string" || b.token.length < 30 || b.contentType !== "image/jpeg" || !Number.isInteger(b.size) || b.size <= 0 || b.size > MAX_BYTES) return json({ error: "A valid live-camera capture session and JPEG image under 10 MB are required." }, 422);
  const svc = serviceClient(), now = new Date();
  const { data: session } = await svc.from("polling_capture_sessions").select("*").eq("id", b.sessionId).eq("agent_id", user.id).eq("submission_id", b.submissionId).is("consumed_at", null).is("storage_path", null).gt("expires_at", now.toISOString()).maybeSingle();
  if (!session || !tokenMatches(b.token, session.nonce_hash)) return json({ error: "Capture session expired, already used or invalid. Capture a new photo." }, 409);
  const { data: sub } = await sb.from("result_submissions").select("id").eq("id", b.submissionId).eq("submitted_by", user.id).maybeSingle(); if (!sub) return json({ error: "Submission not found or not owned by you." }, 403);
  const { count } = await sb.from("submission_documents").select("id", { count: "exact", head: true }).eq("submission_id", b.submissionId); if ((count ?? 0) >= MAX_DOCS) return json({ error: `At most ${MAX_DOCS} camera captures per submission.` }, 409);
  const path = `${user.id}/${b.submissionId}/${crypto.randomUUID()}-${safeName("camera-capture.jpg", "image/jpeg")}`;
  const { data, error } = await svc.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return json({ error: "Could not prepare the secure upload." }, 500);
  const { error: upd } = await svc.from("polling_capture_sessions").update({ storage_path: path }).eq("id", session.id).is("consumed_at", null);
  if (upd) { await svc.storage.from(BUCKET).remove([path]); return json({ error: "Could not bind the upload to the capture session." }, 500); }
  return json({ path, uploadToken: data.token }, 201);
}

/** Register upload only after rechecking session, ownership, stored bytes and final server geofence. */
export async function PUT(req: Request) {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser(); if (!user) return json({ error: "Sign in required." }, 401);
  let b: any; try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  if (!UUID.test(String(b?.submissionId ?? "")) || !UUID.test(String(b?.sessionId ?? "")) || typeof b?.token !== "string" || typeof b?.path !== "string") return json({ error: "Invalid capture registration." }, 422);
  const l = b.location; if (!validCoord(l?.lat, -90, 90) || !validCoord(l?.lon, -180, 180) || !validCoord(l?.accuracyM, 0, 50) || typeof l?.time !== "string" || !Number.isFinite(new Date(l.time).getTime())) return json({ error: "Fresh final GPS with accuracy of 50 metres or better is required." }, 422);
  const svc = serviceClient(), now = new Date();
  const { data: session } = await svc.from("polling_capture_sessions").select("*").eq("id", b.sessionId).eq("agent_id", user.id).eq("submission_id", b.submissionId).eq("storage_path", b.path).is("consumed_at", null).gt("expires_at", now.toISOString()).maybeSingle();
  if (!session || !tokenMatches(b.token, session.nonce_hash)) return json({ error: "Capture session expired, already used or invalid." }, 409);
  const { data: assignment } = await svc.from("assignments").select("id").eq("id", session.assignment_id).eq("agent_id", user.id).eq("polling_unit_id", session.polling_unit_id).eq("status", "active").lte("starts_at", now.toISOString()).gte("expires_at", now.toISOString()).maybeSingle(); if (!assignment) return json({ error: "Polling-unit assignment is no longer active." }, 403);
  const { data: pu } = await svc.from("polling_units").select("latitude,longitude,geocode_status").eq("id", session.polling_unit_id).single();
  const g = evaluateGeofence({ lat: l.lat, lon: l.lon, accuracyM: l.accuracyM, locationTime: new Date(l.time), receivedAt: now }, { lat: pu?.latitude ?? null, lon: pu?.longitude ?? null, geocodeStatus: pu?.geocode_status ?? "pending" });
  if (g.outcome !== "within_radius") { await svc.storage.from(BUCKET).remove([b.path]); return json({ error: `Final geofence check failed: ${g.outcome}. Evidence was not accepted.`, geofence: g }, 403); }
  const { data: listed } = await svc.storage.from(BUCKET).list(`${user.id}/${b.submissionId}`, { limit: 100 });
  const name = b.path.slice(`${user.id}/${b.submissionId}/`.length); const obj = listed?.find(o => o.name === name); const size = Number((obj?.metadata as any)?.size), type = String((obj?.metadata as any)?.mimetype ?? "");
  if (!obj || type !== "image/jpeg" || !(size > 0 && size <= MAX_BYTES)) { await svc.storage.from(BUCKET).remove([b.path]); return json({ error: "Stored file is not an accepted JPEG camera capture or exceeds 10 MB." }, 422); }
  const { data: downloaded, error: dlErr } = await svc.storage.from(BUCKET).download(b.path); if (dlErr || !downloaded) return json({ error: "Could not verify stored evidence bytes." }, 500);
  const bytes = Buffer.from(await downloaded.arrayBuffer()), sha256 = createHash("sha256").update(bytes).digest("hex");
  const { data: sub } = await sb.from("result_submissions").select("id").eq("id", b.submissionId).eq("submitted_by", user.id).maybeSingle(); if (!sub) return json({ error: "Submission not found or not owned by you." }, 403);
  const capturedAtMs = Date.parse(String(b.capturedAt ?? ""));
  if (!Number.isFinite(capturedAtMs)) { await svc.storage.from(BUCKET).remove([b.path]); return json({ error: "Camera capture timestamp metadata is required." }, 422); }
  const clientCapturedAt = new Date(capturedAtMs).toISOString();
  const clientDevice = b.deviceMetadata && typeof b.deviceMetadata === "object" ? {
    platform: typeof b.deviceMetadata.platform === "string" ? b.deviceMetadata.platform.slice(0, 120) : null,
    language: typeof b.deviceMetadata.language === "string" ? b.deviceMetadata.language.slice(0, 40) : null,
    userAgent: typeof b.deviceMetadata.userAgent === "string" ? b.deviceMetadata.userAgent.slice(0, 500) : null,
  } : {};
  const { data: document, error: ins } = await svc.from("submission_documents").insert({
    submission_id: b.submissionId, storage_path: b.path, content_type: type, size_bytes: size, uploaded_by: user.id,
    sha256, capture_method: "in_app_live_camera", capture_session_id: session.id,
    client_captured_at: clientCapturedAt, server_received_at: now.toISOString(),
    initial_lat: session.initial_lat, initial_lon: session.initial_lon, initial_accuracy_m: session.initial_accuracy_m,
    initial_location_time: session.initial_location_time, initial_distance_m: session.initial_distance_m,
    reported_lat: l.lat, reported_lon: l.lon, reported_accuracy_m: l.accuracyM, location_time: new Date(l.time).toISOString(),
    distance_m: g.distanceM, geofence_outcome: g.outcome,
    device_metadata: { ...clientDevice, serverUserAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null },
    evidence_metadata: { metadataVersion: 1, source: "in_app_camera", originalFileName: null, imageEncoding: "image/jpeg", serverReceiptAuthoritative: true }
  }).select("id").single();
  if (ins || !document) { await svc.storage.from(BUCKET).remove([b.path]); return json({ error: "Could not register camera evidence." }, 500); }
  await svc.from("submission_document_audit").insert({ document_id: document.id, actor_id: user.id, action: "camera_evidence_registered", detail: { capture_session_id: session.id, submission_id: b.submissionId, sha256, content_type: type, size_bytes: size, capture_method: "in_app_live_camera", geofence_outcome: g.outcome, distance_m: g.distanceM, server_received_at: now.toISOString() } });
  await svc.from("polling_capture_sessions").update({ consumed_at: now.toISOString() }).eq("id", session.id).is("consumed_at", null);
  return json({ ok: true, documentId: document.id, sha256, captureMethod: "in_app_live_camera", geofence: g, serverReceivedAt: now.toISOString() }, 201);
}
