import { NextResponse } from "next/server";
import { userClient, serviceClient } from "@/lib/supabase/user";
const json = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { "Cache-Control": "no-store" } });
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  const svc = serviceClient(); const { data: roles } = await svc.from("user_roles").select("role,state_id,lga_id").eq("user_id", user.id);
  const nationalAdmin = (roles ?? []).some((r: any) => ["super_admin", "election_admin"].includes(r.role));
  const scopedReviewer = (roles ?? []).some((r: any) => ["verifier", "state_admin", "lga_coordinator", "supervisor"].includes(r.role));
  if (!nationalAdmin && !scopedReviewer) return json({ error: "Evidence review permission required." }, 403);
  const { id } = await ctx.params; if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Invalid evidence ID." }, 422);
  let b: any; try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  if (!["verified", "rejected", "flagged", "pending_verification"].includes(b.status) || (typeof b.note !== "string") || b.note.trim().length < 3 || b.note.length > 2000) return json({ error: "Choose a valid review status and enter a review note (at least 3 characters)." }, 422);
  const { data: evidence } = await svc.from("collation_evidence").select("id,verification_status,centre_id,collation_centres(state_id,lga_id)").eq("id", id).maybeSingle();
  if (!evidence) return json({ error: "Evidence not found." }, 404);
  if (!nationalAdmin) { const c: any = evidence.collation_centres; const scoped = (roles ?? []).some((r: any) => ["verifier", "state_admin", "lga_coordinator", "supervisor"].includes(r.role) && r.state_id === c?.state_id && (!r.lga_id || r.lga_id === c?.lga_id)); if (!scoped) return json({ error: "This evidence is outside your assigned scope." }, 403); }
  const { error } = await svc.from("collation_evidence").update({ verification_status: b.status, reviewed_by: user.id, reviewed_at: new Date().toISOString(), review_note: b.note.trim() }).eq("id", id);
  if (error) return json({ error: "Review could not be saved." }, 500);
  await svc.from("collation_evidence_audit").insert({ evidence_id: id, actor_id: user.id, action: "review_decision", detail: { previous_status: evidence.verification_status, status: b.status, note: b.note.trim() } });
  return json({ ok: true, status: b.status }, 200);
}
