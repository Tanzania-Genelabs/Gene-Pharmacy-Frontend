"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportApi } from "@/api/report.api";
import { inventoryApi } from "@/api/inventory.api";
import { notificationApi } from "@/api/notification.api";
import { salesApi } from "@/api/sales.api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
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

  const today = new Date();
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

  const { data: recentSales } = useQuery({
    queryKey: ["sales", "recent", pharmacyId],
    queryFn: () => salesApi.list(pharmacyId, { page: 0, size: 5 }),
  });

  const stats = [
    {
      title: "Total Revenue (30d)",
      value: salesSummary?.totalRevenue != null ? `TZS ${salesSummary.totalRevenue.toLocaleString()}` : "—",
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
      value: notifSummary?.unreadCount?.toLocaleString() ?? "—",
      icon: Bell,
      description: "Require attention",
      color: "text-purple-600 dark:text-purple-400",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h2>
        <p className="text-muted-foreground text-sm mt-1">Overview for the last 30 days</p>
      </div>

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
