/** Short shared cache for the station feed. The feed is identical for every station (public data + released projections),
 *  so many laptops polling every few seconds cost ONE load per TTL per server instance, not one per laptop. */
export function createFeedCache<T>(opt: { ttlMs?: number; maxStaleMs?: number; now?: () => number } = {}) {
  const ttl = opt.ttlMs ?? 3000, maxStale = opt.maxStaleMs ?? 60_000, now = opt.now ?? Date.now;
  let value: T | undefined, at = -Infinity, inflight: Promise<T> | null = null;
  return {
    /** Fresh value if young enough; otherwise ONE load shared by every concurrent caller.
     *  If the load fails, a value younger than maxStale is served and flagged stale; an error is never cached. */
    async get(load: () => Promise<T>): Promise<{ value: T; ageMs: number; stale: boolean }> {
      const t = now();
      if (value !== undefined && t - at < ttl) return { value, ageMs: t - at, stale: false };
      if (!inflight) inflight = load().then((v) => { value = v; at = now(); return v; }).finally(() => { inflight = null; });
      try { const v = await inflight; return { value: v, ageMs: 0, stale: false }; }
      catch (e) { if (value !== undefined && now() - at < maxStale) return { value, ageMs: now() - at, stale: true }; throw e; }
    },
  };
}
/** True at most once per gap per id: keeps "last seen" bookkeeping from becoming a database write on every poll. */
export function createToucher(gapMs: number, now: () => number = Date.now) {
  const last = new Map<string, number>();
  return (id: string): boolean => { const t = now(), p = last.get(id); if (p !== undefined && t - p < gapMs) return false; last.set(id, t); return true; };
}
