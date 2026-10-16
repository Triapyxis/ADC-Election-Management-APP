export const CHANNEL = "public-results";
export const EVENT = "changed";

/** Runs `fn` at most once per `gapMs`. A burst inside the gap collapses into ONE trailing call, so a flurry of
 *  verifications cannot trigger a refetch storm. Timer functions are injectable for tests. */
export function createCoalescer(fn: () => void, gapMs: number, now: () => number = Date.now, setT: (f: () => void, ms: number) => unknown = setTimeout, clearT: (t: any) => void = clearTimeout) {
  let last = -Infinity, timer: unknown = null;
  return {
    trigger() {
      const wait = last + gapMs - now();
      if (wait <= 0) { last = now(); fn(); return; }
      if (timer) return;
      timer = setT(() => { timer = null; last = now(); fn(); }, wait);
    },
    cancel() { if (timer) { clearT(timer); timer = null; } },
  };
}
