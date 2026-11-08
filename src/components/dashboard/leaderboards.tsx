import { Building2, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/components/expenses/format";
import type { OwnerDashboardResponse } from "@/types";
import { plural } from "./format";

/** Today's sales per branch, best first, with a bar showing each branch's share. */
export function BranchesToday({ branches }: { branches: OwnerDashboardResponse["branches"] }) {
  const top = Math.max(1, ...branches.map((b) => Number(b.revenue)));
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" /> Branches today
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {branches.map((b) => (
          <div key={b.branchId} className="text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium text-foreground">{b.branchName}</span>
              <span className="whitespace-nowrap font-semibold tabular-nums">{money(b.revenue)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-muted">
              <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${(Number(b.revenue) / top) * 100}%` }} />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {plural(b.salesCount, "sale")} · {money(b.profit)} profit
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** The five people who sold the most today. */
export function SellersToday({ sellers, showBranch }: { sellers: OwnerDashboardResponse["sellers"]; showBranch: boolean }) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" /> Sellers today
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {sellers.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nobody has sold anything yet today.</p>
        ) : (
          <ol className="divide-y divide-border">
            {sellers.map((s, i) => (
              <li key={`${s.userId ?? "none"}-${s.branchId ?? ""}`} className="flex items-center gap-3 px-2 py-2 text-sm">
                <span className="w-5 shrink-0 text-center">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="font-semibold text-muted-foreground">{i + 1}</span>}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{s.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {showBranch && s.branchName ? `${s.branchName} · ` : ""}
                    {plural(s.salesCount, "sale")}
                    {s.voidedCount > 0 ? ` · ${s.voidedCount} voided` : ""}
                  </span>
                </span>
                <span className="whitespace-nowrap font-semibold tabular-nums">{money(s.revenue)}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
