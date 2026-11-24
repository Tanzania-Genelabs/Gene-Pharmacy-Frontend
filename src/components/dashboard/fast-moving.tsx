"use client";

import { useState } from "react";
import { Flame } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/components/expenses/format";
import { cn } from "@/lib/utils";
import type { DashboardFastProduct } from "@/types";

type Range = "today" | "last7Days" | "last30Days";

const RANGES: { key: Range; label: string; empty: string }[] = [
  { key: "today", label: "Today", empty: "Nothing sold yet today." },
  { key: "last7Days", label: "7 days", empty: "Nothing sold in the last 7 days." },
  { key: "last30Days", label: "30 days", empty: "Nothing sold in the last 30 days." },
];

function fmtUnits(n: number) {
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1);
}

/**
 * The products that sell most often: ranked by the number of sales they were in, not by price, profit or one big
 * order's quantity (the "Best sellers" card is ranked by profit). Bars are against the top product, with what is
 * still on the shelf so a product that sells all the time and is about to run out stands out.
 */
export function FastMoving({ fast }: { fast: { today: DashboardFastProduct[]; last7Days: DashboardFastProduct[]; last30Days: DashboardFastProduct[] } }) {
  const [range, setRange] = useState<Range>("last7Days");
  const rows = fast[range];
  const max = Math.max(1, ...rows.map((r) => r.timesSold));

  return (
    <Card className="gap-3">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" /> Fast-moving products
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1.5">The products that sell most often: ranked by the number of sales they were in, whatever their price</p>
        </div>
        <div className="flex rounded-md border p-0.5 text-xs" role="group" aria-label="Period">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              aria-pressed={range === r.key}
              className={cn("rounded px-2.5 py-1 font-medium", range === r.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {r.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{RANGES.find((r) => r.key === range)?.empty}</p>
        ) : (
          <ol className="space-y-3">
            {rows.map((p, i) => (
              <li key={p.drugId} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className={cn("min-w-0 truncate", i === 0 ? "font-semibold text-foreground" : "text-foreground")}>
                    <span className="mr-2 tabular-nums text-muted-foreground">{i + 1}.</span>
                    {p.drugName}
                  </span>
                  <span className={cn("whitespace-nowrap tabular-nums", i === 0 ? "font-semibold" : "font-medium")}>
                    in {p.timesSold} sale{p.timesSold === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${p.drugName}: sold in ${p.timesSold} sales`}>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, (p.timesSold / max) * 100)}%` }} />
                </div>
                <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                  <span>In {p.sharePercent}% of sales · {fmtUnits(p.unitsSold)} {p.unit ?? "units"} · {money(p.revenue)}</span>
                  <span className={cn(p.stockLeft <= 0 && "font-medium text-destructive")}>
                    {p.stockLeft <= 0 ? "Out of stock" : `${fmtUnits(p.stockLeft)} left`}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
