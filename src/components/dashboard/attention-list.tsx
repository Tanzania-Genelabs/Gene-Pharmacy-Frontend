import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BadgePercent, CalendarClock, CalendarX, CheckCircle2, ChevronRight, Clock, PackageX, Tag, TrendingDown, Undo2, Hourglass,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/components/expenses/format";
import { cn } from "@/lib/utils";
import type { OwnerDashboardResponse } from "@/types";
import { clock, plural } from "./format";

type Tone = "red" | "amber" | "slate";

interface Row {
  key: string;
  icon: LucideIcon;
  tone: Tone;
  count: number;
  text: string;
  detail?: string;
  href: string;
  action: string;
}

const TONES: Record<Tone, string> = {
  red: "bg-red-500/10 text-red-600 dark:text-red-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  slate: "bg-muted text-muted-foreground",
};

function buildRows(a: OwnerDashboardResponse["attention"], base: string, timeZone: string): Row[] {
  const rows: Row[] = [
    {
      key: "oos",
      icon: PackageX,
      tone: "red",
      count: a.outOfStockSelling.count,
      text: `${plural(a.outOfStockSelling.count, "medicine")} out of stock but still selling`,
      detail: a.outOfStockSelling.top.map((d) => d.drugName).join(", "),
      href: `${base}/inventory?status=out`,
      action: "Restock",
    },
    {
      key: "running",
      icon: Hourglass,
      tone: "amber",
      count: a.runningOut.length,
      text: `${plural(a.runningOut.length, "medicine")} will run out within 2 weeks`,
      detail: a.runningOut.map((d) => `${d.drugName} (~${plural(d.daysLeft, "day")} left)`).join(", "),
      href: `${base}/purchase-orders`,
      action: "Order",
    },
    {
      key: "expired",
      icon: CalendarX,
      tone: "red",
      count: a.expired.batches,
      text: `${plural(a.expired.batches, "batch", "batches")} already expired on the shelf`,
      detail: `${money(a.expired.costValue)} at cost — remove them from sale`,
      href: `${base}/expiry`,
      action: "Review",
    },
    {
      key: "expiring",
      icon: CalendarClock,
      tone: "amber",
      count: a.expiringSoon.batches,
      text: `${plural(a.expiringSoon.batches, "batch", "batches")} expire in the next ${a.expiringSoon.days} days`,
      detail: `${money(a.expiringSoon.costValue)} at cost — sell these first`,
      href: `${base}/expiry`,
      action: "Review",
    },
    {
      key: "belowCost",
      icon: TrendingDown,
      tone: "red",
      count: a.belowCostSales,
      text: `${plural(a.belowCostSales, "sale")} today sold at or below cost`,
      href: `${base}/sales`,
      action: "Check",
    },
    {
      key: "noBuying",
      icon: Tag,
      tone: "amber",
      count: a.missingBuyingPrice,
      text: `${plural(a.missingBuyingPrice, "medicine")} without a buying price`,
      detail: "Profit looks higher than it really is until these are filled in",
      href: `${base}/drugs?quick=noBuying`,
      action: "Add prices",
    },
    {
      key: "voided",
      icon: Undo2,
      tone: "slate",
      count: a.voidedToday,
      text: `${plural(a.voidedToday, "sale")} voided today`,
      href: `${base}/sales`,
      action: "See",
    },
    {
      key: "discount",
      icon: BadgePercent,
      tone: "amber",
      count: a.unusualDiscountCount,
      text: `${plural(a.unusualDiscountCount, "sale")} today with a discount over 20%`,
      href: `${base}/sales`,
      action: "Check",
    },
    {
      key: "shifts",
      icon: Clock,
      tone: "slate",
      count: a.openShifts.length,
      text: `${plural(a.openShifts.length, "shift")} still open`,
      detail: a.openShifts
        .slice(0, 3)
        .map((s) => `${s.userName ?? "Someone"}${s.branchName ? ` · ${s.branchName}` : ""} since ${clock(s.openedAt, timeZone)}`)
        .join(", "),
      href: `${base}/shifts`,
      action: "See",
    },
  ];
  return rows.filter((r) => r.count > 0);
}

/** What the owner should look at today, each with a link to the screen that fixes it. */
export function AttentionList({ data, pharmacyId }: { data: OwnerDashboardResponse; pharmacyId: string }) {
  const base = `/${pharmacyId}`;
  const a = data.attention;
  const rows = buildRows(a, base, data.timezone);

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-base">Needs your attention</CardTitle>
        <p className="text-xs text-muted-foreground">Things worth a look today. Tap a row to deal with it.</p>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {rows.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 px-4 py-4 text-sm font-medium text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            All good — nothing needs your attention 👍
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.key}>
                <Link href={r.href} className="group flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-accent/60 transition-colors">
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", TONES[r.tone])}>
                    <r.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{r.text}</span>
                    {r.detail && <span className="block truncate text-xs text-muted-foreground">{r.detail}</span>}
                  </span>
                  <span className="hidden sm:inline text-xs font-medium text-primary group-hover:underline">{r.action}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {(a.lowStockCount > 0 || a.outOfStockCount > 0) && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-2 text-xs">
            {a.lowStockCount > 0 && (
              <Link href={`${base}/inventory?status=low`} className="text-muted-foreground hover:text-foreground hover:underline">
                {plural(a.lowStockCount, "medicine")} below reorder level →
              </Link>
            )}
            {a.outOfStockCount > 0 && (
              <Link href={`${base}/inventory?status=out`} className="text-muted-foreground hover:text-foreground hover:underline">
                {a.outOfStockCount.toLocaleString()} out of stock →
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
