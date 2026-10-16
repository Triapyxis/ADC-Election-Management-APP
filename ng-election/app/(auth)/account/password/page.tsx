"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";
export default function ChangePassword() {
  const [a, setA] = useState(""), [b, setB] = useState(""), [msg, setMsg] = useState<string | null>(null), [busy, setBusy] = useState(false), router = useRouter();
  async function go(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (a.length < 12) return setMsg("Use at least 12 characters."); if (a.length > 72) return setMsg("Use at most 72 characters."); if (a !== b) return setMsg("The two passwords do not match.");
    setBusy(true); const { error } = await browserClient().auth.updateUser({ password: a, data: { must_change_password: false } }); setBusy(false);
    if (error) return setMsg("Could not change the password. Try a different one."); router.push("/account"); router.refresh();
  }
  const c = "mt-1 w-full border border-rule bg-paper-raised px-3 py-2";
  return (<form onSubmit={go} className="max-w-sm space-y-4"><h1 className="text-2xl font-semibold">Choose a new password</h1><p className="text-sm text-ink-soft">At least 12 characters. A phrase of several words works well.</p>
    <label className="block text-sm">New password<input type="password" autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value)} className={c} /></label>
    <label className="block text-sm">Repeat it<input type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} className={c} /></label>
    {msg && <p role="alert" className="text-sm text-status-disputed">{msg}</p>}<button disabled={busy} className="bg-green px-4 py-2 text-white disabled:opacity-60">{busy ? "Saving" : "Save password"}</button></form>);
}
