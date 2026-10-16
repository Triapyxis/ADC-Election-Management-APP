import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase/user";
const UUID = /^[0-9a-f-]{36}$/i;
/** Dependent selector data. Geography is public; polling units are limited by RLS to the caller's scope. */
export async function GET(req: Request) {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const u = new URL(req.url), level = u.searchParams.get("level"), parent = u.searchParams.get("parent") ?? "";
  if (level !== "states" && !UUID.test(parent)) return NextResponse.json({ error: "parent required" }, { status: 400 });
  const q = level === "states" ? sb.from("states").select("id,name").order("name")
    : level === "lgas" ? sb.from("lgas").select("id,name").eq("state_id", parent).order("name")
    : level === "wards" ? sb.from("wards").select("id,name").eq("lga_id", parent).order("name")
    : level === "units" ? sb.from("polling_units").select("id,name,official_code").eq("ward_id", parent).order("official_code")
    : null;
  if (!q) return NextResponse.json({ error: "bad level" }, { status: 400 });
  const { data, error } = await q.limit(1000);
  return error ? NextResponse.json({ error: "unavailable" }, { status: 500 }) : NextResponse.json({ items: data }, { headers: { "Cache-Control": "no-store" } });
}
