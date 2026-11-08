"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { dashboardApi } from "@/api/dashboard.api";
import { branchApi } from "@/api/branch.api";
import { pharmacyApi } from "@/api/pharmacy.api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/store/auth.store";
import { ymd } from "@/lib/periods";
import { DashboardHeader } from "./dashboard-header";
import { TodayCards } from "./today-cards";
import { HourlyChart } from "./hourly-chart";
import { AttentionList } from "./attention-list";
import { PeriodCompare } from "./period-compare";
import { DailyChart } from "./daily-chart";
import { BestSellers } from "./best-sellers";
import { BranchesToday, SellersToday } from "./leaderboards";
import { StockCard } from "./stock-card";
import { SetupChecklist } from "./setup-checklist";
import { LatestSales } from "./latest-sales";
import { BlockSkeleton, StatCardSkeleton } from "./stat-card";
import { clock, hourIn } from "./format";
import { useDashboardBranch } from "./use-dashboard-branch";

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <BlockSkeleton className="h-[300px] lg:col-span-3" />
        <BlockSkeleton className="h-[300px] lg:col-span-2" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <BlockSkeleton className="h-[120px]" />
        <BlockSkeleton className="h-[120px]" />
      </div>
    </div>
  );
}

/**
 * The Owner/Manager home screen. Everything at the top comes from one cached request polled every
 * minute (paused while the tab is hidden); the latest receipts are the only other request.
 */
export function OwnerDashboard({ pharmacyId }: { pharmacyId: string }) {
  const user = useAuthStore((s) => s.user);
  // A Manager assigned to a branch always sees that branch; the server enforces this too.
  const heldBranchId = user?.role === "Manager" ? user.branchId : null;

  // Usually already in the cache: the layout loads the pharmacy and shares it under this key.
  const { data: pharmacy } = useQuery({
    queryKey: ["pharmacy", pharmacyId],
    queryFn: () => pharmacyApi.getById(pharmacyId),
    staleTime: Infinity,
  });
  const { data: branches } = useQuery({
    queryKey: ["branches", pharmacyId],
    queryFn: () => branchApi.list(pharmacyId),
    enabled: !heldBranchId,
    staleTime: 5 * 60_000,
  });
  const { branchId: pickedBranchId, setBranchId } = useDashboardBranch(pharmacyId, user?.id, branches);
  const branchId = heldBranchId ?? pickedBranchId;

  const { data, isLoading, isError, isFetching, refetch, isRefetchError } = useQuery({
    queryKey: ["dashboard", "owner", pharmacyId, branchId || "all"],
    queryFn: () => dashboardApi.owner(pharmacyId, { branchId: branchId || undefined }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const deviceNow = new Date();
  const todayKey = data?.today.date ?? ymd(deviceNow);
  const hour = data ? hourIn(data.generatedAt, data.timezone) : deviceNow.getHours();

  return (
    <div className="space-y-6">
      <DashboardHeader
        firstName={user?.firstName}
        pharmacyName={pharmacy?.name}
        todayKey={todayKey}
        hour={hour}
        branches={heldBranchId ? undefined : branches}
        branchId={branchId}
        onBranchChange={heldBranchId ? undefined : setBranchId}
        updatedAt={data ? clock(data.generatedAt, data.timezone) : null}
        refreshing={isFetching}
        refreshFailed={isRefetchError}
        onRefresh={() => void refetch()}
      />

      {isLoading ? (
        <DashboardSkeleton />
      ) : isError && !data ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">We couldn&apos;t load your dashboard. Check your connection and try again.</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>Retry</Button>
          </CardContent>
        </Card>
      ) : data ? (
        <>
          <SetupChecklist setup={data.setup} pharmacyId={pharmacyId} />
          <TodayCards data={data} hour={hour} />

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <AttentionList data={data} pharmacyId={pharmacyId} />
            </div>
            <div className="lg:col-span-2">
              <HourlyChart hourly={data.hourly} currentHour={hour} />
            </div>
          </div>

          <PeriodCompare week={data.week} month={data.month} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <DailyChart daily={data.daily} />
            </div>
            <StockCard stock={data.stock} pharmacyId={pharmacyId} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BestSellers today={data.topProducts.today} last7Days={data.topProducts.last7Days} />
            <SellersToday sellers={data.sellers} showBranch={!data.branchId} />
          </div>

          <div className={data.branches.length > 0 ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : undefined}>
            {data.branches.length > 0 && <BranchesToday branches={data.branches} />}
            <LatestSales pharmacyId={pharmacyId} todayKey={todayKey} branchId={branchId || undefined} />
          </div>
        </>
      ) : null}
    </div>
  );
}
