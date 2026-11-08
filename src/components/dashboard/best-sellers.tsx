"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/components/expenses/format";
import { cn } from "@/lib/utils";
import type { DashboardTopProduct } from "@/types";

function fmtUnits(n: number) {
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1);
}

/** The five products that made the most profit, today or over the last 7 days. */
export function BestSellers({ today, last7Days }: { today: DashboardTopProduct[]; last7Days: DashboardTopProduct[] }) {
  const [range, setRange] = useState<"today" | "7d">("today");
  const rows = range === "today" ? today : last7Days;

  return (
    <Card className="gap-3">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" /> Best sellers
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1.5">Ranked by profit</p>
        </div>
        <div className="flex rounded-md border p-0.5 text-xs" role="group" aria-label="Period">
          {(["today", "7d"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className={cn("rounded px-2.5 py-1 font-medium", range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {r === "today" ? "Today" : "Last 7 days"}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {range === "today" ? "No sales yet today." : "No sales in the last 7 days."}
          </p>
        ) : (
          <ol className="divide-y divide-border">
            {rows.map((p, i) => (
              <li key={p.drugId} className="flex items-center gap-3 px-2 py-2 text-sm">
                <span className="w-5 shrink-0 text-center font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{p.drugName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {fmtUnits(p.unitsSold)} {p.unit ?? "units"} · {money(p.revenue)} sold
                  </span>
                </span>
                <span className="whitespace-nowrap font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">+{money(p.profit)}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
