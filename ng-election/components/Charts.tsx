import { arcs, shares } from "@/lib/chart-math";
import type { Candidate } from "@/lib/results";
const FALLBACK = "#7b8a80";
const fmt = (n: number) => n.toLocaleString("en-NG");

/** Horizontal bars on a common 0-based axis (no truncated axes). Unreported shows "No data", not an empty zero bar. */
export function VoteBars({ candidates, title }: { candidates: Candidate[]; title: string }) {
  const max = Math.max(1, ...candidates.map((c) => c.votes ?? 0));
  return (
    <figure>
      <figcaption className="mb-2 font-medium">{title}</figcaption>
      <ul className="space-y-2" role="list">
        {candidates.map((c) => (
          <li key={c.id} className="grid grid-cols-[5.5rem_1fr_6rem] items-center gap-3 text-sm">
            <span className="truncate" title={c.name}>{c.party}</span>
            <div className="h-4 bg-rule/60">{c.votes != null && <div className="h-full" style={{ width: `${(c.votes / max) * 100}%`, background: c.colour ?? FALLBACK }} />}</div>
            <span className="text-right tabular-nums">{c.votes == null ? "No data" : fmt(c.votes)}</span>
          </li>))}
      </ul>
    </figure>
  );
}

/** Doughnut of share of verified votes. Not drawn when nothing has been counted; text list is the accessible equivalent. */
export function ShareDoughnut({ candidates, title }: { candidates: Candidate[]; title: string }) {
  const s = shares(candidates.map((c) => ({ id: c.id, votes: c.votes })));
  if (s.total === 0) return <p className="text-sm text-ink-soft">No verified votes to chart yet.</p>;
  const segs = arcs(s.rows.map((r) => r.pct));
  const desc = s.rows.filter((r) => r.pct != null).map((r) => `${candidates.find((c) => c.id === r.id)!.party} ${r.pct!.toFixed(1)}%`).join(", ");
  return (
    <figure className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="h-36 w-36 shrink-0 -rotate-90" role="img" aria-label={`${title}: ${desc}`}>
        {segs.map((g, i) => g && <circle key={i} cx="50" cy="50" r="40" fill="none" strokeWidth="16" stroke={candidates[i]!.colour ?? FALLBACK} strokeDasharray={`${g.dash} ${g.gap}`} strokeDashoffset={g.offset} />)}
      </svg>
      <figcaption className="text-sm"><p className="mb-1 font-medium">{title}</p>
        <ul>{s.rows.filter((r) => r.pct != null).map((r) => { const c = candidates.find((x) => x.id === r.id)!; return <li key={r.id}><span className="mr-2 inline-block h-2.5 w-2.5" style={{ background: c.colour ?? FALLBACK }} />{c.party} {r.pct!.toFixed(1)}%</li>; })}</ul>
        <p className="mt-1 text-xs text-ink-faint">Share of {fmt(s.total)} verified votes, not of all votes cast.</p></figcaption>
    </figure>
  );
}
