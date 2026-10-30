import { haversineM } from "./geofence.ts";

export type Coverage = { state_name: string; total: number; with_coordinates: number; verified: number; geofence_ready: number; pending: number; geocoded_unverified: number; low_confidence: number; failed: number; conflicting: number; needs_manual: number };
export type Check = { id: string; agentId: string; puId: string; outcome: string; trigger: string; at: Date; lat: number | null; lon: number | null; puLat: number | null; puLon: number | null };
export type Risk = { kind: "implausible_travel" | "identical_coordinates" | "many_overrides"; subject: string; detail: string };

export function totals(rows: Coverage[]) {
  const t = rows.reduce((a, r) => { for (const k of Object.keys(r) as (keyof Coverage)[]) if (k !== "state_name") (a as any)[k] = ((a as any)[k] ?? 0) + Number(r[k]); return a; }, {} as Record<string, number>);
  const pct = (n: number) => (t.total ? (n / t.total) * 100 : 0);
  return {
  ...t,
  pctCoordinates: pct(t.with_coordinates ?? 0),
  pctVerified: pct(t.verified ?? 0),
  pctReady: pct(t.geofence_ready ?? 0),
} as Record<string, number>;
export const countByOutcome = (cs: Check[]) => cs.reduce<Record<string, number>>((a, c) => ((a[c.outcome] = (a[c.outcome] ?? 0) + 1), a), {});

/** Agents with a location check in the last 20 minutes (15 min cadence + 5 min grace). An estimate of who is on duty, not proof. */
export const onDuty = (cs: Check[], now = new Date()) => new Set(cs.filter((c) => now.getTime() - c.at.getTime() <= 20 * 60_000).map((c) => c.agentId)).size;

/** Review prompts only. GPS cannot prove or rule out spoofing, and none of these is evidence of misconduct. */
export function riskFlags(cs: Check[], overrides: { supervisorId: string }[] = [], opt = { maxKmh: 150, sameSpotKm: 5, overrideLimit: 3 }): Risk[] {
  const out: Risk[] = [], withGps = cs.filter((c) => c.lat != null && c.lon != null);
  const byAgent = new Map<string, Check[]>(); for (const c of withGps) (byAgent.get(c.agentId) ?? byAgent.set(c.agentId, []).get(c.agentId)!).push(c);
  for (const [agent, list] of byAgent) {
    list.sort((a, b) => a.at.getTime() - b.at.getTime());
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1]!, b = list[i]!, h = (b.at.getTime() - a.at.getTime()) / 3.6e6;
      if (h <= 0) continue; const kmh = haversineM(a.lat!, a.lon!, b.lat!, b.lon!) / 1000 / h;
      if (kmh > opt.maxKmh) out.push({ kind: "implausible_travel", subject: agent, detail: `${Math.round(kmh)} km/h between two readings` });
    }
    const spots = new Map<string, Check[]>(); for (const c of list) { const k = `${c.lat!.toFixed(5)},${c.lon!.toFixed(5)}`; (spots.get(k) ?? spots.set(k, []).get(k)!).push(c); }
    for (const group of spots.values()) {
      const units = new Map(group.filter((g) => g.puLat != null).map((g) => [g.puId, g]));
      const arr = [...units.values()]; let far = false;
      for (let i = 0; i < arr.length && !far; i++) for (let j = i + 1; j < arr.length; j++) if (haversineM(arr[i]!.puLat!, arr[i]!.puLon!, arr[j]!.puLat!, arr[j]!.puLon!) / 1000 > opt.sameSpotKm) { far = true; break; }
      if (far) out.push({ kind: "identical_coordinates", subject: agent, detail: "Same exact reading used at polling units more than 5 km apart" });
    }
  }
  const per = overrides.reduce<Record<string, number>>((a, o) => ((a[o.supervisorId] = (a[o.supervisorId] ?? 0) + 1), a), {});
  for (const [s, n] of Object.entries(per)) if (n >= opt.overrideLimit) out.push({ kind: "many_overrides", subject: s, detail: `${n} overrides` });
  return out;
}
