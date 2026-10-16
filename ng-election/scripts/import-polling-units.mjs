#!/usr/bin/env node
// Usage: node scripts/import-polling-units.mjs --file path.csv (--preview | --apply)
// --preview never touches the database. --apply upserts on official codes; it never deletes
// and never writes latitude/longitude/geocode_status, so existing coordinates survive re-runs.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { analyse } from "./lib/polling-units.mjs";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : undefined; };
const apply = args.includes("--apply");
const file = opt("--file") ?? process.env.POLLING_UNITS_CSV;
if (!file) { console.error("Provide --file <csv> or POLLING_UNITS_CSV."); process.exit(2); }

const text = readFileSync(file, "utf8");
const sha = createHash("sha256").update(text).digest("hex");
const r = analyse(text);
if (r.fatal) { console.error(r.fatal); process.exit(1); }

mkdirSync("reports", { recursive: true });
const { entities, ...report } = r;
const out = { file, sha256: sha, mode: apply ? "apply" : "preview", generated_at: new Date().toISOString(), ...report };
writeFileSync("reports/import-report.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify({ sha256: sha, counts: r.counts, flags: r.flagCounts }, null, 2));
console.log(`Full per-state coverage + row errors: reports/import-report.json`);

if (!apply) { console.log("Preview only. Nothing written to the database."); process.exit(r.errors.length ? 1 : 0); }
if (r.errors.length) { console.error(`Refusing to apply: ${r.errors.length} row errors. Fix or review the report.`); process.exit(1); }

const { createClient } = await import("@supabase/supabase-js");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."); process.exit(2); }
const db = createClient(url, key, { auth: { persistSession: false } });

const chunk = (a, n = 1000) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
async function upsert(table, rows, onConflict) {
  for (const c of chunk(rows)) { const { error } = await db.from(table).upsert(c, { onConflict }); if (error) throw new Error(`${table}: ${error.message}`); }
}
async function all(table, cols) {
  const rows = []; for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(cols).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`); rows.push(...data); if (data.length < 1000) return rows;
  }
}

const { data: run, error: runErr } = await db.from("import_runs").insert({ source_filename: file.split("/").pop(), source_sha256: sha, mode: "apply", status: "running" }).select("id").single();
if (runErr) throw new Error(runErr.message);
try {
  const e = entities;
  await upsert("states", e.states, "inec_code");
  const st = Object.fromEntries((await all("states", "id,inec_code")).map((s) => [s.inec_code, s.id]));
  await upsert("lgas", e.lgas.map((l) => ({ state_id: st[l.state], inec_code: l.inec_code, name: l.name })), "state_id,inec_code");
  await upsert("senatorial_districts", e.sen.map((s) => ({ state_id: st[s.state], name: s.name })), "state_id,name");
  await upsert("federal_constituencies", e.fed.map((s) => ({ state_id: st[s.state], name: s.name })), "state_id,name");
  const lg = Object.fromEntries((await all("lgas", "id,state_id,inec_code")).map((l) => [`${l.state_id}/${l.inec_code}`, l.id]));
  await upsert("wards", e.wards.map((w) => ({ lga_id: lg[`${st[w.state]}/${w.lga}`], inec_code: w.inec_code, name: w.name })), "lga_id,inec_code");
  const wd = Object.fromEntries((await all("wards", "id,lga_id,inec_code")).map((w) => [`${w.lga_id}/${w.inec_code}`, w.id]));
  const sn = Object.fromEntries((await all("senatorial_districts", "id,state_id,name")).map((s) => [`${s.state_id}|${s.name}`, s.id]));
  const fc = Object.fromEntries((await all("federal_constituencies", "id,state_id,name")).map((s) => [`${s.state_id}|${s.name}`, s.id]));
  await upsert("polling_units", e.units.map((u) => {
    const sid = st[u.state], lid = lg[`${sid}/${u.lga}`];
    return { official_code: u.official_code, inec_pu_code: u.inec_pu_code, ward_id: wd[`${lid}/${u.ward}`], name: u.name, source_location: u.source_location,
      senatorial_district_id: sn[`${sid}|${u.senatorial}`], federal_constituency_id: fc[`${sid}|${u.constituency}`], data_quality_flags: [...new Set(u.flags)] };
  }), "official_code");
  await db.from("import_runs").update({ status: "completed", counts: r.counts, issues: r.flagCounts, finished_at: new Date().toISOString() }).eq("id", run.id);
  console.log("Import completed. Verify counts in the database against the report above.");
} catch (err) {
  await db.from("import_runs").update({ status: "failed", issues: [String(err.message)], finished_at: new Date().toISOString() }).eq("id", run.id);
  throw err;
}
