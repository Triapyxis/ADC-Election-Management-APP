"use client";
import { useState } from "react";
export function OverrideButton({ checkId }: { checkId: string }) {
  const [open, setOpen] = useState(false), [reason, setReason] = useState(""), [msg, setMsg] = useState<string | null>(null), [done, setDone] = useState(false);
  async function go() { const r = await fetch("/api/overrides", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkId, reason }) }); const j = await r.json().catch(() => ({})); r.ok ? setDone(true) : setMsg(j.error ?? "Could not record the override."); }
  if (done) return <span className="text-sm">Override recorded</span>;
  return !open ? <button onClick={() => setOpen(true)} className="text-sm text-green underline">Override</button> : (
    <div className="space-y-1"><label className="block text-sm">Reason<textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1 w-full border border-rule bg-paper-raised px-2 py-1" /></label>
      <button onClick={go} className="bg-green px-3 py-1 text-sm text-white">Record override</button>{msg && <p role="alert" className="text-sm text-status-disputed">{msg}</p>}</div>);
}
