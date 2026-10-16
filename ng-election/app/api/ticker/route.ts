import { NextResponse } from "next/server";
import { getPresidentialSnapshot } from "@/lib/results";
import type { TickerItem } from "@/lib/ticker";

export const dynamic = "force-dynamic";

/** Public, read-only. Built only from the verified-results view: no agent data, no coordinates. */
export async function GET() {
  try {
    const s = await getPresidentialSnapshot();
    const items: TickerItem[] = s ? Object.entries(s.stateLeaders).flatMap(([key, l]) => {
      const c = s.candidates.find((x) => x.id === l.candidateId);
      return c ? [{ id: key, label: key.replace(/\b\w/g, (m) => m.toUpperCase()).replace(/^Fct$/, "FCT"), leader: c.party, votes: l.votes, reportedAt: s.latestSubmissionAt }] : [];
    }) : [];
    return NextResponse.json({ items, syncedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
