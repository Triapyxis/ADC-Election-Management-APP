// OpenStreetMap Nominatim adapter. FOR SMALL TRIAL SAMPLES ONLY: OSM's usage policy forbids bulk geocoding
// (max 1 request/second, identifying User-Agent, no national-scale runs). Evaluate a paid/licensed provider for the full set.
export const name = "nominatim";
export const MAX_RUN = 500;

/** Confidence is OUR heuristic from OSM's place_rank, not a provider-reported probability.
 *  A school name that only matched at town level must NOT look precise. */
export function parse(results) {
  const r = Array.isArray(results) ? results[0] : null;
  if (!r) return null;
  const lat = Number(r.lat), lon = Number(r.lon), rank = Number(r.place_rank ?? 0);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon, confidence: rank >= 26 ? 0.8 : rank >= 20 ? 0.45 : 0.2 };
}
export function make({ contact }) {
  if (!contact) throw new Error("Set GEOCODE_CONTACT to an email or URL: OSM requires an identifying User-Agent.");
  return async (query) => {
    const u = new URL("https://nominatim.openstreetmap.org/search");
    u.search = new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "ng", q: query }).toString();
    const res = await fetch(u, { headers: { "User-Agent": `ng-election-monitor (${contact})` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parse(await res.json());
  };
}
