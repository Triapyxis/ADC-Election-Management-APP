import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase/user";
import { parseBearer, hashKey } from "@/lib/stations";
import { getFeed, type Feed } from "@/lib/room-data";
import { createFeedCache, createToucher } from "@/lib/feed-cache";
export const dynamic = "force-dynamic";
const hdr = { "Cache-Control": "no-store" };
const cache = createFeedCache<Feed>();      // per warm server instance: identical for all stations, so one load serves every laptop
const touch = createToucher(60_000);        // "last seen" is written at most once a minute per key

/** READ-ONLY feed for situation-room laptops. Requires a station key issued by an admin. Returns display data only. */
export async function GET(req: Request) {
  const key = parseBearer(req.headers.get("authorization"));
  if (!key) return NextResponse.json({ error: "Station key required." }, { status: 401, headers: hdr });
  const svc = serviceClient();
  const { data: row } = await svc.from("station_keys").select("id,revoked_at").eq("key_hash", hashKey(key)).maybeSingle();
  if (!row || row.revoked_at) return NextResponse.json({ error: "Station key not valid." }, { status: 401, headers: hdr });   // same message: no probing
  if (touch(row.id)) void svc.from("station_keys").update({ last_seen_at: new Date().toISOString() }).eq("id", row.id);
  try {
    const r = await cache.get(() => getFeed(svc));
    return NextResponse.json(r.value, { headers: { ...hdr, "X-Feed-Age": String(r.ageMs), ...(r.stale ? { "X-Feed-Stale": "1" } : {}) } });   // value.syncedAt is when it was really read, so laptops label it honestly
  } catch { return NextResponse.json({ error: "Feed unavailable." }, { status: 503, headers: hdr }); }
}
