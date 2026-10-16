"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function RevokeButton({ id }: { id: string }) {
  const [step, setStep] = useState(0), [msg, setMsg] = useState<string | null>(null), router = useRouter();
  async function go() { const r = await fetch("/api/assignments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); const j = await r.json().catch(() => ({})); r.ok ? router.refresh() : (setMsg(j.error ?? "Could not revoke."), setStep(0)); }
  return step === 0 ? <button onClick={() => setStep(1)} className="text-sm text-status-disputed underline">Revoke</button> : <span className="text-sm">Revoke access now? <button onClick={go} className="font-semibold underline">Yes</button> <button onClick={() => setStep(0)} className="underline">No</button>{msg && <span role="alert" className="ml-2 text-status-disputed">{msg}</span>}</span>;
}
