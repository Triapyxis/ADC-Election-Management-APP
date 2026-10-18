import { NextResponse } from "next/server";
import { userClient, serviceClient } from "@/lib/supabase/user";
const json = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { "Cache-Control": "no-store" } });
export async function POST(req: Request) {
  const userDb = await userClient(); const { data: { user } } = await userDb.auth.getUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  const svc = serviceClient();
  const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", user.id);
  if (!(roles ?? []).some((r: any) => ["super_admin", "election_admin"].includes(r.role))) return json({ error: "Election administrator access required." }, 403);
  let b: any; try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  const name = String(b.name ?? "").trim(), email = String(b.agentEmail ?? "").trim().toLowerCase();
  const latitude = Number(b.latitude), longitude = Number(b.longitude), radius = Number(b.radiusM ?? 200);
  if (name.length < 2 || name.length > 180 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !b.electionId || !b.stateId || !["presidential","governorship","senatorial","house_of_reps","state_assembly"].includes(b.contestType) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isInteger(radius) || radius < 25 || radius > 1000) return json({ error: "Check centre name, agent email, election, contest type, state, coordinates and radius." }, 422);
  const { data: state } = await svc.from("states").select("id").eq("id", b.stateId).maybeSingle();
  const { data: election } = await svc.from("elections").select("id").eq("id", b.electionId).maybeSingle();
  if (!state || !election) return json({ error: "Select an existing state and election." }, 422);
  const { data: users, error: usersError } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) return json({ error: "Could not look up the agent account." }, 500);
  const agent = users.users.find((u: any) => String(u.email ?? "").toLowerCase() === email);
  if (!agent) return json({ error: "No existing account matches that email. Create the user account first, then assign the centre." }, 404);
  const startsAt = b.startsAt ? new Date(b.startsAt) : new Date();
  const expiresAt = b.expiresAt ? new Date(b.expiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(expiresAt.getTime()) || expiresAt <= startsAt) return json({ error: "Assignment start and expiry must be valid, and expiry must be later than start." }, 422);
  const { data: centre, error: ce } = await svc.from("collation_centres").insert({ election_id: b.electionId, contest_type: b.contestType, name, state_id: b.stateId, lga_id: b.lgaId || null, address: String(b.address ?? "").slice(0, 300) || null, latitude, longitude, geofence_radius_m: radius, geocode_status: b.coordinatesVerified === true ? "verified" : "pending" }).select("id,name").single();
  if (ce || !centre) return json({ error: ce?.message ?? "Could not create centre." }, 500);
  const { error: roleError } = await svc.from("user_roles").upsert({ user_id: agent.id, role: "collation_agent", state_id: b.stateId, lga_id: b.lgaId || null, granted_by: user.id }, { onConflict: "user_id,role" });
  if (roleError) { await svc.from("collation_centres").delete().eq("id", centre.id); return json({ error: "Centre created but agent role assignment failed: " + roleError.message }, 500); }
  const { data: assignment, error: ae } = await svc.from("collation_assignments").insert({ agent_id: agent.id, centre_id: centre.id, starts_at: startsAt.toISOString(), expires_at: expiresAt.toISOString(), approved_by: user.id }).select("id").single();
  if (ae || !assignment) return json({ error: "Centre and role created, but assignment failed: " + (ae?.message ?? "unknown error") + ". Centre ID: " + centre.id }, 500);
  return json({ ok: true, centre, assignmentId: assignment.id, agentEmail: email, coordinatesVerified: b.coordinatesVerified === true, note: b.coordinatesVerified === true ? "Centre coordinates marked verified by administrator." : "Centre is pending coordinate verification; capture remains blocked until verified." }, 201);
}
