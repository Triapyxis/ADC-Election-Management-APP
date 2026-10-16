export type TickerItem = { id: string; label: string; leader: string; votes: number; reportedAt: string | null };
export type Link = "live" | "reconnecting" | "polling" | "offline";

/** Merge fresh data into the current list WITHOUT reordering: existing items update in place,
 *  new items append at the end, items no longer eligible are removed. Duplicate ids collapse.
 *  Stable order is what lets the ticker keep scrolling without a jump when data arrives. */
export function mergeTicker(current: TickerItem[], incoming: TickerItem[]): TickerItem[] {
  const fresh = new Map<string, TickerItem>();
  for (const i of incoming) {
    if (!i.id || !Number.isFinite(i.votes) || i.votes < 0) continue;   // never display malformed/negative
    fresh.set(i.id, i);                                                 // last write wins for duplicate ids
  }
  const out: TickerItem[] = [];
  for (const c of current) { const f = fresh.get(c.id); if (f) { out.push(f); fresh.delete(c.id); } }
  for (const f of fresh.values()) out.push(f);
  return out;
}

/** Exponential backoff with cap; `rand` injectable for tests. */
export const backoffMs = (attempt: number, rand = Math.random) =>
  Math.round(Math.min(30_000, 1000 * 2 ** Math.max(0, attempt)) * (0.5 + rand() * 0.5));

/** Connection state from consecutive failures and the browser's online flag. */
export function linkState(failures: number, online: boolean): Link {
  if (!online) return "offline";
  if (failures === 0) return "live";
  return failures < 3 ? "reconnecting" : "polling";
}
