"use client";

import { useQuery } from "@tanstack/react-query";
import { DollarSign, Package, Receipt, ShoppingCart } from "lucide-react";
import { insightsApi } from "@/api/insights.api";
import { inventoryApi } from "@/api/inventory.api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/components/expenses/format";
import { ymd } from "@/lib/periods";
import { useAuthStore } from "@/store/auth.store";
import { DashboardHeader } from "./dashboard-header";
import { LatestSales } from "./latest-sales";
import { StatCard, StatCardSkeleton } from "./stat-card";
import { plural } from "./format";

/** A Seller's home: their branch's sales today, the latest receipts and what is running low. No cost or profit. */
export function SellerDashboard({ pharmacyId }: { pharmacyId: string }) {
  const user = useAuthStore((s) => s.user);
  const branchId = user?.branchId ?? undefined;
  const now = new Date();
  const todayKey = ymd(now);

  const { data: day, isLoading } = useQuery({
    queryKey: ["sales", "days", pharmacyId, todayKey, todayKey, branchId ?? "all"],
    queryFn: () => insightsApi.salesDays(pharmacyId, { from: todayKey, to: todayKey, branchId }),
    refetchInterval: 60_000,
  });
  const { data: lowStock } = useQuery({
    queryKey: ["inventory", "low-stock", pharmacyId, branchId ?? "all"],
    queryFn: () => inventoryApi.lowStock(pharmacyId, { branchId }),
    staleTime: 5 * 60_000,
  });

  const row = day?.days.find((d) => d.date === todayKey);
  const revenue = Number(row?.revenue ?? 0);
  const count = row?.salesCount ?? 0;

  return (
    <div className="space-y-6">
      <DashboardHeader firstName={user?.firstName} todayKey={todayKey} hour={now.getHours()} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }, (_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard title="Sold today" value={money(revenue)} icon={DollarSign} iconClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <p>Your branch, completed sales</p>
            </StatCard>
            <StatCard title="Sales" value={count.toLocaleString()} icon={ShoppingCart} iconClass="bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <p>{row?.voidedCount ? `${plural(row.voidedCount, "sale")} voided` : "None voided"}</p>
            </StatCard>
            <StatCard title="Average sale" value={money(count > 0 ? Math.round(revenue / count) : 0)} icon={Receipt} iconClass="bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <p>Per completed sale</p>
            </StatCard>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LatestSales pharmacyId={pharmacyId} todayKey={todayKey} branchId={branchId} />
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-amber-500" /> Running low
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {lowStock && lowStock.totalElements > 0 ? `${plural(lowStock.totalElements, "medicine")} at or below the reorder level. Tell your manager.` : "Medicines at or below the reorder level."}
            </p>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {!lowStock ? (
              <div className="h-24 animate-pulse rounded bg-muted" />
            ) : lowStock.totalElements === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">All stock levels look healthy 👍</p>
            ) : (
              <ul className="divide-y divide-border">
                {lowStock.content.slice(0, 6).map((item) => (
                  <li key={`${item.drugId}-${item.branchId}`} className="flex items-center justify-between gap-3 px-2 py-2 text-sm">
                    <span className="truncate font-medium text-foreground">{item.drugName}</span>
                    <span className="whitespace-nowrap font-semibold tabular-nums text-amber-700 dark:text-amber-400">{item.currentStock} left</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
