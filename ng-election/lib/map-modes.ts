export const NEUTRAL = "#e4e2d9";
export const MODES = ["presidential", "reporting", "senate", "house", "governorship"] as const;
export type Mode = (typeof MODES)[number];
export const MODE_LABEL: Record<Mode, string> = { presidential: "Presidential leader", reporting: "Reporting progress", senate: "Senate seats led", house: "House seats led", governorship: "Governorship leader" };
export const MODE_CONTEST = { senate: "senatorial", house: "house_of_reps", governorship: "governorship" } as const;

const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
/** Sequential green for % of polling units reporting. No expected units, or no data: neutral grey, never "0% shade". */
export function shade(reporting: number | null, expected: number | null): string {
  if (reporting == null || !expected || expected <= 0) return NEUTRAL;
  const t = Math.min(1, Math.max(0, reporting / expected)), from = [214, 230, 220], to = [7, 73, 42];
  return `rgb(${lerp(from[0]!, to[0]!, t)},${lerp(from[1]!, to[1]!, t)},${lerp(from[2]!, to[2]!, t)})`;
}

export type SeatRow = { stateKey: string; party: string; colour: string | null; margin: number };
/** Per state, the party leading in most contests. Ties between parties, or all-tied contests, stay neutral. */
export function leadingByState(rows: SeatRow[]): Record<string, { party: string; colour: string | null; seats: number }> {
  const per = new Map<string, Map<string, { colour: string | null; seats: number }>>();
  for (const r of rows) {
    if (r.margin <= 0) continue;                               // a tied contest is a lead for nobody
    const m = per.get(r.stateKey) ?? new Map(); const e = m.get(r.party) ?? { colour: r.colour, seats: 0 }; e.seats++; m.set(r.party, e); per.set(r.stateKey, m);
  }
  const out: Record<string, { party: string; colour: string | null; seats: number }> = {};
  for (const [k, m] of per) {
    const sorted = [...m].sort((a, b) => b[1].seats - a[1].seats);
    if (sorted.length > 1 && sorted[0]![1].seats === sorted[1]![1].seats) continue;   // dead heat between parties
    out[k] = { party: sorted[0]![0], colour: sorted[0]![1].colour, seats: sorted[0]![1].seats };
  }
  return out;
}
