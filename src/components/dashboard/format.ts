import { parseYmd } from "@/lib/periods";

/** Chart colours that read on both the light and the dark card. Text never uses them. */
export const CHART = {
  revenue: "#3b82f6",
  revenueSoft: "color-mix(in oklab, #3b82f6 35%, transparent)",
  profit: "#10b981",
  grid: "var(--border)",
  axis: "var(--muted-foreground)",
};

export const tooltipStyle = {
  backgroundColor: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

/** "TZS 12.5k" style for chart axes. */
export function compactMoney(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
  return String(value);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

export interface Change {
  /** Rounded percent, positive or negative; null when there is nothing to compare with. */
  pct: number | null;
  up: boolean;
}

export function change(current: number, previous: number): Change {
  if (previous <= 0) return { pct: null, up: current > 0 };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { pct, up: pct >= 0 };
}

/** "Mon 3" */
export function shortDay(date: string): string {
  return parseYmd(date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
}

/** "Saturday" */
export function weekdayName(date: string): string {
  return parseYmd(date).toLocaleDateString("en-GB", { weekday: "long" });
}

/** "09:00" */
export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/** "14:05" for an ISO instant, in the given zone. */
export function clock(iso: string, timeZone?: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
  } catch {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
}

/** The hour (0-23) of an ISO instant in the shop's timezone. */
export function hourIn(iso: string, timeZone: string): number {
  try {
    const h = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone }).format(new Date(iso));
    return Number(h) % 24;
  } catch {
    return new Date(iso).getHours();
  }
}

export function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
