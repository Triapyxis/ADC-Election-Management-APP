import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase/user";
import { AGENT_ACCESS_MODES, type AgentAccessMode } from "@/lib/election-access";
import { CONTEST_TYPES } from "@/lib/seats";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const isAdmin = (roles: string[]) => roles.some((r) => r === "super_admin" || r === "election_admin");

export async function GET() {
  const sb = await userClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  const { data: roleRows } = await sb.from("user_roles").select("role").eq("user_id", user.id);
  if (!isAdmin((roleRows ?? []).map((r) => r.role))) return json({ error: "Election administrator access required." }, 403);
  const { data, error } = await sb.from("election_agent_access").select("id,election_id,contest_type,access_mode,opens_at,closes_at,reason,updated_at,updated_by").order("updated_at", { ascending: false });
  if (error) return json({ error: "Could not load access controls. Confirm migration 0024 has been applied." }, 500);
  return json({ controls: data ?? [] });
}

export async function POST(req: Request) {
  const sb = await userClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  const { data: roleRows } = await sb.from("user_roles").select("role").eq("user_id", user.id);
  if (!isAdmin((roleRows ?? []).map((r) => r.role))) return json({ error: "Only the Super Admin or Election Admin can change agent access." }, 403);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  const electionId = typeof b.electionId === "string" ? b.electionId : "";
  const contestType = typeof b.contestType === "string" ? b.contestType : "";
  const mode = typeof b.accessMode === "string" ? b.accessMode as AgentAccessMode : "locked";
  const opensAtRaw = typeof b.opensAt === "string" && b.opensAt ? new Date(b.opensAt) : null;
  const closesAtRaw = typeof b.closesAt === "string" && b.closesAt ? new Date(b.closesAt) : null;
  const opensAt = opensAtRaw && Number.isFinite(opensAtRaw.getTime()) ? opensAtRaw : null;
  const closesAt = closesAtRaw && Number.isFinite(closesAtRaw.getTime()) ? closesAtRaw : null;
  const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 500) : "";
  if (!electionId || !CONTEST_TYPES.includes(contestType as (typeof CONTEST_TYPES)[number])) return json({ error: "Select a valid election and election type." }, 422);
  if (!AGENT_ACCESS_MODES.includes(mode)) return json({ error: "Select a valid access mode." }, 422);
  if (mode === "scheduled" && (!opensAt || !closesAt || !Number.isFinite(opensAt.getTime()) || !Number.isFinite(closesAt.getTime()) || closesAt <= opensAt)) {
    return json({ error: "Scheduled access requires valid opening and closing times, with closing after opening." }, 422);
  }
  if ((mode === "locked" || mode === "open") && !reason) return json({ error: "Enter a reason for manually opening or locking agent access." }, 422);
  const { data: election } = await sb.from("elections").select("id").eq("id", electionId).maybeSingle();
  if (!election) return json({ error: "Election not found or not available to this account." }, 404);
  const { data, error } = await sb.from("election_agent_access").upsert({
    election_id: electionId, contest_type: contestType, access_mode: mode,
    opens_at: opensAt?.toISOString() ?? null,
    closes_at: closesAt?.toISOString() ?? null,
    reason: reason || null, updated_by: user.id, updated_at: new Date().toISOString(),
  }, { onConflict: "election_id,contest_type" }).select("id,election_id,contest_type,access_mode,opens_at,closes_at,reason,updated_at,updated_by").single();
  if (error) return json({ error: "Could not save access control. Confirm migration 0024 is applied and your role is authorised." }, 403);
  return json({ control: data });
}
