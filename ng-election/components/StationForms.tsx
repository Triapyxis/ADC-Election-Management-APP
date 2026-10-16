"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function CreateStation() {
  const [label, setLabel] = useState(""), [msg, setMsg] = useState<string | null>(null), [key, setKey] = useState<string | null>(null), router = useRouter();
  async function go(e: React.FormEvent) { e.preventDefault(); setMsg(null); setKey(null); const r = await fetch("/api/admin/stations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label }) }); const j = await r.json().catch(() => ({})); if (r.ok) { setKey(j.key); setLabel(""); router.refresh(); } else setMsg(j.issues?.join(" ") ?? j.error ?? "Could not create the key."); }
  return (<form onSubmit={go} className="grid max-w-md gap-3"><label className="block text-sm">Laptop name (for example "Studio A")<input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1 w-full border border-rule bg-paper-raised px-3 py-2" /></label>
    <button className="justify-self-start bg-green px-4 py-2 text-white">Create station key</button>{msg && <p role="alert" className="text-sm text-status-disputed">{msg}</p>}
    {key && <div className="border border-rule bg-paper-raised p-3 text-sm"><p className="font-semibold">Station key (shown once)</p><p className="mt-1 break-all font-mono">{key}</p><p className="mt-2 text-ink-soft">On that laptop, open Situation Room, choose Settings, and paste it into the Station key box. It cannot be shown again; if lost, revoke it and create another.</p></div>}</form>);
}
export function RevokeStation({ id }: { id: string }) {
  const [step, setStep] = useState(0), [msg, setMsg] = useState<string | null>(null), router = useRouter();
  async function go() { const r = await fetch("/api/admin/stations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); r.ok ? router.refresh() : (setMsg("Could not revoke."), setStep(0)); }
  return step === 0 ? <button onClick={() => setStep(1)} className="text-sm text-status-disputed underline">Revoke</button> : <span className="text-sm">Cut this laptop off now? <button onClick={go} className="font-semibold underline">Yes</button> <button onClick={() => setStep(0)} className="underline">No</button>{msg && <span role="alert" className="ml-2">{msg}</span>}</span>;
}
