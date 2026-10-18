// Server-side geofence evaluation. Pure function: the caller passes raw evidence; distance and
// status are ALWAYS computed here. Never accept a client-supplied distance or "inside" flag.

export const GEOFENCE = { radiusM: 200, maxAccuracyM: 50, maxEvidenceAgeS: 120 } as const;
// maxEvidenceAgeS is a configurable policy choice (the brief did not specify one).

export type GeofenceOutcome =
  | "within_radius" | "outside_radius" | "poor_accuracy" | "gps_missing"
  | "stale_location" | "pu_coordinates_unverified" | "pu_coordinates_missing";

export type Evidence = { lat: number | null; lon: number | null; accuracyM: number | null; locationTime: Date | null; receivedAt: Date };
export type PollingUnitGeo = { lat: number | null; lon: number | null; geocodeStatus: string };
export type GeofenceResult = { outcome: GeofenceOutcome; distanceM: number | null; geofenceReady: boolean };
export type GeofenceConfig = { radiusM: number; maxAccuracyM: number; maxEvidenceAgeS: number };

export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_008.8, rad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

const valid = (lat: number | null, lon: number | null) =>
  lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

/** Order matters: we never report "within radius" unless the PU location is verified AND the evidence is usable.
 *  Outside-radius is a review flag, never a reason to discard the submission. */
export function evaluateGeofence(e: Evidence, pu: PollingUnitGeo, cfg: GeofenceConfig = GEOFENCE): GeofenceResult {
  if (!valid(pu.lat, pu.lon)) return { outcome: "pu_coordinates_missing", distanceM: null, geofenceReady: false };
  if (pu.geocodeStatus !== "verified") return { outcome: "pu_coordinates_unverified", distanceM: null, geofenceReady: false };
  if (!valid(e.lat, e.lon) || e.accuracyM == null || !Number.isFinite(e.accuracyM) || e.accuracyM < 0 || !e.locationTime)
    return { outcome: "gps_missing", distanceM: null, geofenceReady: true };
  const ageS = (e.receivedAt.getTime() - e.locationTime.getTime()) / 1000;
  if (ageS > cfg.maxEvidenceAgeS || ageS < -30) return { outcome: "stale_location", distanceM: null, geofenceReady: true }; // future-dated = untrustworthy
  if (e.accuracyM > cfg.maxAccuracyM) return { outcome: "poor_accuracy", distanceM: null, geofenceReady: true };
  const d = haversineM(e.lat!, e.lon!, pu.lat!, pu.lon!);
  return { outcome: d <= cfg.radiusM ? "within_radius" : "outside_radius", distanceM: Math.round(d * 10) / 10, geofenceReady: true };
}

/** Implausible travel between two checks (a risk indicator for review, not proof of misconduct). */
export function impliedSpeedKmh(a: { lat: number; lon: number; at: Date }, b: { lat: number; lon: number; at: Date }): number | null {
  const h = Math.abs(b.at.getTime() - a.at.getTime()) / 3_600_000;
  return h === 0 ? null : haversineM(a.lat, a.lon, b.lat, b.lon) / 1000 / h;
}
