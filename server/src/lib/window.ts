export const SEARCH_MONTHS = [3, 12, 36] as const;

/* Preserve the day where possible, clamping month ends instead of overflowing. */
export function monthsBefore(to: Date, months: number): Date {
  const from = new Date(to);
  const day = from.getUTCDate();
  from.setUTCDate(1);
  from.setUTCMonth(from.getUTCMonth() - months);
  const last = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0)).getUTCDate();
  from.setUTCDate(Math.min(day, last));
  return from;
}
