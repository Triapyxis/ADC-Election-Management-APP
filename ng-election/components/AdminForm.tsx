"use client";
import { useState } from "react";
export type Field = { name: string; label: string; type?: "text" | "date" | "select" | "checkbox"; options?: { value: string; label: string }[]; optional?: boolean };
export function AdminForm({ endpoint, fixed, fields, submit, method = "POST" }: { endpoint: string; fixed?: Record<string, unknown>; fields: Field[]; submit: string; method?: string }) {
  const [v, setV] = useState<Record<string, any>>({}); const [msg, setMsg] = useState<string | null>(null);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    const r = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fixed, ...v }) });
    const j = await r.json().catch(() => ({})); setMsg(r.ok ? "Saved." : (j.issues?.join(" ") ?? j.error ?? "Could not save.")); if (r.ok) setV({});
  }
  const c = "mt-1 w-full border border-rule bg-paper-raised px-3 py-2";
  return (<form onSubmit={go} className="grid max-w-xl gap-3">
    {fields.map((f) => <label key={f.name} className="block text-sm">{f.label}{f.optional ? " (optional)" : ""}
      {f.type === "select" ? <select value={v[f.name] ?? ""} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} className={c}><option value="">Select</option>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        : f.type === "checkbox" ? <input type="checkbox" checked={!!v[f.name]} onChange={(e) => setV({ ...v, [f.name]: e.target.checked })} className="ml-2" />
        : <input type={f.type ?? "text"} value={v[f.name] ?? ""} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} className={c} />}</label>)}
    <button className="justify-self-start bg-green px-4 py-2 text-white">{submit}</button>{msg && <p role="status" className="text-sm">{msg}</p>}</form>);
}
