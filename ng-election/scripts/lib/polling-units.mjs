// Dependency-free parsing + validation for the polling-unit CSV.
// Pure functions only (no I/O) so they are unit-testable.

export const REQUIRED = ["state","lg","ward","state_code","lg_code","ward_code","pu_code","code","location","senatorial","house_of_rep"];
const SENATORIAL_FIXES = { "deltal north": "delta north" }; // known source typo; extend only with verified fixes

/** RFC 4180 parser. Everything stays a string, so "01" never becomes 1. */
export function parseCsv(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows;
}

export const clean = (s) => s.replace(/\s+/g, " ").trim();
export function titleCase(s) {
  const t = clean(s).toLowerCase().replace(/(^|[\s/(\-])([a-z])/g, (_, a, b) => a + b.toUpperCase());
  return t === "Fct" ? "FCT" : t;
}

export function analyse(csvText) {
  const [header, ...body] = parseCsv(csvText);
  const missing = REQUIRED.filter((c) => !header?.includes(c));
  if (missing.length) return { fatal: `Missing required columns: ${missing.join(", ")}` };
  const ix = Object.fromEntries(header.map((h, i) => [h, i]));
  const errors = [], seen = new Map(), units = [];
  const states = new Map(), lgas = new Map(), wards = new Map(), sen = new Map(), fed = new Map();
  const nameKey = new Map();

  body.forEach((r, n) => {
    if (r.length === 1 && r[0] === "") return;
    const line = n + 2, g = (c) => r[ix[c]] ?? "";
    const err = (issue) => errors.push({ line, code: g("code"), issue });
    if (r.length !== header.length) return err(`Expected ${header.length} columns, found ${r.length}`);
    const [sc, lc, wc, pc, code] = ["state_code","lg_code","ward_code","pu_code","code"].map(g);
    if (!/^\d{2}$/.test(sc) || !/^\d{2}$/.test(lc) || !/^\d{2}$/.test(wc) || !/^\d{3}$/.test(pc)) return err("Malformed code segment");
    if (code !== `${sc}/${lc}/${wc}/${pc}`) return err("code does not match its segments");
    if (seen.has(code)) return err(`Duplicate official code (first seen line ${seen.get(code)})`);
    seen.set(code, line);
    const required = ["state","lg","ward","location"].find((c) => !clean(g(c)));
    if (required) return err(`Empty ${required}`);

    const stateName = titleCase(g("state"));
    const prev = states.get(sc);
    if (prev && prev.name !== stateName) return err(`state_code ${sc} maps to both "${prev.name}" and "${stateName}"`);
    states.set(sc, { inec_code: sc, name: stateName, is_fct: stateName === "FCT" });
    lgas.set(`${sc}/${lc}`, { state: sc, inec_code: lc, name: titleCase(g("lg")) });
    wards.set(`${sc}/${lc}/${wc}`, { state: sc, lga: lc, inec_code: wc, name: titleCase(g("ward")) });

    const senRaw = clean(g("senatorial")).toLowerCase();
    const senName = titleCase(SENATORIAL_FIXES[senRaw] ?? senRaw);
    const fedName = titleCase(g("house_of_rep"));
    sen.set(`${sc}|${senName}`, { state: sc, name: senName });
    fed.set(`${sc}|${fedName}`, { state: sc, name: fedName });

    const raw = g("location"), name = clean(raw), flags = [];
    if (name.length < 4) flags.push("short_name");
    if (raw.length === 100) flags.push("possible_truncation");
    if (/\s{2,}/.test(raw)) flags.push("whitespace_normalised");
    if (/[^\x00-\x7f]/.test(raw)) flags.push("non_ascii");
    const k = `${code.slice(0, 8)}|${name.toLowerCase()}`;
    if (nameKey.has(k)) { flags.push("duplicate_name_in_ward"); nameKey.get(k).flags.push("duplicate_name_in_ward"); }
    const u = { official_code: code, state: sc, lga: lc, ward: wc, inec_pu_code: pc, name, source_location: raw, senatorial: senName, constituency: fedName, flags };
    if (!nameKey.has(k)) nameKey.set(k, u);
    units.push(u);
  });

  const flagCounts = {};
  units.forEach((u) => [...new Set(u.flags)].forEach((f) => (flagCounts[f] = (flagCounts[f] || 0) + 1)));
  const byState = {};
  for (const u of units) {
    const s = (byState[u.state] ??= { name: states.get(u.state).name, polling_units: 0, lgas: new Set(), wards: new Set() });
    s.polling_units++; s.lgas.add(u.lga); s.wards.add(u.lga + "/" + u.ward);
  }
  for (const s of Object.values(byState)) { s.lgas = s.lgas.size; s.wards = s.wards.size; }

  return {
    counts: { rows: body.length, valid_units: units.length, errors: errors.length, states: states.size, lgas: lgas.size, wards: wards.size, senatorial_districts: sen.size, federal_constituencies: fed.size },
    flagCounts, byState, errors,
    entities: { states: [...states.values()], lgas: [...lgas.values()], wards: [...wards.values()], sen: [...sen.values()], fed: [...fed.values()], units },
  };
}
