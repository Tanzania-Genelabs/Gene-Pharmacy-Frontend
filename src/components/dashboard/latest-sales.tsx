"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { salesApi } from "@/api/sales.api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/components/expenses/format";
import { rangeInstants } from "@/lib/periods";

/** The six most recent receipts of today, refreshed once a minute while the tab is visible. */
export function LatestSales({ pharmacyId, todayKey, branchId }: { pharmacyId: string; todayKey: string; branchId?: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["sales", "today-latest", pharmacyId, todayKey, branchId ?? "all"],
    queryFn: () => salesApi.list(pharmacyId, { page: 0, size: 6, branchId: branchId || undefined, ...rangeInstants({ from: todayKey, to: todayKey }) }),
    refetchInterval: 60_000,
    staleTime: 55_000,
  });

  return (
    <Card className="gap-3">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Today&apos;s latest sales</CardTitle>
        <Link href={`/${pharmacyId}/sales`} className="text-sm text-primary hover:underline">See all</Link>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {isLoading ? (
          <div className="space-y-3 py-1 animate-pulse">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex justify-between gap-3">
                <div className="h-4 w-2/3 rounded bg-muted" />
                <div className="h-4 w-16 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : data && data.content.length > 0 ? (
          <div className="divide-y divide-border">
            {data.content.map((sale) => (
              <div key={sale.id} className="flex items-start justify-between gap-3 px-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className={sale.status === "Voided" ? "truncate line-through text-muted-foreground" : "truncate font-medium text-foreground"}>
                    {sale.items?.map((i) => `${i.drugName} ×${i.quantity}${i.isHalfDose ? " (½)" : ""}`).join(", ") || sale.receiptNumber}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(sale.saleDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    {sale.branchName ? ` · ${sale.branchName}` : ""}
                    {sale.status === "Voided" ? " · Voided" : ""}
                  </p>
                </div>
                <span className="font-semibold tabular-nums whitespace-nowrap">{money(sale.netAmount)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {isError ? "Couldn't load the latest sales." : "No sales yet today — the first one will appear here."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
