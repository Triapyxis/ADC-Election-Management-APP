import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase/server";
import { presidentialContest, wardSummary, progressLabel, UUID } from "@/lib/drilldown";
export const dynamic = "force-dynamic";

export default async function LgaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; if (!UUID.test(id)) notFound();
  try {
    const { data: lga } = await db().from("lgas").select("name,states(name)").eq("id", id).maybeSingle(); if (!lga) notFound();
    const ctx = await presidentialContest(); const wards = ctx ? await wardSummary(ctx.contestId, id) : [];
    const state = (lga as any).states?.name as string;
    return (
      <div><Link href={`/states/${state.toLowerCase().replace(/ /g, "-")}`} className="text-sm text-green underline">Back to {state}</Link>
        <h1 className="mt-3 text-3xl font-semibold">{lga.name}</h1><p className="mt-1 text-ink-soft">{state}. Wards and verified reporting progress.</p>
        {!wards.length ? <p className="mt-6 text-ink-soft">No wards or no public election available.</p> : <ul className="mt-6 divide-y divide-rule border-y border-rule">{wards.map((w) => <li key={w.id}><Link href={`/wards/${w.id}`} className="flex flex-wrap justify-between gap-2 py-3 hover:bg-rule/30"><span className="font-medium">{w.name}</span><span className="text-sm tabular-nums text-ink-soft">{progressLabel(w.reporting, w.expected)}</span></Link></li>)}</ul>}
      </div>);
  } catch (e: any) { if (e?.digest?.startsWith?.("NEXT_")) throw e; return <section><h1 className="text-2xl font-semibold">Results are temporarily unavailable</h1><p className="mt-2 text-ink-soft">Reload in a minute.</p></section>; }
}
