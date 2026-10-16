#!/usr/bin/env node
// Trial/sample geocoding. DEFAULT IS A DRY RUN (no provider calls, no writes).
// node scripts/geocode-run.mjs --provider nominatim --limit 25            -> shows what WOULD run
// node scripts/geocode-run.mjs --provider nominatim --limit 25 --confirm  -> calls provider + writes results
// Add --retry to include previously failed units. Verified units are never touched.
import { runBatch, toUpdate } from "./lib/geocode.mjs";
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i > -1 ? a[i + 1] : d; };
const confirm = a.includes("--confirm"), retry = a.includes("--retry"), limit = Number(opt("--limit", "25")), pname = opt("--provider");
if (!pname) { console.error("Provide --provider <name> (scripts/providers/<name>.mjs)."); process.exit(2); }
const mod = await import(`./providers/${pname.replace(/[^a-z0-9-]/gi, "")}.mjs`);
if (mod.MAX_RUN && limit > mod.MAX_RUN) { console.error(`Refusing: ${pname} allows at most ${mod.MAX_RUN} per run (provider usage policy).`); process.exit(1); }

const { createClient } = await import("@supabase/supabase-js");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."); process.exit(2); }
const db = createClient(url, key, { auth: { persistSession: false } });

const statuses = retry ? ["pending", "failed"] : ["pending"];
const { data, error } = await db.from("polling_units").select("id,name,latitude,longitude,geocode_status,wards(name,lgas(name,states(name)))").in("geocode_status", statuses).order("official_code").limit(limit);
if (error) throw error;
const units = (data ?? []).map((r) => ({ id: r.id, name: r.name, ward: r.wards?.name, lga: r.wards?.lgas?.name, state: r.wards?.lgas?.states?.name, geocodeStatus: r.geocode_status, existing: r.latitude != null ? { lat: r.latitude, lon: r.longitude } : null }));
console.log(`${units.length} unit(s) selected (${statuses.join("+")}), provider ${pname}. ${confirm ? "LIVE RUN" : "DRY RUN (add --confirm to call the provider and write)"}`);
if (!confirm) { units.slice(0, 5).forEach((u) => console.log(" would query:", [u.name, u.ward, u.lga, u.state, "Nigeria"].filter(Boolean).join(", "))); process.exit(0); }

const provider = mod.make({ contact: process.env.GEOCODE_CONTACT });
const { results, stats } = await runBatch({ units, provider, providerName: mod.name, minGapMs: 1100 });
for (const r of results) {
  await db.from("geocode_attempts").insert({ polling_unit_id: r.unitId, provider: r.provider, query: r.query, outcome: r.outcome, reason: r.reason ?? null, latitude: r.lat ?? null, longitude: r.lon ?? null, confidence: r.confidence ?? null });
  await db.from("polling_units").update(toUpdate(r)).eq("id", r.unitId).neq("geocode_status", "verified");   // never overwrite verified
}
const tally = results.reduce((t, r) => ((t[r.outcome] = (t[r.outcome] ?? 0) + 1), t), {});
console.log({ stats, outcomes: tally, note: "Results are unverified candidates. A person must verify each one before geofencing uses it." });
