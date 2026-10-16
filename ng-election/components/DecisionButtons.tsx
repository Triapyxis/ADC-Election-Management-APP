"use client";
import { useState } from "react";
export function DecisionButtons({ id }: { id: string }) {
  const [note, setNote] = useState(""); const [rejecting, setRejecting] = useState(false); const [msg, setMsg] = useState<string | null>(null); const [done, setDone] = useState<string | null>(null);
  async function decide(decision: "verified" | "rejected") {
    const r = await fetch(`/api/submissions/${id}/decision`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, note }) });
    const j = await r.json().catch(() => ({})); if (r.ok) setDone(decision === "verified" ? "Verified" : "Rejected"); else setMsg(j.error ?? "Could not record the decision.");
  }
  if (done) return <p className="text-sm font-medium">{done}</p>;
  return (<div className="space-y-2">
    <div className="flex gap-2"><button onClick={() => decide("verified")} className="bg-green px-3 py-1.5 text-sm text-white">Verify</button><button onClick={() => setRejecting(true)} className="border border-rule px-3 py-1.5 text-sm">Reject</button></div>
    {rejecting && <div className="space-y-2"><label className="block text-sm">Reason for rejection<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1 w-full border border-rule bg-paper-raised px-3 py-2" /></label><button onClick={() => decide("rejected")} className="bg-status-disputed px-3 py-1.5 text-sm text-white">Confirm rejection</button></div>}
    {msg && <p role="alert" className="text-sm text-status-disputed">{msg}</p>}</div>);
}
