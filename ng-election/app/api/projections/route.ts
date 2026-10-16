import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase/user";
import { project, ASSUMPTIONS, METHOD, VERSION, type StateInput } from "@/lib/projection";
import { notifyResultsChanged } from "@/lib/notify";
const json = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { "Cache-Control": "no-store" } });
const UUID = /^[0-9a-f-]{36}$/i;

/** Generate a DRAFT projection from the current verified data and record exactly what it used. Never published automatically. */
export async function POST(req: Request) {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  let b: { contestId?: string }; try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  if (!b.contestId || !UUID.test(b.contestId)) return json({ error: "contestId required." }, 422);
  const { data: ct } = await sb.from("contests").select("id,type").eq("id", b.contestId).maybeSingle();
  if (!ct) return json({ error: "Contest not found." }, 404);
  if (ct.type !== "presidential" && ct.type !== "governorship") return json({ error: "Projections are only supported for presidential and governorship contests." }, 422);
  const [votes, prog, states] = await Promise.all([
    sb.from("public_state_votes").select("state_id,candidate_id,votes").eq("contest_id", b.contestId),
    sb.from("public_state_progress").select("state_id,expected_units,reporting_units").eq("contest_id", b.contestId),
    sb.from("states").select("id,name")]);
  if (votes.error || prog.error || states.error) return json({ error: "Could not load source data." }, 500);
  const name = new Map((states.data ?? []).map((s: any) => [s.id, s.name as string]));
  const inputs: StateInput[] = (prog.data ?? []).map((p: any) => ({ stateId: p.state_id, name: name.get(p.state_id) ?? p.state_id, expected: Number(p.expected_units), reporting: Number(p.reporting_units),
    votes: Object.fromEntries((votes.data ?? []).filter((v: any) => v.state_id === p.state_id).map((v: any) => [v.candidate_id, Number(v.votes)])) }));
  const result = project(inputs);
  const { data, error } = await sb.from("projections").insert({ contest_id: b.contestId, method: METHOD, method_version: VERSION, assumptions: ASSUMPTIONS, source_snapshot: inputs, result, created_by: user.id }).select("id").single();
  return error ? json({ error: "Not permitted to create projections." }, 403) : json({ id: data.id, status: (result as any).status }, 201);
}
/** Publish or withdraw. An 'insufficient_data' run cannot be published (database check). */
export async function PATCH(req: Request) {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  let b: { id?: string; published?: boolean }; try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  if (!b.id || !UUID.test(b.id) || typeof b.published !== "boolean") return json({ error: "id and published required." }, 422);
  const { data, error } = await sb.from("projections").update(b.published ? { published: true, published_by: user.id, published_at: new Date().toISOString() } : { published: false }).eq("id", b.id).select("id");
  if (error || !data?.length) return json({ error: "Not permitted, or this projection has no usable estimate and cannot be published." }, 403);
  await notifyResultsChanged(); return json({ ok: true });
}
