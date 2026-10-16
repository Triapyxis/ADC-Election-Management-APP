import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase/user";
import { validateDeclaration } from "@/lib/setup";
import { notifyResultsChanged } from "@/lib/notify";
const json = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { "Cache-Control": "no-store" } });

/** Official declaration. Only election_admin/super_admin (RLS). Records a source reference; never edits votes. */
export async function POST(req: Request) {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  let b: { contestId?: string; candidateId?: string; sourceReference?: string }; try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  const issues = validateDeclaration(b); if (issues.length) return json({ error: "Validation failed.", issues }, 422);
  const { error } = await sb.from("declarations").insert({ contest_id: b.contestId, candidate_id: b.candidateId, declared_by: user.id, source_reference: b.sourceReference!.trim() });
  if (!error) { await notifyResultsChanged(); return json({ ok: true }, 201); }
  return error.code === "23505" ? json({ error: "This contest already has an active declaration. Revoke it first." }, 409) : json({ error: "Not permitted, or the candidate is not in this contest." }, 403);
}
/** Revoke (never delete): history is kept with who, when and why. */
export async function PATCH(req: Request) {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  let b: { contestId?: string; reason?: string }; try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  if (!b.contestId) return json({ error: "contestId required." }, 422);
  if ((b.reason ?? "").trim().length < 10) return json({ error: "A reason of at least 10 characters is required." }, 422);
  const { data, error } = await sb.from("declarations").update({ revoked_at: new Date().toISOString(), revoked_by: user.id, revoke_reason: b.reason!.trim() }).eq("contest_id", b.contestId).is("revoked_at", null).select("id");
  if (error || !data?.length) return json({ error: "Not permitted, or nothing to revoke." }, 403);
  await notifyResultsChanged();
  return json({ ok: true });
}
