import { notFound } from "next/navigation";
import Link from "next/link";
import { getStateSnapshot } from "@/lib/results";
import { VoteBars, ShareDoughnut } from "@/components/Charts";
import { presidentialContest, lgaSummary, progressLabel } from "@/lib/drilldown";

export const dynamic = "force-dynamic";
const fmt = (n: number) => n.toLocaleString("en-NG");

export default async function StatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let snap; try { snap = await getStateSnapshot(slug); }
  catch { return (<section><h1 className="text-2xl font-semibold">Results are temporarily unavailable</h1><p className="mt-2 text-ink-soft">The results service did not respond. Reload in a minute.</p></section>); }
  if (!snap) notFound();

  const { state, candidates: cs, progress: p } = snap;
  const ctx = await presidentialContest(); let lgas: Awaited<ReturnType<typeof lgaSummary>> = [];
  try { lgas = ctx ? await lgaSummary(ctx.contestId, state.id) : []; } catch { /* LGA list is optional; page still renders */ }
  const pct = p.expected ? (p.reporting / p.expected) * 100 : 0, any = cs.some((c) => c.votes != null);
  return (
    <div>
      <Link href="/" className="text-sm text-green underline">Back to national results</Link>
      <h1 className="mt-3 text-3xl font-semibold">{state.name}</h1>
      <p className="mt-1 text-ink-soft">{snap.election.name}. Verified results only; provisional until officially declared.</p>
      <p className="mt-6 text-lg">{fmt(p.reporting)} of {fmt(p.expected)} polling units reporting ({pct.toFixed(1)}%)</p>
      <div className="mt-2 h-1.5 max-w-md bg-rule" role="img" aria-label={`${pct.toFixed(1)} percent of polling units reporting`}><div className="h-full bg-green" style={{ width: `${pct}%` }} /></div>
      {!any ? <p className="mt-8 text-lg">Awaiting results. No verified results from {state.name} yet.</p> : (
        <div className="mt-8 grid gap-10 lg:grid-cols-2">
          <VoteBars candidates={cs} title="Votes by candidate" />
          <ShareDoughnut candidates={cs} title="Share of verified votes" />
        </div>)}
      {lgas.length > 0 && <section className="mt-12"><h2 className="text-lg font-semibold">Local government areas</h2><ul className="mt-3 divide-y divide-rule border-y border-rule">{lgas.map((l) => <li key={l.id}><Link href={`/lgas/${l.id}`} className="flex flex-wrap justify-between gap-2 py-3 hover:bg-rule/30"><span className="font-medium">{l.name}</span><span className="text-sm tabular-nums text-ink-soft">{progressLabel(l.reporting, l.expected)}</span></Link></li>)}</ul></section>}
      <p className="mt-8 text-xs text-ink-faint">Synced {new Date(snap.fetchedAt).toLocaleTimeString("en-NG")}.</p>
    </div>
  );
}
