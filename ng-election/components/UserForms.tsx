"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ROLES, ROLE_LABEL } from "@/lib/users";
type Opt = { id: string; name: string };
const c = "mt-1 w-full border border-rule bg-paper-raised px-3 py-2";
const NATIONAL = ["super_admin", "election_admin", "station_system_admin"];

function RoleFields({ states, v, set }: { states: Opt[]; v: { role: string; stateId: string; lgaId: string }; set: (x: any) => void }) {
  const [lgas, setLgas] = useState<Opt[]>([]);
  useEffect(() => { if (!v.stateId) { setLgas([]); return; } fetch(`/api/geo?level=lgas&parent=${v.stateId}`, { cache: "no-store" }).then((r) => r.json()).then((j) => setLgas(j.items ?? [])).catch(() => setLgas([])); }, [v.stateId]);
  const national = NATIONAL.includes(v.role);
  return (<>
    <label className="block text-sm">Role<select value={v.role} onChange={(e) => set({ ...v, role: e.target.value, stateId: "", lgaId: "" })} className={c}><option value="">Select</option>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></label>
    {v.role && !national && <label className="block text-sm">State<select value={v.stateId} onChange={(e) => set({ ...v, stateId: e.target.value, lgaId: "" })} className={c}><option value="">Select</option>{states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
    {v.role && !national && v.stateId && <label className="block text-sm">LGA{v.role === "lga_coordinator" ? "" : " (optional, narrows the area)"}<select value={v.lgaId} onChange={(e) => set({ ...v, lgaId: e.target.value })} className={c}><option value="">{v.role === "lga_coordinator" ? "Select" : "Whole state"}</option>{lgas.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>}
  </>);
}

export function CreateUserForm({ states }: { states: Opt[] }) {
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [r, setR] = useState({ role: "", stateId: "", lgaId: "" });
  const [msg, setMsg] = useState<string | null>(null), [temp, setTemp] = useState<string | null>(null), router = useRouter();
  async function go(e: React.FormEvent) {
    e.preventDefault(); setMsg(null); setTemp(null);
    const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, role: r.role, stateId: r.stateId || null, lgaId: r.lgaId || null }) });
    const j = await res.json().catch(() => ({}));
    if (res.ok) { setMsg("User created."); setTemp(j.tempPassword ?? null); setEmail(""); setPassword(""); router.refresh(); } else setMsg(j.issues?.join(" ") ?? j.error ?? "Could not create the user.");
  }
  return (<form onSubmit={go} className="grid max-w-xl gap-3">
    <label className="block text-sm">Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={c} /></label>
    <label className="block text-sm">Temporary password (optional, 12+ characters; leave empty to generate one)<input type="text" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} className={c} /></label>
    <RoleFields states={states} v={r} set={setR} />
    <button className="justify-self-start bg-green px-4 py-2 text-white">Create user</button>
    {msg && <p role="status" className="text-sm">{msg}</p>}
    {temp && <p className="border border-rule bg-paper-raised p-3 text-sm">Temporary password: <span className="font-mono font-semibold">{temp}</span><span className="block text-ink-soft">Shown once. Give it to the person privately. They must choose their own at first sign-in.</span></p>}</form>);
}

export function UserActions({ userId, banned, self, roles, states }: { userId: string; banned: boolean; self: boolean; roles: string[]; states: Opt[] }) {
  const [r, setR] = useState({ role: "", stateId: "", lgaId: "" }), [msg, setMsg] = useState<string | null>(null), [temp, setTemp] = useState<string | null>(null), router = useRouter();
  async function act(body: Record<string, unknown>) {
    setMsg(null); setTemp(null); const res = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, ...body }) });
    const j = await res.json().catch(() => ({})); if (res.ok) { if (j.tempPassword) setTemp(j.tempPassword); else router.refresh(); } else setMsg(j.issues?.join(" ") ?? j.error ?? "Failed.");
  }
  return (<details className="text-sm"><summary className="cursor-pointer text-green underline">Manage</summary><div className="mt-2 grid max-w-md gap-2">
    {roles.length > 0 && <div className="flex flex-wrap gap-2">{roles.map((x) => <button key={x} onClick={() => act({ action: "revoke", role: x })} className="border border-rule px-2 py-1">Remove {ROLE_LABEL[x as keyof typeof ROLE_LABEL] ?? x}</button>)}</div>}
    <RoleFields states={states} v={r} set={setR} />
    {r.role && <button onClick={() => act({ action: "grant", role: r.role, stateId: r.stateId || null, lgaId: r.lgaId || null })} className="justify-self-start bg-green px-3 py-1.5 text-white">Add role</button>}
    <div className="flex flex-wrap gap-3 pt-1"><button onClick={() => act({ action: "reset_password" })} className="underline">Reset password</button>{!self && <button onClick={() => act({ action: banned ? "enable" : "disable" })} className="text-status-disputed underline">{banned ? "Re-enable account" : "Disable account"}</button>}</div>
    {msg && <p role="alert" className="text-status-disputed">{msg}</p>}{temp && <p className="border border-rule bg-paper-raised p-2">New temporary password: <span className="font-mono font-semibold">{temp}</span> (shown once)</p>}</div></details>);
}
