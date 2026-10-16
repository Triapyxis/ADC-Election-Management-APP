"use client";
import { useEffect, useRef, useState } from "react";
import { backoffMs, linkState, mergeTicker, type TickerItem } from "@/lib/ticker";

const POLL_MS = 10_000, PX_PER_S = 48;

export function Ticker() {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [fails, setFails] = useState(0);
  const [online, setOnline] = useState(true);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);
  const track = useRef<HTMLDivElement>(null), first = useRef<HTMLUListElement>(null);

  // Data: poll with backoff on failure. Updates merge in place, so scrolling is never reset.
  useEffect(() => {
    let stop = false, timer: ReturnType<typeof setTimeout>, failures = 0;
    const tick = async () => {
      try {
        const r = await fetch("/api/ticker", { cache: "no-store" }); if (!r.ok) throw new Error(String(r.status));
        const j = await r.json(); failures = 0; setFails(0); setSyncedAt(j.syncedAt);
        setItems((cur) => mergeTicker(cur, j.items));
      } catch { failures++; setFails(failures); }
      if (!stop) timer = setTimeout(tick, failures ? backoffMs(failures) : POLL_MS);
    };
    const on = () => setOnline(true), off = () => setOnline(false);
    setOnline(navigator.onLine); addEventListener("online", on); addEventListener("offline", off); const nudge = () => { clearTimeout(timer); void tick(); }; addEventListener("results-changed", nudge); tick();
    return () => { stop = true; clearTimeout(timer); removeEventListener("online", on); removeEventListener("offline", off); removeEventListener("results-changed", nudge); };
  }, []);

  useEffect(() => { const m = matchMedia("(prefers-reduced-motion: reduce)"); setReduced(m.matches); const f = () => setReduced(m.matches); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []);

  // Motion: one persistent rAF loop. Offset wraps at one list's width; appended items extend the list without moving it.
  useEffect(() => {
    if (reduced) return; let raf = 0, off = 0, prev = performance.now();
    const step = (now: number) => {
      const w = first.current?.offsetWidth ?? 0;
      if (!document.hidden && w > 0 && track.current) { off = (off + ((now - prev) / 1000) * PX_PER_S) % w; track.current.style.transform = `translate3d(${-off}px,0,0)`; }
      prev = now; raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const link = linkState(fails, online);
  const List = ({ hidden, r }: { hidden?: boolean; r?: React.Ref<HTMLUListElement> }) => (
    <ul ref={r} aria-hidden={hidden} className="flex shrink-0 gap-8 pr-8">
      {items.map((i) => <li key={i.id} className="whitespace-nowrap text-sm"><span className="font-medium">{i.label}</span> <span className="text-ink-soft">{i.leader} leads, {i.votes.toLocaleString("en-NG")} votes (verified, provisional)</span></li>)}
    </ul>);

  return (
    <div className="border-b border-rule bg-paper-raised" role="region" aria-label="Latest verified state results">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2">
        <span className="shrink-0 text-xs text-ink-soft" aria-live="polite">
          {link === "live" ? "Live" : link === "reconnecting" ? "Reconnecting" : link === "polling" ? "Connection unstable" : "You are offline"}
          {syncedAt && link === "live" ? "" : syncedAt ? `, last synced ${new Date(syncedAt).toLocaleTimeString("en-NG")}` : ""}
        </span>
        {items.length === 0 ? <span className="text-sm text-ink-soft">No verified state results yet.</span> : reduced
          ? <div className="overflow-x-auto"><List /></div>
          : <div className="min-w-0 flex-1 overflow-hidden"><div ref={track} className="flex w-max will-change-transform"><List r={first} /><List hidden /></div></div>}
      </div>
    </div>
  );
}
