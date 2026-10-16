import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase/server";
import { UUID, progressLabel } from "@/lib/area";
import { TYPE_LABEL, type ContestType } from "@/lib/seats";
import { VoteBars, ShareDoughnut } from "@/components/Charts";
import type { Candidate } from "@/lib/results";
export const dynamic = "force-dynamic";

export default async function ContestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; if (!UUID.test(id)) notFound();
  try {
    const s = db(); const { data: ct } = await s.from("contests").select("id,name,type,elections(name)").eq("id", id).maybeSingle(); if (!ct) notFound();
    const [cands, votes, prog, decl] = await Promise.all([
      s.from("candidates").select("id,full_name,photo_url,parties(abbreviation,name,brand_colour)").eq("contest_id", id),
      s.from("public_state_votes").select("candidate_id,votes").eq("contest_id", id),
      s.from("public_contest_progress").select("expected_units,reporting_units,pending,rejected").eq("contest_id", id).maybeSingle(),
      s.from("public_declarations").select("full_name,party,source_reference,declared_at").eq("contest_id", id).maybeSingle(),
    ]);
    for (const r of [cands, votes, prog, decl]) if (r.error) throw r.error;
    const by = new Map<string, number>(); for (const v of (votes.data ?? []) as any[]) by.set(v.candidate_id, (by.get(v.candidate_id) ?? 0) + Number(v.votes));
    const cs: Candidate[] = ((cands.data ?? []) as any[]).map((c) => ({ id: c.id, name: c.full_name, photo: c.photo_url, party: c.parties.abbreviation, partyName: c.parties.name, colour: c.parties.brand_colour, votes: by.has(c.id) ? by.get(c.id)! : null })).sort((a, b) => (b.votes ?? -1) - (a.votes ?? -1));
    const p: any = prog.data ?? {}, any = cs.some((c) => c.votes != null);
    return (
      <div><Link href={`/contests?type=${ct.type}`} className="text-sm text-green underline">All {TYPE_LABEL[ct.type as ContestType]} contests</Link>
        <h1 className="mt-3 text-3xl font-semibold">{ct.name}</h1><p className="mt-1 text-ink-soft">{(ct as any).elections?.name}. Verified results only; provisional until officially declared.</p>
        {decl.data ? <p className="mt-6 border-l-4 border-green pl-3 text-lg font-semibold">Officially declared: {decl.data.full_name} ({decl.data.party})<span className="block text-sm font-normal text-ink-soft">Source: {decl.data.source_reference}, {new Date(decl.data.declared_at).toLocaleDateString("en-NG")}</span></p> : <p className="mt-6 text-sm text-ink-soft">No official declaration yet. Figures below are verified results, not a declared outcome.</p>}
        <p className="mt-4 text-lg tabular-nums">{progressLabel(Number(p.reporting_units ?? 0), Number(p.expected_units ?? 0))}</p>
        <p className="text-sm text-ink-soft">{Number(p.pending ?? 0)} awaiting verification, {Number(p.rejected ?? 0)} rejected.</p>
        {!any ? <p className="mt-8 text-lg">Awaiting results. No verified results for this contest yet.</p> : <div className="mt-8 grid gap-10 lg:grid-cols-2"><VoteBars candidates={cs} title="Votes by candidate" /><ShareDoughnut candidates={cs} title="Share of verified votes" /></div>}
        {!any && cs.length > 0 && <ul className="mt-4 text-sm text-ink-soft">{cs.map((c) => <li key={c.id}>{c.party}: {c.name}</li>)}</ul>}
      
      </div>);
  } catch (e: any) { if (e?.digest?.startsWith?.("NEXT_")) throw e; return <section><h1 className="text-2xl font-semibold">Results are temporarily unavailable</h1><p className="mt-2 text-ink-soft">Reload in a minute.</p></section>; }
}
