import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase/user";
import { validateSetup, type Kind } from "@/lib/setup";
const json = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { "Cache-Control": "no-store" } });
const nul = (v: unknown) => (v === "" || v === undefined ? null : v);

/** Creates election/party/contest/candidate rows. Authorization = RLS (election_admin or super_admin only), not this code. */
export async function POST(req: Request) {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  let b: { kind: Kind } & Record<string, any>; try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  const issues = validateSetup(b.kind, b); if (issues.length) return json({ error: "Validation failed.", issues }, 422);
  const q = b.kind === "election" ? sb.from("elections").insert({ name: b.name.trim(), election_date: b.electionDate, status: b.status, is_public: !!b.isPublic })
    : b.kind === "party" ? sb.from("parties").insert({ abbreviation: b.abbreviation, name: b.name.trim(), brand_colour: nul(b.brandColour), logo_url: nul(b.logoUrl) })
    : b.kind === "contest" ? sb.from("contests").insert({ election_id: b.electionId, type: b.type, name: b.name.trim(), state_id: nul(b.stateId), senatorial_district_id: nul(b.senatorialDistrictId), federal_constituency_id: nul(b.federalConstituencyId) })
    : sb.from("candidates").insert({ contest_id: b.contestId, party_id: b.partyId, full_name: b.fullName.trim(), photo_url: nul(b.photoUrl) });
  const { error } = await q;
  return error ? json({ error: error.code === "23505" ? "That record already exists." : "Not permitted, or the record could not be saved." }, error.code === "23505" ? 409 : 403) : json({ ok: true }, 201);
}
