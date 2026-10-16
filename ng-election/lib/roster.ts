export type Duty = "no_assignment" | "never_checked" | "on_duty" | "overdue";
export const OVERDUE_MIN = 20; // 15 min cadence + 5 min grace
/** A prompt for supervisors, not a verdict: a phone can be locked, offline or out of battery. */
export function dutyStatus(activeAssignments: number, lastCheckAt: string | null, now = new Date()): Duty {
  if (activeAssignments <= 0) return "no_assignment";
  if (!lastCheckAt) return "never_checked";
  return (now.getTime() - Date.parse(lastCheckAt)) / 60_000 > OVERDUE_MIN ? "overdue" : "on_duty";
}
export function agoLabel(iso: string | null, now = new Date()): string {
  if (!iso) return "Never";
  const m = Math.floor((now.getTime() - Date.parse(iso)) / 60_000);
  return m < 1 ? "Just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : `${Math.floor(m / 1440)} d ago`;
}
