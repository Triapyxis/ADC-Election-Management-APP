export type Row = { id: string; votes: number | null };
/** pct is null for unreported candidates (missing != zero) and when nothing has been counted at all. */
export function shares(rows: Row[]) {
  const total = rows.reduce((a, r) => a + (r.votes ?? 0), 0);
  return { total, rows: rows.map((r) => ({ ...r, pct: r.votes == null || total === 0 ? null : (r.votes / total) * 100 })) };
}
/** Doughnut segments as stroke-dasharray values on a circle of radius r. Zero/unreported segments are omitted. */
export function arcs(pcts: (number | null)[], r = 40) {
  const C = 2 * Math.PI * r; let cum = 0;
  return pcts.map((p) => { if (!p || p <= 0) return null; const dash = (p / 100) * C, seg = { dash, gap: C - dash, offset: -cum }; cum += dash; return seg; });
}
