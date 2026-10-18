"use client";
import { useState } from "react";
import { isAgentAccessOpen, type AgentAccessControl, type AgentAccessMode } from "@/lib/election-access";

type Election = { id: string; name: string; election_date: string };
type ContestType = { value: string; label: string };
type Props = { elections: Election[]; controls: AgentAccessControl[]; contestTypes: ContestType[] };
type Draft = { accessMode: AgentAccessMode; opensAt: string; closesAt: string; reason: string };
const localInput = (value: string | null | undefined) => {
  if (!value) return "";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const defaultWindow = (date: string) => {
  const start = `${date}T00:00`;
  const endDate = new Date(`${date}T12:00:00`);
  endDate.setDate(endDate.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  const end = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T00:00`;
  return { start, end };
};
const key = (electionId: string, contestType: string) => `${electionId}:${contestType}`;

export function ElectionAccessControls({ elections, controls, contestTypes }: Props) {
  const [saved, setSaved] = useState<Record<string, AgentAccessControl>>(() => Object.fromEntries(controls.map((c) => [key(c.election_id, c.contest_type), c])));
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const out: Record<string, Draft> = {};
    for (const e of elections) for (const t of contestTypes) {
      const k = key(e.id, t.value), c = controls.find((x) => x.election_id === e.id && x.contest_type === t.value), w = defaultWindow(e.election_date);
      out[k] = { accessMode: c?.access_mode ?? "locked", opensAt: localInput(c?.opens_at) || w.start, closesAt: localInput(c?.closes_at) || w.end, reason: c?.reason ?? "" };
    }
    return out;
  });
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const update = (k: string, patch: Partial<Draft>) =>
  setDrafts((old) => {
    const current = old[k];

    if (!current) {
      return old;
    }

    const next: Draft = {
      ...current,
      ...patch,
      accessMode: patch.accessMode ?? current.accessMode,
    };

    return {
      ...old,
      [k]: next,
    };
  });
 async function save(election: Election, contestType: ContestType) {
  const k = key(election.id, contestType.value);
  const d: Draft | undefined = drafts[k];

  if (d === undefined) {
    setMessages((old) => ({
      ...old,
      [k]: "Draft settings are missing. Refresh the page and try again.",
    }));
    return;
  }
    if (d.accessMode === "scheduled" && (!d.opensAt || !d.closesAt || !Number.isFinite(new Date(d.opensAt).getTime()) || !Number.isFinite(new Date(d.closesAt).getTime()) || new Date(d.closesAt) <= new Date(d.opensAt))) {
      setMessages((old) => ({ ...old, [k]: "Choose valid opening and closing times; closing must be after opening." })); return;
    }
    if (d.accessMode !== "scheduled" && !d.reason.trim()) { setMessages((old) => ({ ...old, [k]: "Enter a reason for manually opening or locking access." })); return; }
    setBusy(k); setMessages((old) => ({ ...old, [k]: "Saving…" }));
    try {
      const r = await fetch("/api/admin/election-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ electionId: election.id, contestType: contestType.value, accessMode: d.accessMode, opensAt: d.accessMode === "scheduled" ? new Date(d.opensAt).toISOString() : null, closesAt: d.accessMode === "scheduled" ? new Date(d.closesAt).toISOString() : null, reason: d.reason }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMessages((old) => ({ ...old, [k]: j.error ?? "Could not save settings." })); return; }
      setSaved((old) => ({ ...old, [k]: j.control }));
      setMessages((old) => ({ ...old, [k]: "Saved successfully." }));
    } catch { setMessages((old) => ({ ...old, [k]: "Network error. Check your connection and try again." })); }
    finally { setBusy(null); }
  }
  if (!elections.length) return <p className="text-sm text-ink-soft">Create an election in Election setup before configuring agent access.</p>;
  return <div className="space-y-8">{elections.map((e) => <section key={e.id} className="space-y-4 rounded-lg border border-rule p-4">
    <header><h2 className="text-lg font-semibold">{e.name}</h2><p className="text-sm text-ink-soft">Election date: {new Date(`${e.election_date}T12:00:00`).toLocaleDateString("en-NG")}. Each contest type is controlled independently.</p></header>
    <div className="grid gap-4 lg:grid-cols-2">{contestTypes.map((t) => {
      const k = key(e.id, t.value);
const d = drafts[k];

if (!d) {
  setMessages((old) => ({
    ...old,
    [k]: "Draft settings are missing. Refresh the page and try again.",
  }));
  return;
}
      const open = isAgentAccessOpen(c);
      return <article key={t.value} className="rounded-md border border-rule p-3">
        <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-semibold">{t.label}</h3><span className={`rounded px-2 py-1 text-xs font-semibold ${open ? "bg-green/10 text-green" : "bg-status-disputed/10 text-status-disputed"}`}>{open ? "AGENT ACCESS OPEN" : "AGENT ACCESS LOCKED"}</span></div>
        <label className="mt-3 block text-sm">Access mode<select className="mt-1 w-full border border-rule bg-paper-raised px-3 py-2" value={d.accessMode} onChange={(ev) => update(k, { accessMode: ev.target.value as AgentAccessMode })}><option value="scheduled">Scheduled window (automatic open/close)</option><option value="open">Open now (manual override)</option><option value="locked">Locked now (manual override)</option></select></label>
        {d.accessMode === "scheduled" && <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="block text-sm">Opens at<input required type="datetime-local" className="mt-1 w-full border border-rule bg-paper-raised px-2 py-2" value={d.opensAt} onChange={(ev) => update(k, { opensAt: ev.target.value })} /></label><label className="block text-sm">Closes at<input required type="datetime-local" className="mt-1 w-full border border-rule bg-paper-raised px-2 py-2" value={d.closesAt} onChange={(ev) => update(k, { closesAt: ev.target.value })} /></label></div>}
        <label className="mt-3 block text-sm">Reason / admin note{d.accessMode !== "scheduled" ? " (required)" : " (optional)"}<textarea rows={2} maxLength={500} className="mt-1 w-full border border-rule bg-paper-raised px-3 py-2" placeholder="e.g. Presidential election polling and collation window" value={d.reason} onChange={(ev) => update(k, { reason: ev.target.value })} /></label>
        {c && <p className="mt-2 text-xs text-ink-soft">Last saved: {new Date((c as AgentAccessControl & { updated_at?: string }).updated_at ?? "").toLocaleString("en-NG")}</p>}
        <button disabled={busy === k} onClick={() => void save(e, t)} className="mt-3 rounded bg-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy === k ? "Saving…" : "Save access settings"}</button>
        {messages[k] && <p role="status" className="mt-2 text-sm text-ink-soft">{messages[k]}</p>}
      </article>;
    })}</div>
  </section>)}</div>;
}
