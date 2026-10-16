"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function GenerateButton({ contestId }: { contestId: string }) {
  const [msg, setMsg] = useState<string | null>(null), router = useRouter();
  async function go() { setMsg(null); const r = await fetch("/api/projections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contestId }) }); const j = await r.json().catch(() => ({})); r.ok ? (setMsg(j.status === "ok" ? "Draft created." : "Not enough data to project yet. A record was saved."), router.refresh()) : setMsg(j.error ?? "Could not create."); }
  return <span><button onClick={go} className="bg-green px-3 py-1.5 text-sm text-white">Generate draft projection</button>{msg && <span role="status" className="ml-3 text-sm">{msg}</span>}</span>;
}
export function PublishButton({ id, published }: { id: string; published: boolean }) {
  const [msg, setMsg] = useState<string | null>(null), router = useRouter();
  async function go() { const r = await fetch("/api/projections", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, published: !published }) }); const j = await r.json().catch(() => ({})); r.ok ? router.refresh() : setMsg(j.error ?? "Failed."); }
  return <span><button onClick={go} className="text-sm text-green underline">{published ? "Withdraw from the situation room" : "Release to the situation room"}</button>{msg && <span role="alert" className="ml-2 text-sm text-status-disputed">{msg}</span>}</span>;
}
