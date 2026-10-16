"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";
import { CHANNEL, EVENT, createCoalescer } from "@/lib/realtime";

const QUIET = ["/admin", "/agent", "/login", "/account"];   // forms and broadcast pages manage their own refresh
type Mode = "connecting" | "push" | "polling";

/** Refetches server data when a push arrives; falls back to timed refresh if push is unavailable or drops. */
export function LiveRefresh() {
  const router = useRouter(), path = usePathname(), off = QUIET.some((p) => path.startsWith(p));
  const [mode, setMode] = useState<Mode>("connecting");

  useEffect(() => {
    if (off) return;
    const co = createCoalescer(() => { router.refresh(); window.dispatchEvent(new Event("results-changed")); }, 3000);
    let ch: ReturnType<ReturnType<typeof browserClient>["channel"]> | null = null, sb: ReturnType<typeof browserClient> | null = null, wasDown = false;
    try {
      sb = browserClient();
      ch = sb.channel(CHANNEL).on("broadcast", { event: EVENT }, () => co.trigger()).subscribe((s) => {
        if (s === "SUBSCRIBED") { setMode("push"); if (wasDown) co.trigger(); wasDown = false; }        // catch up after a reconnect
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") { setMode("polling"); wasDown = true; }
      });
    } catch { setMode("polling"); }
    const t = setTimeout(() => setMode((m) => (m === "connecting" ? "polling" : m)), 8000);
    return () => { clearTimeout(t); co.cancel(); if (sb && ch) void sb.removeChannel(ch); };
  }, [off, router]);

  // Safety net: slow refresh while push is healthy (covers a missed message), faster when it is not.
  useEffect(() => {
    if (off || mode === "connecting") return;
    const co = createCoalescer(() => { router.refresh(); window.dispatchEvent(new Event("results-changed")); }, 1000);
    const t = setInterval(() => co.trigger(), mode === "push" ? 60_000 : 15_000); return () => { clearInterval(t); co.cancel(); };
  }, [mode, off, router]);

  if (off) return null;
  return <p className="text-xs text-ink-faint" aria-live="polite">{mode === "push" ? "Live updates connected." : mode === "polling" ? "Live push unavailable. Refreshing every 15 seconds." : "Connecting to live updates."}</p>;
}
