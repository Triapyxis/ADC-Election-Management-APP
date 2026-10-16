import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase/user";
import { validateAssignment, type AssignmentInput } from "@/lib/assignment";
const json = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  let b: AssignmentInput; try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  const issues = validateAssignment(b); if (issues.length) return json({ error: "Validation failed.", issues }, 422);
  const { data: agentId } = await sb.rpc("find_agent_by_email", { p_email: b.agentEmail });
  if (!agentId) return json({ error: "No field agent with that email, or you may not assign agents." }, 404);
  // RLS (0003): caller must be staff with scope over this unit, and approved_by must be the caller.
  const { error } = await sb.from("assignments").insert({ agent_id: agentId, polling_unit_id: b.pollingUnitId, starts_at: b.startsAt, expires_at: b.expiresAt, approved_by: user.id });
  return error ? json({ error: "Not permitted to assign agents to this polling unit." }, 403) : json({ ok: true }, 201);
}

/** Revoke an assignment (status only; the history row stays and the audit trigger logs it). RLS + column grant enforce who may. */
export async function PATCH(req: Request) {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  let b: { id?: string }; try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  if (!b.id || !/^[0-9a-f-]{36}$/i.test(b.id)) return json({ error: "id required." }, 422);
  const { data, error } = await sb.from("assignments").update({ status: "revoked" }).eq("id", b.id).eq("status", "active").select("id");
  return error || !data?.length ? json({ error: "Not permitted, or already revoked." }, 403) : json({ ok: true });
}
