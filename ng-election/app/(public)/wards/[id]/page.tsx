import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase/server";
import { presidentialContest, unitResults, UUID } from "@/lib/drilldown";
export const dynamic = "force-dynamic";

export default async function WardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; if (!UUID.test(id)) notFound();
  try {
    const s = db(); const { data: ward } = await s.from("wards").select("name,lga_id,lgas(name)").eq("id", id).maybeSingle(); if (!ward) notFound();
    const ctx = await presidentialContest(); let units: Awaited<ReturnType<typeof unitResults>> = [], cands: { id: string; party: string }[] = [];
    if (ctx) {
      units = await unitResults(ctx.contestId, id);
      const { data } = await s.from("candidates").select("id,parties(abbreviation)").eq("contest_id", ctx.contestId); cands = ((data ?? []) as any[]).map((c) => ({ id: c.id, party: c.parties.abbreviation }));
    }
    const reported = units.filter((u) => u.votes).length;
    return (
      <div><Link href={`/lgas/${ward.lga_id}`} className="text-sm text-green underline">Back to {(ward as any).lgas?.name}</Link>
        <h1 className="mt-3 text-3xl font-semibold">{ward.name}</h1>
        <p className="mt-1 text-ink-soft">{reported} of {units.length} polling units have verified results. Provisional until officially declared.</p>
        <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[32rem] text-left text-sm"><thead className="text-ink-soft"><tr><th className="py-1">Polling unit</th>{cands.map((c) => <th key={c.id} className="text-right">{c.party}</th>)}</tr></thead>
          <tbody className="divide-y divide-rule">{units.map((u) => <tr key={u.id}><td className="py-2"><span className="tabular-nums text-ink-soft">{u.code}</span> {u.name}</td>
            {u.votes ? cands.map((c) => <td key={c.id} className="text-right tabular-nums">{(u.votes![c.id] ?? 0).toLocaleString("en-NG")}</td>) : <td colSpan={Math.max(1, cands.length)} className="text-right text-ink-faint">Not reported</td>}</tr>)}</tbody></table></div>
      </div>);
  } catch (e: any) { if (e?.digest?.startsWith?.("NEXT_")) throw e; return <section><h1 className="text-2xl font-semibold">Results are temporarily unavailable</h1><p className="mt-2 text-ink-soft">Reload in a minute.</p></section>; }
}
