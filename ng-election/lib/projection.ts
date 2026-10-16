export const METHOD = "proportional_scale", VERSION = "v1";
export const MIN_UNIT_SHARE = 0.10, MIN_UNITS = 30;
export type StateInput = { stateId: string; name: string; expected: number; reporting: number; votes: Record<string, number> };
export type Projection =
  | { status: "insufficient_data"; reason: string; included: []; excluded: { name: string; reason: string }[] }
  | { status: "ok"; included: string[]; excluded: { name: string; reason: string }[]; projectedVotes: Record<string, number>; projectedShares: Record<string, number>;
      coverage: { statesIncluded: number; statesTotal: number; unitsReporting: number; unitsExpected: number } };

export const ASSUMPTIONS = [
  "Each state's verified votes are scaled up by (expected polling units / reporting polling units).",
  "This assumes the units that have reported are representative of the units still to report. That is often NOT true: early units can be mostly urban or from one party's strongholds.",
  "A state is included only once at least 10% of its polling units, and at least 30 units, have verified results. Other states are left out, not guessed.",
  "No margin of error is calculated. Treat the figures as a rough indication, not a forecast of the final result.",
];

/** Conservative projection. Returns NO numbers unless at least one state meets the thresholds. Pure; inputs are not mutated. */
export function project(states: StateInput[], opt = { minShare: MIN_UNIT_SHARE, minUnits: MIN_UNITS }): Projection {
  const included: StateInput[] = [], excluded: { name: string; reason: string }[] = [];
  for (const s of states) {
    if (!(s.expected > 0) || !(s.reporting > 0)) excluded.push({ name: s.name, reason: "no verified results yet" });
    else if (s.reporting < opt.minUnits) excluded.push({ name: s.name, reason: `fewer than ${opt.minUnits} units reporting` });
    else if (s.reporting / s.expected < opt.minShare) excluded.push({ name: s.name, reason: `under ${Math.round(opt.minShare * 100)}% of units reporting` });
    else included.push(s);
  }
  if (!included.length) return { status: "insufficient_data", reason: "No state has enough verified results to project from.", included: [], excluded };
  const totals: Record<string, number> = {};
  for (const s of included) { const f = s.expected / s.reporting; for (const [c, v] of Object.entries(s.votes)) totals[c] = (totals[c] ?? 0) + v * f; }
  const projectedVotes = Object.fromEntries(Object.entries(totals).map(([c, v]) => [c, Math.round(v)]));
  const sum = Object.values(totals).reduce((a, b) => a + b, 0);
  const projectedShares = Object.fromEntries(Object.entries(totals).map(([c, v]) => [c, sum > 0 ? Math.round((v / sum) * 1000) / 10 : 0]));
  return { status: "ok", included: included.map((s) => s.name), excluded, projectedVotes, projectedShares,
    coverage: { statesIncluded: included.length, statesTotal: states.length, unitsReporting: included.reduce((a, s) => a + s.reporting, 0), unitsExpected: included.reduce((a, s) => a + s.expected, 0) } };
}
