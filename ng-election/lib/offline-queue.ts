export type Queued = { key: string; body: unknown; queuedAt: string; state: "pending_server_validation" | "needs_attention"; error?: string };
export type SendResult = { status: number; error?: string };

/** Idempotent by key: re-queuing the same submission never creates a second entry. */
export const enqueue = (q: Queued[], key: string, body: unknown, now = new Date()): Queued[] =>
  q.some((i) => i.key === key) ? q : [...q, { key, body, queuedAt: now.toISOString(), state: "pending_server_validation" }];

/** Send in order. 2xx = server has it (drop). 400/403/422 = server refused: keep for a human, never retry blindly.
 *  401/5xx/network error = keep as pending and stop, so we neither lose data nor hammer a struggling server.
 *  Queued items are never reported as verified: only the server response drops them. */
export async function flush(q: Queued[], send: (body: unknown, key: string) => Promise<SendResult>) {
  const out: Queued[] = []; let halted = false; const sent: string[] = [];
  for (const item of q) {
    if (halted || item.state === "needs_attention") { out.push(item); continue; }
    let r: SendResult; try { r = await send(item.body, item.key); } catch { halted = true; out.push(item); continue; }
    if (r.status >= 200 && r.status < 300) { sent.push(item.key); continue; }
    if ([400, 403, 422].includes(r.status)) { out.push({ ...item, state: "needs_attention", error: r.error ?? `Rejected (${r.status})` }); continue; }
    halted = true; out.push(item);
  }
  return { queue: out, sent };
}
