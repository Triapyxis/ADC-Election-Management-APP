export type Area = { id: string; name: string; expected: number; reporting: number };
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "No polling units" instead of NaN%; never implies full reporting when expected is 0. */
export function progressLabel(reporting: number, expected: number): string {
  if (expected <= 0) return "No polling units";
  return `${reporting.toLocaleString("en-NG")} of ${expected.toLocaleString("en-NG")} reporting (${((reporting / expected) * 100).toFixed(1)}%)`;
}

