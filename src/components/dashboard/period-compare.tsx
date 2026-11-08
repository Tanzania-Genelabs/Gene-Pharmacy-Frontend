import { Card, CardContent } from "@/components/ui/card";
import { money } from "@/components/expenses/format";
import type { DashboardSpan } from "@/types";
import { change } from "./format";
import { ChangeLine } from "./stat-card";

function Tile({ title, current, previous, previousLabel }: { title: string; current: DashboardSpan; previous: DashboardSpan; previousLabel: string }) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-5">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Sales</p>
            <p className="text-lg font-bold tabular-nums text-foreground truncate">{money(current.revenue)}</p>
            <div className="text-xs text-muted-foreground">
              <ChangeLine c={change(Number(current.revenue), Number(previous.revenue))} label={previousLabel} none={`Nothing ${previousLabel}`} />
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Profit</p>
            <p className="text-lg font-bold tabular-nums text-foreground truncate">{money(current.profit)}</p>
            <div className="text-xs text-muted-foreground">
              <ChangeLine c={change(Number(current.profit), Number(previous.profit))} label={previousLabel} none={`Nothing ${previousLabel}`} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** This week and this month against the same days of the previous week and month, so the comparison is fair. */
export function PeriodCompare({ week, month }: { week: { thisWeek: DashboardSpan; lastWeek: DashboardSpan }; month: { thisMonth: DashboardSpan; lastMonth: DashboardSpan } }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Tile title="This week so far" current={week.thisWeek} previous={week.lastWeek} previousLabel="last week" />
      <Tile title="This month so far" current={month.thisMonth} previous={month.lastMonth} previousLabel="last month" />
    </div>
  );
}
