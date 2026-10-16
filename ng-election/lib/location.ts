export const BOUNDS = { latMin: 4.0, latMax: 14.0, lonMin: 2.5, lonMax: 14.8 };
export type LocationInput = { pollingUnitId?: string; latitude?: number | string | null; longitude?: number | string | null; status?: string; note?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Verification is a human act: needs in-Nigeria coordinates and a note saying how the location was confirmed. */
export function validateLocation(i: LocationInput): string[] {
  const o: string[] = [];
  if (!UUID.test(i.pollingUnitId ?? "")) o.push("Polling unit is required.");
  if (i.status !== "verified" && i.status !== "needs_manual_correction") o.push("Status must be verified or needs manual correction.");
  if ((i.note ?? "").trim().length < 10) o.push("Say how the location was confirmed (at least 10 characters).");
  if (i.status === "verified") {
    const lat = Number(i.latitude), lon = Number(i.longitude);
    if (i.latitude === "" || i.longitude === "" || i.latitude == null || i.longitude == null || !Number.isFinite(lat) || !Number.isFinite(lon)) o.push("Latitude and longitude are required to verify.");
    else if (lat < BOUNDS.latMin || lat > BOUNDS.latMax || lon < BOUNDS.lonMin || lon > BOUNDS.lonMax) o.push("Coordinates are outside Nigeria. Check you did not swap latitude and longitude.");
  }
  return o;
}
