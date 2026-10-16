"use client";
import { useEffect, useRef, useState } from "react";
const EVERY_MS = 15 * 60_000;
const TEXT: Record<string, string> = { within_radius: "Location confirmed at the polling unit.", outside_radius: "You appear to be outside the 200 m radius. A supervisor may review this.", poor_accuracy: "GPS accuracy is too low. Move to open sky and wait.", gps_missing: "Location is off or blocked. Allow location access for this site.", stale_location: "Location reading was too old. Retrying at the next check.", pu_coordinates_unverified: "This unit's location has not been verified, so no location check is possible.", pu_coordinates_missing: "This unit has no location on record, so no location check is possible." };

/** Checks on open, then every 15 minutes while the page is open and visible. A browser cannot check in the background. */
export function LocationMonitor({ pollingUnitId }: { pollingUnitId: string }) {
  const [text, setText] = useState("Checking your location."); const [at, setAt] = useState<Date | null>(null); const first = useRef(true);
  useEffect(() => {
    let stop = false;
    const run = async () => {
      if (document.hidden && !first.current) return;
      const trigger = first.current ? "open" : "periodic"; first.current = false;
      const loc = await new Promise<{ lat: number | null; lon: number | null; accuracyM: number | null; time: string | null }>((res) => {
        if (!navigator.geolocation) return res({ lat: null, lon: null, accuracyM: null, time: null });
        navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lon: p.coords.longitude, accuracyM: p.coords.accuracy, time: new Date(p.timestamp).toISOString() }), () => res({ lat: null, lon: null, accuracyM: null, time: null }), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
      });
      try {
        const r = await fetch("/api/location-checks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pollingUnitId, trigger, deviceTime: new Date().toISOString(), location: loc }) });
        const j = await r.json().catch(() => ({})); if (stop) return;
        setText(r.ok ? (TEXT[j.outcome] ?? "Check recorded.") : (j.error ?? "Check could not be recorded.")); setAt(new Date());
      } catch { if (!stop) setText("No connection. The check was not recorded; it will retry at the next interval."); }
    };
    void run(); const t = setInterval(run, EVERY_MS); return () => { stop = true; clearInterval(t); };
  }, [pollingUnitId]);
  return <p role="status" className="mt-2 text-sm text-ink-soft">{text}{at ? ` Last check ${at.toLocaleTimeString("en-NG")}.` : ""}</p>;
}
