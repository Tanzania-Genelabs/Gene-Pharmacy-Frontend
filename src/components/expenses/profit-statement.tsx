"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProfitReport } from "@/types";
import { money } from "./format";

const pct = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}% of sales` : null);

function Line({ sign, label, value, hint, strong, tone }: { sign?: "−" | "="; label: string; value: string; hint?: string | null; strong?: boolean; tone?: "danger" | "success" }) {
  const colour = tone === "danger" ? "text-destructive" : tone === "success" ? "text-green-600 dark:text-green-400" : "";
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? "py-2 border-t" : ""}`}>
      <div>
        <span className={strong ? "font-semibold" : "text-muted-foreground"}>
          {sign && <span className="inline-block w-5">{sign}</span>}
          {label}
        </span>
        {hint && <div className="text-xs text-muted-foreground pl-5">{hint}</div>}
      </div>
      <span className={`tabular-nums ${strong ? "text-xl font-bold" : ""} ${colour}`}>{value}</span>
    </div>
  );
}

/**
 * Sales, minus the cost of the drugs sold, equals profit BEFORE expenses; minus running expenses, equals profit AFTER
 * expenses. A plan without expense management shows a note instead of the last two lines.
 */
export function ProfitStatement({ report }: { report: ProfitReport | undefined }) {
  const revenue = Number(report?.revenue ?? 0);
  const gross = Number(report?.grossProfit ?? 0);
  const net = Number(report?.netProfit ?? 0);
  const hasExpenses = report?.expenses != null && report.netProfit != null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Profit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 max-w-xl">
        {!report ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <Line label="Sales" value={money(report.revenue)} />
            <Line sign="−" label="Cost of the drugs sold" value={money(report.costOfGoods)} />
            <Line sign="=" strong label="Profit before expenses" value={money(report.grossProfit)} tone={gross < 0 ? "danger" : "success"} hint={pct(gross, revenue)} />
            {hasExpenses ? (
              <>
                <Line sign="−" label="Expenses" value={money(report.expenses)} />
                <Line sign="=" strong label="Profit after expenses" value={money(report.netProfit)} tone={net < 0 ? "danger" : "success"} hint={pct(net, revenue)} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground pt-2">
                Expenses are not tracked on your plan, so profit after expenses is not shown. Upgrade to a plan with expense management to see it.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
