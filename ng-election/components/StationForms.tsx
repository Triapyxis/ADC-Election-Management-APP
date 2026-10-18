"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function CreateStation() {
  const [label, setLabel] = useState(""), [msg, setMsg] = useState<string | null>(null), [code, setCode] = useState<string | null>(null), router = useRouter();
  async function go(e: React.FormEvent) { e.preventDefault(); setMsg(null); setCode(null); const r = await fetch("/api/admin/stations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label }) }); const j = await r.json().catch(() => ({})); if (r.ok) { setCode(j.code); setLabel(""); router.refresh(); } else setMsg(j.issues?.join(" ") ?? j.error ?? "Could not create a pairing code."); }
  return (<form onSubmit={go} className="grid max-w-md gap-3"><label className="block text-sm">Laptop name (for example “National Situation Room”)<input required value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} className="mt-1 w-full border border-rule bg-paper-raised px-3 py-2" /></label>
    <button className="justify-self-start bg-green px-4 py-2 text-white">Generate pairing code</button>{msg && <p role="alert" className="text-sm text-status-disputed">{msg}</p>}
    {code && <div className="border border-rule bg-paper-raised p-3 text-sm"><p className="font-semibold">One-time pairing code</p><p className="mt-1 break-all font-mono text-xl tracking-wider">{code}</p><p className="mt-2 text-ink-soft">Enter this code in Situation Room → Settings. It expires in 10 minutes and can only be used once. Keep it private; it will not be shown again.</p><button type="button" onClick={() => navigator.clipboard.writeText(code)} className="mt-2 underline">Copy code</button></div>}</form>);
}
export function RevokeStation({ id }: { id: string }) {
  const [step, setStep] = useState(0), [msg, setMsg] = useState<string | null>(null), router = useRouter();
  async function go() { const r = await fetch("/api/admin/stations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); r.ok ? router.refresh() : (setMsg("Could not revoke."), setStep(0)); }
  return step === 0 ? <button onClick={() => setStep(1)} className="text-sm text-status-disputed underline">Revoke</button> : <span className="text-sm">Cut this laptop off now? <button onClick={go} className="font-semibold underline">Yes</button> <button onClick={() => setStep(0)} className="underline">No</button>{msg && <span role="alert" className="ml-2">{msg}</span>}</span>;
}
