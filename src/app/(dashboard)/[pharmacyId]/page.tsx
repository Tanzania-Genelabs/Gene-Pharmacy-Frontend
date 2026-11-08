"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportApi } from "@/api/report.api";
import { inventoryApi } from "@/api/inventory.api";
import { notificationApi } from "@/api/notification.api";
import { salesApi } from "@/api/sales.api";
import { insightsApi } from "@/api/insights.api";
import { money } from "@/components/expenses/format";
import { dayHeading, rangeInstants, ymd } from "@/lib/periods";
import { useAuthStore } from "@/store/auth.store";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import {
  TrendingUp,
  ShoppingCart,
  Package,
  AlertTriangle,
  Bell,
  DollarSign,
} from "lucide-react";

function toDateParam(date: Date): string {
  return date.toISOString().split("T")[0];
}

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

export default function DashboardPage({ params }: PageProps) {
  const { pharmacyId } = use(params);

  const role = useAuthStore((s) => s.user?.role);
  const canSeeProfit = role !== "Seller";
  const today = new Date();
  const todayKey = ymd(today);
  const yesterdayKey = ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1));
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const dateParams = {
    from: toDateParam(thirtyDaysAgo),
    to: toDateParam(today),
  };

  const { data: salesSummary } = useQuery({
    queryKey: ["reports", "sales-summary", pharmacyId, dateParams],
    queryFn: () => reportApi.salesSummary(pharmacyId, dateParams),
  });

  const { data: dailySales } = useQuery({
    queryKey: ["reports", "daily-sales", pharmacyId, dateParams],
    queryFn: () => reportApi.salesDaily(pharmacyId, dateParams),
  });

  const { data: lowStock } = useQuery({
    queryKey: ["inventory", "low-stock", pharmacyId],
    queryFn: () => inventoryApi.lowStock(pharmacyId),
  });

  const { data: notifSummary } = useQuery({
    queryKey: ["notifications", "summary", pharmacyId],
    queryFn: () => notificationApi.pendingCount(pharmacyId),
  });

  // Today against yesterday, from the same per-day figures the sales history uses; refreshed while the page is open.
  const { data: twoDays } = useQuery({
    queryKey: ["sales", "days", pharmacyId, yesterdayKey, todayKey],
    queryFn: () => insightsApi.salesDays(pharmacyId, { from: yesterdayKey, to: todayKey }),
    refetchInterval: 30_000,
  });
  const todayRow = twoDays?.days.find((d) => d.date === todayKey);
  const yesterdayRow = twoDays?.days.find((d) => d.date === yesterdayKey);
  const soldToday = Number(todayRow?.revenue ?? 0);
  const soldYesterday = Number(yesterdayRow?.revenue ?? 0);
  const profitToday = todayRow?.profit != null ? Number(todayRow.profit) : twoDays && canSeeProfit ? 0 : null;
  const versus =
    soldYesterday > 0
      ? `${soldToday >= soldYesterday ? "+" : "−"}${Math.abs(Math.round(((soldToday - soldYesterday) / soldYesterday) * 100))}% vs yesterday (${money(soldYesterday)})`
      : "Nothing sold yesterday";

  const { data: todaySales } = useQuery({
    queryKey: ["sales", "today-latest", pharmacyId, todayKey],
    queryFn: () => salesApi.list(pharmacyId, { page: 0, size: 8, ...rangeInstants({ from: todayKey, to: todayKey }) }),
    refetchInterval: 30_000,
  });

  const todayStats = [
    { title: "Sold today", value: twoDays ? money(soldToday) : "—", description: versus, icon: DollarSign, color: "text-green-600 dark:text-green-400" },
    {
      title: "Sales today",
      value: twoDays ? String(todayRow?.salesCount ?? 0) : "—",
      description: todayRow?.voidedCount ? `${todayRow.voidedCount} voided` : "Completed sales",
      icon: ShoppingCart,
      color: "text-blue-600 dark:text-blue-400",
    },
    ...(canSeeProfit
      ? [{ title: "Profit today", value: profitToday != null ? money(profitToday) : "—", description: "Sales − what the drugs cost you", icon: TrendingUp, color: profitToday != null && profitToday < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400" }]
      : []),
    { title: "Low stock", value: lowStock?.totalElements?.toLocaleString() ?? "—", description: "Below reorder level", icon: AlertTriangle, color: "text-orange-600 dark:text-orange-400" },
  ];

  const stats = [
    {
      title: "Total Revenue (30d)",
      value: salesSummary?.totalRevenue != null ? money(salesSummary.totalRevenue) : "—",
      icon: DollarSign,
      description: "Last 30 days",
      color: "text-green-600 dark:text-green-400",
    },
    {
      title: "Total Sales",
      value: salesSummary?.totalSales?.toLocaleString() ?? "—",
      icon: ShoppingCart,
      description: "Completed transactions",
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Low Stock Items",
      value: lowStock?.totalElements?.toLocaleString() ?? "—",
      icon: AlertTriangle,
      description: "Below reorder level",
      color: "text-orange-600 dark:text-orange-400",
    },
    {
      title: "Unread Notifications",
      value: (notifSummary?.pendingCount ?? notifSummary?.unreadCount)?.toLocaleString() ?? "—",
      icon: Bell,
      description: "Require attention",
      color: "text-purple-600 dark:text-purple-400",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h2>
        <p className="text-muted-foreground text-sm mt-1">{dayHeading(todayKey)}</p>
      </div>

      {/* Today */}
      <section className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {todayStats.map((stat) => (
            <Card key={stat.title} className="border-primary/30 hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Today&apos;s latest sales</CardTitle>
            <Link href={`/${pharmacyId}/sales`} className="text-sm text-primary hover:underline">See all</Link>
          </CardHeader>
          <CardContent>
            {todaySales && todaySales.content.length > 0 ? (
              <div className="divide-y divide-border">
                {todaySales.content.map((sale) => (
                  <div key={sale.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className={`truncate ${sale.status === "Voided" ? "line-through text-muted-foreground" : "font-medium text-foreground"}`}>
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
              <p className="text-sm text-muted-foreground py-6 text-center">{todaySales ? "No sales yet today" : "Loading…"}</p>
            )}
          </CardContent>
        </Card>
      </section>

      <p className="text-sm font-medium text-muted-foreground pt-2">Last 30 days</p>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily sales chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Daily Sales (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailySales && dailySales.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={dailySales}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => v.slice(5)}
                    className="text-muted-foreground"
                  />
                  <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">
                No sales data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low stock items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-orange-500" />
              Low Stock Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock && lowStock.totalElements > 0 ? (
              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                {lowStock.content.slice(0, 8).map((item) => (
                  <div
                    key={`${item.drugId}-${item.branchId}`}
                    className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0"
                  >
                    <span className="font-medium text-foreground truncate max-w-[60%]">{item.drugName}</span>
                    <span className="text-destructive font-semibold tabular-nums">
                      {item.currentStock} left
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">
                All stock levels are healthy ✓
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
