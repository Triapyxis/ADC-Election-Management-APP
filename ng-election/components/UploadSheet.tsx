"use client";
import { useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { ALLOWED, MAX_BYTES, BUCKET } from "@/lib/upload";

export function UploadSheet({ submissionId }: { submissionId: string }) {
  const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [n, setN] = useState(0);
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; setMsg(null);
    if (!(f.type in ALLOWED)) return setMsg("Use a JPEG, PNG, WebP or PDF file."); if (f.size > MAX_BYTES) return setMsg("That file is larger than 10 MB.");
    setBusy(true);
    try {
      const a = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionId, filename: f.name, contentType: f.type, size: f.size }) });
      const aj = await a.json(); if (!a.ok) throw new Error(aj.issues?.join(" ") ?? aj.error);
      const up = await browserClient().storage.from(BUCKET).uploadToSignedUrl(aj.path, aj.token, f, { contentType: f.type }); if (up.error) throw new Error("Upload failed. Check your connection and try again.");
      const r = await fetch("/api/uploads", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionId, path: aj.path }) });
      const rj = await r.json(); if (!r.ok) throw new Error(rj.error); setN((x) => x + 1); setMsg("Result sheet attached.");
    } catch (err: any) { setMsg(err.message ?? "Could not attach the file."); } finally { setBusy(false); }
  }
  return (<div className="mt-3 text-sm"><label className="block">Attach a photo or PDF of the result sheet (optional)
    <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" onChange={pick} disabled={busy} className="mt-1 block" /></label>
    {busy && <p>Uploading.</p>}{msg && <p role="status">{msg}</p>}{n > 0 && <p className="text-ink-soft">{n} file{n > 1 ? "s" : ""} attached to this submission.</p>}</div>);
}
