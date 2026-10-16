// Builds lib/ng-map.json from the Simplemaps SVG (free for commercial use; attribution appreciated).
import { readFileSync, writeFileSync } from "node:fs";
const svg = readFileSync(process.argv[2], "utf8");
const paths = [...svg.matchAll(/<path[^>]*?(?:class="([^"]*)")?[^>]*?\bd="([^"]+)"[^>]*?\bid="(NG\w\w)"|<path[^>]*?\bid="(NG\w\w)"[^>]*?\bd="([^"]+)"/g)];
const names = Object.fromEntries([...svg.matchAll(/<path[^>]*?\bid="(NG\w\w)"[^>]*?\bname="([^"]+)"|<path[^>]*?\bname="([^"]+)"[^>]*?\bid="(NG\w\w)"/g)].map(m => [m[1] ?? m[4], m[2] ?? m[3]]));
const states = [];
for (const m of svg.matchAll(/<path\b[^>]*>/g)) {
  const t = m[0], id = /\bid="(NG\w\w)"/.exec(t)?.[1], d = /\bd="([^"]+)"/.exec(t)?.[1], name = /\bname="([^"]+)"/.exec(t)?.[1];
  if (id && d) states.push({ id, name: (name ?? names[id]), d });
}
const fix = { "Nassarawa": "Nasarawa", "Federal Capital Territory": "FCT" };
const out = states.map(s => ({ ...s, name: fix[s.name] ?? s.name, key: (fix[s.name] ?? s.name).toLowerCase() }));
writeFileSync("lib/ng-map.json", JSON.stringify(out));
console.log(out.length, "shapes;", out.filter(s => !s.name).length, "unnamed");
