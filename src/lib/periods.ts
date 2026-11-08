/**
 * Calendar periods for the sales and money screens. Dates are local calendar days as "YYYY-MM-DD"
 * (toISOString would give the UTC day, which is wrong near midnight).
 */

export type PeriodPreset = "today" | "yesterday" | "7d" | "month" | "lastMonth" | "custom";

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  month: "This month",
  lastMonth: "Last month",
  custom: "Pick dates",
};

export function ymd(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

/** "2026-11-07" -> local midnight of that day. */
export function parseYmd(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function shift(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export interface DateRange {
  from: string;
  to: string;
}

export function presetRange(preset: PeriodPreset, custom: DateRange, now = new Date()): DateRange {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case "today":
      return { from: ymd(today), to: ymd(today) };
    case "yesterday":
      return { from: ymd(shift(today, -1)), to: ymd(shift(today, -1)) };
    case "7d":
      return { from: ymd(shift(today, -6)), to: ymd(today) };
    case "month":
      return { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to: ymd(today) };
    case "lastMonth":
      return {
        from: ymd(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        to: ymd(new Date(today.getFullYear(), today.getMonth(), 0)),
      };
    case "custom":
      return custom;
  }
}

/** The server accepts at most 366 days in one request. */
export const MAX_RANGE_DAYS = 366;

export function isValidRange(range: DateRange): boolean {
  if (!range.from || !range.to || range.from > range.to) return false;
  const days = Math.round((parseYmd(range.to).getTime() - parseYmd(range.from).getTime()) / 86_400_000) + 1;
  return days <= MAX_RANGE_DAYS;
}

/** The first and last instant of the range on this device's clock, as ISO strings for the API. */
export function rangeInstants(range: DateRange): { from: string; to: string } {
  const start = parseYmd(range.from);
  const end = parseYmd(range.to);
  return {
    from: start.toISOString(),
    to: new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999).toISOString(),
  };
}

/** "Today — Sat 7 Nov", "Yesterday — Fri 6 Nov", otherwise "Thu 5 Nov 2026". */
export function dayHeading(value: string, now = new Date()): string {
  const date = parseYmd(value);
  const short = date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  if (value === ymd(now)) return `Today — ${short}`;
  if (value === ymd(shift(now, -1))) return `Yesterday — ${short}`;
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/** "7 Nov 2026" or "1 Nov – 7 Nov 2026" for a range. */
export function rangeLabel(range: DateRange): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  const from = parseYmd(range.from).toLocaleDateString("en-GB", opts);
  if (range.from === range.to) return from;
  return `${from} – ${parseYmd(range.to).toLocaleDateString("en-GB", opts)}`;
}
