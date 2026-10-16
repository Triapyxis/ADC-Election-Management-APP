"use client";
import { useEffect, useState } from "react";
import { enqueue, flush, type Queued } from "@/lib/offline-queue";
import { UploadSheet } from "@/components/UploadSheet";

type Cand = { id: string; name: string; party: string };
const KEY = "ng-submission-queue";
const load = (): Queued[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; } };
const save = (q: Queued[]) => { try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* storage unavailable */ } };
const post = async (body: unknown) => { const r = await fetch("/api/submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); return { status: r.status, error: j.error, json: j }; };

export function SubmitForm({ contestId, pollingUnitId, candidates }: { contestId: string; pollingUnitId: string; candidates: Cand[] }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: "ok" | "queued" | "error"; text: string } | null>(null);
  const [subId, setSubId] = useState<string | null>(null); const [pending, setPending] = useState(0); const [busy, setBusy] = useState(false);

  const sync = async () => { const { queue } = await flush(load(), (b) => post(b)); save(queue); setPending(queue.filter((q) => q.state === "pending_server_validation").length); };
  useEffect(() => { setPending(load().length); const f = () => void sync(); addEventListener("online", f); void sync(); return () => removeEventListener("online", f); }, []);

  const position = () => new Promise<{ lat: number | null; lon: number | null; accuracyM: number | null; time: string | null }>((res) => {
    if (!navigator.geolocation) return res({ lat: null, lon: null, accuracyM: null, time: null });
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lon: p.coords.longitude, accuracyM: p.coords.accuracy, time: new Date(p.timestamp).toISOString() }),
      () => res({ lat: null, lon: null, accuracyM: null, time: null }), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const votes = candidates.map((c) => ({ candidateId: c.id, votes: vals[c.id] === undefined || vals[c.id] === "" ? NaN : Number(vals[c.id]) }));
    if (votes.some((v) => Number.isNaN(v.votes))) { setMsg({ kind: "error", text: "Enter votes for every candidate. Use 0 if a party received none." }); setBusy(false); return; }
    const key = crypto.randomUUID(); const body = { contestId, pollingUnitId, idempotencyKey: key, votes, deviceTime: new Date().toISOString(), location: await position() };
    try {
      const r = await post(body);
      if (r.status === 201 || r.status === 200) { setSubId(r.json.id); setMsg({ kind: "ok", text: r.json.flaggedForReview ? "Received by the server and awaiting verification. Your location check is flagged for supervisor review; your votes were still recorded." : "Received by the server and awaiting verification." }); }
      else if (r.status === 401 || r.status >= 500) { save(enqueue(load(), key, body)); setPending(load().length); setMsg({ kind: "queued", text: "Saved on this device, pending server validation. It will send automatically. It has not been received yet." }); }
      else setMsg({ kind: "error", text: r.error ?? "The server rejected this submission." });
    } catch { save(enqueue(load(), key, body)); setPending(load().length); setMsg({ kind: "queued", text: "No connection. Saved on this device, pending server validation. It has not been received yet." }); }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      {candidates.map((c) => (
        <label key={c.id} className="grid grid-cols-[1fr_7rem] items-center gap-3 text-sm">
          <span>{c.party}<span className="block text-ink-soft">{c.name}</span></span>
          <input inputMode="numeric" pattern="[0-9]*" value={vals[c.id] ?? ""} onChange={(e) => setVals({ ...vals, [c.id]: e.target.value })} className="border border-rule bg-paper-raised px-3 py-2 text-right tabular-nums" />
        </label>))}
      <button disabled={busy} className="bg-green px-4 py-2 text-white disabled:opacity-60">{busy ? "Submitting" : "Submit result"}</button>
      {msg && <p role="status" className={`text-sm ${msg.kind === "error" ? "text-status-disputed" : msg.kind === "queued" ? "text-status-provisional" : "text-ink"}`}>{msg.text}</p>}
      {subId && <UploadSheet submissionId={subId} />}
      {pending > 0 && <p className="text-xs text-ink-soft">{pending} submission{pending > 1 ? "s" : ""} waiting on this device. Not yet received by the server.</p>}
    </form>
  );
}
