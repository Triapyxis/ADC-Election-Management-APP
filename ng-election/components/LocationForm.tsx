"use client";
import { useState } from "react";
export function LocationForm({ id, lat, lon }: { id: string; lat: number | null; lon: number | null }) {
  const [v, setV] = useState({ latitude: lat?.toString() ?? "", longitude: lon?.toString() ?? "", note: "" }); const [msg, setMsg] = useState<string | null>(null); const [done, setDone] = useState<string | null>(null);
  async function save(status: "verified" | "needs_manual_correction") {
    setMsg(null); const r = await fetch("/api/locations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pollingUnitId: id, status, ...v }) });
    const j = await r.json().catch(() => ({})); r.ok ? setDone(status === "verified" ? "Verified" : "Flagged for manual correction") : setMsg(j.issues?.join(" ") ?? j.error ?? "Could not save.");
  }
  if (done) return <p className="text-sm font-medium">{done}</p>;
  const c = "mt-1 w-full border border-rule bg-paper-raised px-2 py-1";
  return (<div className="grid gap-2 text-sm sm:grid-cols-2">
    <label>Latitude<input inputMode="decimal" value={v.latitude} onChange={(e) => setV({ ...v, latitude: e.target.value })} className={c} /></label>
    <label>Longitude<input inputMode="decimal" value={v.longitude} onChange={(e) => setV({ ...v, longitude: e.target.value })} className={c} /></label>
    <label className="sm:col-span-2">How was this confirmed?<input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} className={c} /></label>
    <div className="flex gap-2 sm:col-span-2"><button onClick={() => save("verified")} className="bg-green px-3 py-1.5 text-white">Mark verified</button><button onClick={() => save("needs_manual_correction")} className="border border-rule px-3 py-1.5">Needs manual correction</button></div>
    {msg && <p role="alert" className="text-status-disputed sm:col-span-2">{msg}</p>}</div>);
}
