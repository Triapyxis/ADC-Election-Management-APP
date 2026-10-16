// node scripts/geocode-estimate.mjs --price 5 --rps 10 [--units 176846]   (no network, no DB)
import { estimate } from "./lib/geocode.mjs";
const a = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? Number(process.argv[i + 1]) : d; };
const price = a("--price"), rps = a("--rps");
if (!price || !rps) { console.error("Provide --price (USD per 1000 requests) and --rps from the provider's published terms."); process.exit(2); }
console.log(estimate({ units: a("--units", 176846), pricePer1000: price, rps, cacheHitRate: a("--cache", 0) }));
