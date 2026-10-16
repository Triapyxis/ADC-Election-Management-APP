// Geocoding runner core. Provider-agnostic: a provider is `async (query) => {lat,lon,confidence} | null`.
// Rules: never invent coordinates; never auto-mark "verified"; never overwrite verified or conflicting locations.
import { haversineM } from "../../lib/geofence.ts";

export const NIGERIA_BOUNDS = { latMin: 4.0, latMax: 14.0, lonMin: 2.5, lonMax: 14.8 };
export const MIN_CONFIDENCE = 0.5;
export const CONFLICT_M = 1000;

export const buildQuery = (u) => [u.name, u.ward, u.lga, u.state, "Nigeria"].filter(Boolean).join(", ");

/** Turn one provider answer into a status. Statuses here never include 'verified' (human step). */
export function classify(res, existing) {
  if (!res || !Number.isFinite(res.lat) || !Number.isFinite(res.lon)) return { outcome: "failed", reason: "no_result" };
  const b = NIGERIA_BOUNDS;
  if (res.lat < b.latMin || res.lat > b.latMax || res.lon < b.lonMin || res.lon > b.lonMax) return { outcome: "failed", reason: "outside_nigeria" };
  if (existing?.lat != null && haversineM(existing.lat, existing.lon, res.lat, res.lon) > CONFLICT_M)
    return { outcome: "conflicting", reason: "differs_from_existing", lat: res.lat, lon: res.lon, confidence: res.confidence };
  if ((res.confidence ?? 0) < MIN_CONFIDENCE) return { outcome: "low_confidence", lat: res.lat, lon: res.lon, confidence: res.confidence ?? 0 };
  return { outcome: "geocoded_unverified", lat: res.lat, lon: res.lon, confidence: res.confidence };
}

/** Process units sequentially with a minimum gap between provider calls. Cache hits cost no call.
 *  Resumable: only units not 'verified' are processed; callers pass `done` ids to skip. A provider
 *  error is recorded as failed (retryable), never thrown away silently. */
export async function runBatch({ units, provider, providerName, cache = new Map(), minGapMs = 1000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), done = new Set(), limit = Infinity }) {
  const results = []; let calls = 0, hits = 0, last = -Infinity;
  for (const u of units) {
    if (results.length >= limit) break;
    if (done.has(u.id) || u.geocodeStatus === "verified") continue;
    const query = buildQuery(u); let res, reason;
    if (cache.has(query)) { res = cache.get(query); hits++; }
    else {
      const wait = last + minGapMs - Date.now(); if (wait > 0) await sleep(wait);
      try { res = await provider(query); cache.set(query, res); } catch (e) { reason = `provider_error: ${e.message}`; }
      last = Date.now(); calls++;
    }
    const c = reason ? { outcome: "failed", reason } : classify(res, u.existing);
    results.push({ unitId: u.id, provider: providerName, query, ...c });
  }
  return { results, stats: { calls, cacheHits: hits, processed: results.length } };
}

/** Cost/time estimate before any national run. pricePer1000 and rps come from the chosen provider's terms. */
export function estimate({ units, pricePer1000, rps, cacheHitRate = 0 }) {
  const calls = Math.ceil(units * (1 - cacheHitRate));
  return { calls, costUsd: +(calls / 1000 * pricePer1000).toFixed(2), hours: +(calls / rps / 3600).toFixed(1) };
}

/** What the DB update may change. Never touches verified rows; conflicting keeps existing coordinates. */
export function toUpdate(r) {
  if (r.outcome === "geocoded_unverified" || r.outcome === "low_confidence")
    return { latitude: r.lat, longitude: r.lon, geocode_status: r.outcome };
  return { geocode_status: r.outcome };
}
