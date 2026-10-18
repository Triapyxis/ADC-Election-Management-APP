import { haversineM } from "./geofence.ts";

export type Coverage = {
  state_name: string;
  total: number;
  with_coordinates: number;
  verified: number;
  geofence_ready: number;
  pending: number;
  geocoded_unverified: number;
  low_confidence: number;
  failed: number;
  conflicting: number;
  needs_manual: number;
};

export type Check = {
  id: string;
  agentId: string;
  puId: string;
  outcome: string;
  trigger: string;
  at: Date;
  lat: number | null;
  lon: number | null;
  puLat: number | null;
  puLon: number | null;
};

export type Risk = {
  kind:
    | "implausible_travel"
    | "identical_coordinates"
    | "many_overrides";
  subject: string;
  detail: string;
};

export function totals(rows: Coverage[]): Record<string, number> {
  const t = rows.reduce<Record<string, number>>((acc, row) => {
    for (const key of Object.keys(row) as (keyof Coverage)[]) {
      if (key === "state_name") continue;

      const value = Number(row[key] ?? 0);

      acc[key] =
        (acc[key] ?? 0) +
        (Number.isFinite(value) ? value : 0);
    }

    return acc;
  }, {});

  const total = t.total ?? 0;

  const pct = (value: number | undefined): number =>
    total > 0 ? ((value ?? 0) / total) * 100 : 0;

  return {
    ...t,
    pctCoordinates: pct(t.with_coordinates),
    pctVerified: pct(t.verified),
    pctReady: pct(t.geofence_ready),
  };
}

export const countByOutcome = (checks: Check[]) =>
  checks.reduce<Record<string, number>>((acc, check) => {
    acc[check.outcome] = (acc[check.outcome] ?? 0) + 1;
    return acc;
  }, {});

/**
 * Agents with a location check in the last 20 minutes
 * (15-minute cadence plus 5-minute grace period).
 *
 * This estimates who is on duty; it is not proof of presence.
 */
export const onDuty = (
  checks: Check[],
  now = new Date()
): number =>
  new Set(
    checks
      .filter(
        (check) =>
          now.getTime() - check.at.getTime() <= 20 * 60_000
      )
      .map((check) => check.agentId)
  ).size;

/**
 * Review prompts only.
 * GPS cannot prove or rule out spoofing.
 * These flags are not evidence of misconduct.
 */
export function riskFlags(
  checks: Check[],
  overrides: { supervisorId: string }[] = [],
  opt = {
    maxKmh: 150,
    sameSpotKm: 5,
    overrideLimit: 3,
  }
): Risk[] {
  const out: Risk[] = [];

  const withGps = checks.filter(
    (check) => check.lat != null && check.lon != null
  );

  const byAgent = new Map<string, Check[]>();

  for (const check of withGps) {
    const existing = byAgent.get(check.agentId);

    if (existing) {
      existing.push(check);
    } else {
      byAgent.set(check.agentId, [check]);
    }
  }

  for (const [agent, list] of byAgent) {
    list.sort(
      (a, b) => a.at.getTime() - b.at.getTime()
    );

    // Flag travel speeds that warrant human review.
    for (let i = 1; i < list.length; i++) {
      const previous = list[i - 1];
      const current = list[i];

      if (!previous || !current) continue;

      if (
        previous.lat == null ||
        previous.lon == null ||
        current.lat == null ||
        current.lon == null
      ) {
        continue;
      }

      const hours =
        (current.at.getTime() - previous.at.getTime()) /
        3.6e6;

      if (hours <= 0) continue;

      const kmh =
        haversineM(
          previous.lat,
          previous.lon,
          current.lat,
          current.lon
        ) /
        1000 /
        hours;

      if (kmh > opt.maxKmh) {
        out.push({
          kind: "implausible_travel",
          subject: agent,
          detail: `${Math.round(kmh)} km/h between two readings`,
        });
      }
    }

    // Group readings with identical rounded coordinates.
    const spots = new Map<string, Check[]>();

    for (const check of list) {
      if (check.lat == null || check.lon == null) continue;

      const key = `${check.lat.toFixed(5)},${check.lon.toFixed(5)}`;
      const existing = spots.get(key);

      if (existing) {
        existing.push(check);
      } else {
        spots.set(key, [check]);
      }
    }

    for (const group of spots.values()) {
      const units = new Map<string, Check>();

      for (const check of group) {
        if (
          check.puLat != null &&
          check.puLon != null
        ) {
          units.set(check.puId, check);
        }
      }

      const locations = [...units.values()];
      let farApart = false;

      for (
        let i = 0;
        i < locations.length && !farApart;
        i++
      ) {
        const first = locations[i];

        if (
          !first ||
          first.puLat == null ||
          first.puLon == null
        ) {
          continue;
        }

        for (let j = i + 1; j < locations.length; j++) {
          const second = locations[j];

          if (
            !second ||
            second.puLat == null ||
            second.puLon == null
          ) {
            continue;
          }

          const distanceKm =
            haversineM(
              first.puLat,
              first.puLon,
              second.puLat,
              second.puLon
            ) / 1000;

          if (distanceKm > opt.sameSpotKm) {
            farApart = true;
            break;
          }
        }
      }

      if (farApart) {
        out.push({
          kind: "identical_coordinates",
          subject: agent,
          detail:
            "Same exact reading used at polling units more than 5 km apart",
        });
      }
    }
  }

  // Flag supervisors with repeated overrides.
  const perSupervisor = overrides.reduce<
    Record<string, number>
  >((acc, override) => {
    acc[override.supervisorId] =
      (acc[override.supervisorId] ?? 0) + 1;

    return acc;
  }, {});

  for (const [supervisorId, count] of Object.entries(
    perSupervisor
  )) {
    if (count >= opt.overrideLimit) {
      out.push({
        kind: "many_overrides",
        subject: supervisorId,
        detail: `${count} overrides`,
      });
    }
  }

  return out;
}
