import { NextResponse } from "next/server";
import { userClient, serviceClient } from "@/lib/supabase/user";
import { validateSubmission, type SubmissionInput } from "@/lib/submission";
import { evaluateGeofence } from "@/lib/geofence";

type Body = SubmissionInput & { supersedesId?: string } & { location?: { lat: number | null; lon: number | null; accuracyM: number | null; time: string | null } };
const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  const sb = await userClient();
  const { data: { user } } = await sb.auth.getUser();           // verified server-side, not from a client claim
  if (!user) return json({ error: "Sign in required." }, 401);
  let body: Body; try { body = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }

  const { data: cands, error: ce } = await sb.from("candidates").select("id").eq("contest_id", body.contestId);
  if (ce) return json({ error: "Could not load contest." }, 500);
  const issues = validateSubmission(body, (cands ?? []).map((c) => c.id));
  if (issues.length) return json({ error: "Validation failed.", issues }, 422);

  const { data: dup } = await sb.from("result_submissions").select("id,status").eq("idempotency_key", body.idempotencyKey).maybeSingle();
  if (dup) return json({ id: dup.id, status: dup.status, duplicate: true });

  // RLS enforces: field_agent role + active assignment for this unit + status 'submitted'.
  const { data: id, error } = body.supersedesId
    ? await sb.rpc("submit_correction", { p_original: body.supersedesId, p_key: body.idempotencyKey, p_device_time: body.deviceTime ?? null, p_votes: body.votes })  // new linked row; original untouched
    : await sb.rpc("submit_result", { p_contest: body.contestId, p_pu: body.pollingUnitId, p_key: body.idempotencyKey, p_device_time: body.deviceTime ?? null, p_votes: body.votes });
  if (error || !id) {
    if (error?.message?.includes("Agent access is closed")) return json({ error: "Agent submissions are locked for this election type. Contact the Election Admin if access should be open." }, 423);
    return json({ error: "Not permitted: no active assignment for this polling unit, or agent access is locked." }, 403);
  }

  // Location is evaluated on the server and recorded as a REVIEW FLAG. It never rejects the votes.
  const svc = serviceClient();
  const { data: pu } = await svc.from("polling_units").select("latitude,longitude,geocode_status").eq("id", body.pollingUnitId).single();
  const loc = body.location, receivedAt = new Date();
  const g = evaluateGeofence({ lat: loc?.lat ?? null, lon: loc?.lon ?? null, accuracyM: loc?.accuracyM ?? null, locationTime: loc?.time ? new Date(loc.time) : null, receivedAt },
    { lat: pu?.latitude ?? null, lon: pu?.longitude ?? null, geocodeStatus: pu?.geocode_status ?? "pending" });
  await svc.from("geofence_checks").insert({ agent_id: user.id, polling_unit_id: body.pollingUnitId, trigger: "submission", reported_lat: loc?.lat ?? null, reported_lon: loc?.lon ?? null, reported_accuracy_m: loc?.accuracyM ?? null, location_time: loc?.time ?? null, received_at: receivedAt.toISOString(), distance_m: g.distanceM, outcome: g.outcome, submission_id: id, device_time: body.deviceTime ?? null });
  await svc.from("result_submissions").update({ geofence_status: g.outcome }).eq("id", id);
  return json({ id, status: "submitted", geofence: g.outcome, flaggedForReview: g.outcome !== "within_radius" }, 201);
}
