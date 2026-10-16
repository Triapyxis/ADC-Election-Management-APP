import { serviceClient } from "@/lib/supabase/user";
import { CHANNEL, EVENT } from "@/lib/realtime";
/** Tells connected visitors "results changed". Carries NO data: clients refetch through the normal, permissioned pages.
 *  Best effort: a failure here must never fail the verification or declaration that triggered it (clients also poll). */
export async function notifyResultsChanged() {
  try {
    const ch = serviceClient().channel(CHANNEL);
    await ch.send({ type: "broadcast", event: EVENT, payload: { at: new Date().toISOString() } });
    void ch.unsubscribe();
  } catch { /* polling fallback covers it */ }
}
