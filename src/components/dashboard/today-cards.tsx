import { DollarSign, Receipt, ShoppingCart, TrendingUp } from "lucide-react";
import { money } from "@/components/expenses/format";
import type { OwnerDashboardResponse } from "@/types";
import { change, plural, weekdayName } from "./format";
import { ChangeLine, StatCard } from "./stat-card";

/** The four big numbers for today, with a cheerful banner on a record day and a calm note on a quiet morning. */
export function TodayCards({ data, hour }: { data: OwnerDashboardResponse; hour: number }) {
  const { today, yesterday, sameDayLastWeek, records, streak } = data;
  const revenue = Number(today.revenue);
  const profit = Number(today.profit);
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : null;
  const lastWeekDay = weekdayName(sameDayLastWeek.date);

  const banner = revenue > 0 && records.isBestDayLast90
    ? "🎉 Best day of the last 90 days! Keep it going."
    : revenue > 0 && records.isBestDayThisMonth
      ? "🎉 Best day this month so far!"
      : null;

  return (
    <section className="space-y-3">
      {banner && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-800 dark:text-emerald-300">
          {banner}
          {streak.daysWithSales > 2 && <span className="font-normal"> · {streak.daysWithSales} days in a row with sales</span>}
        </div>
      )}
      {today.salesCount === 0 && hour >= 10 && (
        <div className="rounded-xl border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
          No sales recorded yet today. They will show up here as soon as the first one is made.
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Sold today" value={money(revenue)} icon={DollarSign} iconClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <ChangeLine c={change(revenue, Number(yesterday.revenue))} label={`yesterday (${money(yesterday.revenue)})`} none="Nothing sold yesterday" />
          <ChangeLine c={change(revenue, Number(sameDayLastWeek.revenue))} label={`last ${lastWeekDay}`} none={`Nothing sold last ${lastWeekDay}`} />
        </StatCard>
        <StatCard title="Sales" value={today.salesCount.toLocaleString()} icon={ShoppingCart} iconClass="bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <p>{today.voidedCount > 0 ? `${plural(today.voidedCount, "sale")} voided` : "Completed sales, none voided"}</p>
          <p>Yesterday: {yesterday.salesCount.toLocaleString()}</p>
        </StatCard>
        <StatCard
          title="Profit today"
          value={money(profit)}
          icon={TrendingUp}
          iconClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
          valueClass={profit < 0 ? "text-red-600 dark:text-red-400" : undefined}
        >
          <p>{margin !== null ? `${margin}% margin` : "Sales minus what the medicines cost you"}</p>
          <ChangeLine c={change(profit, Number(yesterday.profit))} label="yesterday" none="Before expenses" />
        </StatCard>
        <StatCard title="Average sale" value={money(Math.round(Number(today.avgSale)))} icon={Receipt} iconClass="bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <ChangeLine c={change(Number(today.avgSale), Number(yesterday.avgSale))} label="yesterday" none="Per completed sale" />
        </StatCard>
      </div>
    </section>
  );
}
