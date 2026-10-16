type Cand = { id: string; full_name: string; party: string };
type P = { assumptions: string[]; result: any; created_at: string; method: string; method_version: string };
/** An estimate, labelled as one. Used only on the desk. */
export function ProjectionView({ p, cands, name, big = false }: { p: P; cands: Cand[]; name: string; big?: boolean }) {
  const rows = cands.map((c) => ({ ...c, share: p.result.projectedShares?.[c.id] as number | undefined })).filter((r) => r.share != null).sort((a, b) => b.share! - a.share!);
  const max = Math.max(1, ...rows.map((r) => r.share!));
  return (<section aria-labelledby="pv">
    <p className={big ? "text-2xl font-semibold text-status-provisional" : "text-sm font-semibold text-status-provisional"}>ESTIMATE, NOT A RESULT</p>
    <h1 id="pv" className={big ? "mt-2 text-5xl font-semibold" : "mt-1 text-3xl font-semibold"}>{name}</h1>
    <p className={big ? "mt-2 text-xl text-ink-soft" : "mt-1 text-sm text-ink-soft"}>Projection from {p.result.coverage.statesIncluded} of {p.result.coverage.statesTotal} states, produced {new Date(p.created_at).toLocaleString("en-NG")}. Not an official declaration.</p>
    <ul className={big ? "mt-8 space-y-4" : "mt-5 space-y-2"}>{rows.map((r) => <li key={r.id} className={`grid items-center gap-4 ${big ? "grid-cols-[8rem_1fr_7rem] text-3xl" : "grid-cols-[5.5rem_1fr_5rem] text-sm"}`}><span className="font-semibold">{r.party}</span><div className={big ? "h-8 bg-rule/60" : "h-4 bg-rule/60"}><div className="h-full bg-green" style={{ width: `${(r.share! / max) * 100}%` }} /></div><span className="text-right tabular-nums">about {r.share!.toFixed(1)}%</span></li>)}</ul>
    {!big && <details className="mt-4 text-sm"><summary className="cursor-pointer text-green underline">How this estimate was made</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">{p.assumptions.map((a) => <li key={a}>{a}</li>)}</ul><p className="mt-2 text-xs text-ink-faint">{p.method} {p.method_version}</p></details>}
  </section>);
}
