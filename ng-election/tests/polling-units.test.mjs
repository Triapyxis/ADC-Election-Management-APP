import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { parseCsv, analyse, titleCase } from "../scripts/lib/polling-units.mjs";

const H = ",state,lg,ward,state_code,lg_code,ward_code,pu_code,code,location,ward_des,lg_des,senatorial,house_of_rep";
const row = (i, o = {}) => { const d = { state: "delta", lg: "ndokwa west", ward: "utagba ogbe", sc: "10", lc: "12", wc: "01", pc: "033", loc: "in front of post office", sen: "deltal north", fed: "nkokwa east/ndokwa west", ...o };
  return `${i},${d.state},${d.lg},${d.ward},${d.sc},${d.lc},${d.wc},${d.pc},${o.code ?? `${d.sc}/${d.lc}/${d.wc}/${d.pc}`},${d.loc},x,y,${d.sen},${d.fed}`; };

test("quoted commas and escaped quotes parse", () => {
  assert.deepEqual(parseCsv('a,b\n"x, y","he said ""hi"""\n')[1], ["x, y", 'he said "hi"']);
});
test("leading zeros are preserved", () => {
  const r = analyse([H, row(0)].join("\n"));
  assert.equal(r.entities.units[0].official_code, "10/12/01/033");
  assert.equal(r.entities.lgas[0].inec_code, "12"); assert.equal(r.entities.wards[0].inec_code, "01");
});
test("code/segment mismatch and duplicates are row errors, not silently imported", () => {
  const r = analyse([H, row(0), row(1, { code: "10/12/01/034" }), row(2)].join("\n"));
  assert.equal(r.counts.valid_units, 1); assert.equal(r.errors.length, 2);
  assert.match(r.errors[0].issue, /does not match/); assert.match(r.errors[1].issue, /Duplicate/);
});
test("known senatorial typo is corrected; FCT casing handled", () => {
  const r = analyse([H, row(0), row(1, { state: "fct", sc: "37", pc: "001", sen: "fct" })].join("\n"));
  assert.equal(r.entities.sen[0].name, "Delta North");
  assert.equal(r.entities.states.find((s) => s.inec_code === "37").is_fct, true);
  assert.equal(titleCase("fct"), "FCT");
});
test("quality flags raised, source text kept verbatim", () => {
  const r = analyse([H, row(0, { loc: "guh" }), row(1, { pc: "002", loc: "a  b school" })].join("\n"));
  assert.ok(r.entities.units[0].flags.includes("short_name"));
  assert.equal(r.entities.units[1].source_location, "a  b school");
  assert.ok(r.entities.units[1].flags.includes("whitespace_normalised"));
});
test("analysis is deterministic (idempotent input -> identical output)", () => {
  const t = [H, row(0), row(1, { pc: "002" })].join("\n");
  assert.deepEqual(analyse(t).entities, analyse(t).entities);
});
test("missing required column is fatal", () => assert.ok(analyse("a,b\n1,2").fatal));

const real = process.env.POLLING_UNITS_CSV;
test("real file: official totals and zero row errors", { skip: !real || !existsSync(real) }, () => {
  const r = analyse(readFileSync(real, "utf8"));
  assert.equal(r.counts.errors, 0);
  assert.deepEqual([r.counts.valid_units, r.counts.states, r.counts.lgas, r.counts.wards, r.counts.senatorial_districts, r.counts.federal_constituencies], [176846, 37, 774, 8809, 109, 360]);
});
