export type Leader = { party: string; colour: string | null; margin: number };
/** Seats LED by party. A tie (margin 0) counts for nobody and is reported separately. Not a count of declared winners. */
export function seatsLed(rows: Leader[]) {
  const by = new Map<string, { party: string; colour: string | null; seats: number }>(); let tied = 0;
  for (const r of rows) {
    if (r.margin <= 0) { tied++; continue; }
    const e = by.get(r.party) ?? { party: r.party, colour: r.colour, seats: 0 }; e.seats++; by.set(r.party, e);
  }
  return { parties: [...by.values()].sort((a, b) => b.seats - a.seats || a.party.localeCompare(b.party)), tied };
}
export const CONTEST_TYPES = ["presidential", "governorship", "senatorial", "house_of_reps", "state_assembly"] as const;
export type ContestType = (typeof CONTEST_TYPES)[number];
export const TYPE_LABEL: Record<ContestType, string> = { presidential: "Presidential", governorship: "Governorship", senatorial: "Senate", house_of_reps: "House of Representatives", state_assembly: "State House of Assembly" };
