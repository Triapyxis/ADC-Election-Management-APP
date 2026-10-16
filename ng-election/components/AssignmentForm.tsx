"use client";
import { useEffect, useState } from "react";
type Opt = { id: string; name: string; official_code?: string };
const load = async (level: string, parent = ""): Promise<Opt[]> => { const r = await fetch(`/api/geo?level=${level}&parent=${parent}`, { cache: "no-store" }); return r.ok ? (await r.json()).items : []; };

export function AssignmentForm() {
  const [lists, setLists] = useState<{ states: Opt[]; lgas: Opt[]; wards: Opt[]; units: Opt[] }>({ states: [], lgas: [], wards: [], units: [] });
  const [sel, setSel] = useState({ state: "", lga: "", ward: "", unit: "" });
  const [f, setF] = useState({ email: "", starts: "", expires: "" }); const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { void load("states").then((states) => setLists((l) => ({ ...l, states }))); }, []);
  const pick = async (k: "state" | "lga" | "ward" | "unit", v: string) => {
    const next = { ...sel, [k]: v }; const order = ["state", "lga", "ward", "unit"] as const; order.slice(order.indexOf(k) + 1).forEach((x) => (next[x] = "")); setSel(next);
    const child = { state: "lgas", lga: "wards", ward: "units" }[k as "state" | "lga" | "ward"] as "lgas" | "wards" | "units" | undefined;
    if (child) { const items = v ? await load(child, v) : []; setLists((l) => ({ ...l, [child]: items, ...(child === "lgas" ? { wards: [], units: [] } : child === "wards" ? { units: [] } : {}) })); }
  };
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    const r = await fetch("/api/assignments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentEmail: f.email, pollingUnitId: sel.unit, startsAt: f.starts && new Date(f.starts).toISOString(), expiresAt: f.expires && new Date(f.expires).toISOString() }) });
    const j = await r.json().catch(() => ({})); setMsg(r.ok ? "Assignment created." : (j.issues?.join(" ") ?? j.error ?? "Could not create the assignment."));
  }
  const S = ({ k, label, opts }: { k: "state" | "lga" | "ward" | "unit"; label: string; opts: Opt[] }) => (
    <label className="block text-sm">{label}<select value={sel[k]} onChange={(e) => void pick(k, e.target.value)} disabled={!opts.length} className="mt-1 w-full border border-rule bg-paper-raised px-3 py-2">
      <option value="">Select</option>{opts.map((o) => <option key={o.id} value={o.id}>{o.official_code ? `${o.official_code} ${o.name}` : o.name}</option>)}</select></label>);
  const inp = "mt-1 w-full border border-rule bg-paper-raised px-3 py-2";
  return (
    <form onSubmit={submit} className="grid max-w-xl gap-3">
      <S k="state" label="State" opts={lists.states} /><S k="lga" label="LGA or Area Council" opts={lists.lgas} /><S k="ward" label="Ward" opts={lists.wards} /><S k="unit" label="Polling unit" opts={lists.units} />
      <label className="block text-sm">Agent email<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inp} /></label>
      <label className="block text-sm">Starts<input type="datetime-local" required value={f.starts} onChange={(e) => setF({ ...f, starts: e.target.value })} className={inp} /></label>
      <label className="block text-sm">Expires<input type="datetime-local" required value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} className={inp} /></label>
      <button className="justify-self-start bg-green px-4 py-2 text-white">Assign agent</button>
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </form>);
}
