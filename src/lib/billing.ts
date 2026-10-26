import type { BillingPeriodUnit, BillingPlanOffer } from "@/types";

/** "1 week", "2 weeks", "1 month", "5 months". */
export function periodLabel(unit: BillingPeriodUnit, count: number): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/** What one week or one month of a plan costs, or null when it isn't sold that way. */
export function unitPrice(plan: Pick<BillingPlanOffer, "monthlyPrice" | "weeklyPrice"> | undefined, unit: BillingPeriodUnit): number | null {
  const price = unit === "week" ? plan?.weeklyPrice : plan?.monthlyPrice;

  return price === null || price === undefined || price === "" ? null : Number(price);
}

/**
 * How much cheaper one month is than four weeks of the same plan (0 if weekly is not dearer or not sold).
 * Shown to people paying weekly so they know about the monthly saving.
 */
export function monthlySaving(plan: Pick<BillingPlanOffer, "monthlyPrice" | "weeklyPrice"> | undefined): number {
  const weekly = unitPrice(plan, "week");
  const monthly = unitPrice(plan, "month");

  return weekly !== null && monthly !== null ? Math.max(0, weekly * 4 - monthly) : 0;
}

/**
 * Adds a billing period to a date the way the server does: weeks are 7 days; months follow the calendar
 * (31 Jan + 1 month is the end of February, not 3 March).
 */
export function addPeriod(from: Date, unit: BillingPeriodUnit, count: number): Date {
  if (unit === "week") {
    const result = new Date(from);
    result.setDate(result.getDate() + count * 7);
    return result;
  }

  const result = new Date(from.getFullYear(), from.getMonth() + count, 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(from.getDate(), lastDay));
  return result;
}
