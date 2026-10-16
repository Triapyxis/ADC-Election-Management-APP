import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase/user";
import { notifyResultsChanged } from "@/lib/notify";
const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { "Cache-Control": "no-store" } });

/** Verifier decision. Authorization is enforced by RLS (0006): verifier role, in scope, not own submission. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  const { id } = await params; let b: { decision?: string; note?: string }; try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  if (b.decision !== "verified" && b.decision !== "rejected") return json({ error: "decision must be 'verified' or 'rejected'." }, 422);
  if (b.decision === "rejected" && (b.note ?? "").trim().length < 10) return json({ error: "A rejection needs a reason of at least 10 characters." }, 422);
  const { data, error } = await sb.from("result_submissions").update({ status: b.decision, decision_note: b.note ?? null }).eq("id", id).in("status", ["submitted", "pending_verification"]).select("id,status");
  if (error || !data?.length) return json({ error: "Not permitted, or submission is not awaiting a decision." }, 403);
  await notifyResultsChanged();
  return json({ id, status: data[0]!.status });  // 'declared' is unreachable from here by design
}
