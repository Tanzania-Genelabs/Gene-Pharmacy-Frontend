"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/api/analytics.api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  Package,
  Building2,
  BarChart3,
} from "lucide-react";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

function toDateParam(date: Date): string {
  return date.toISOString().split("T")[0];
}

export default function AnalyticsPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const [tab, setTab] = useState("overview");

  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const dateParams = { from: toDateParam(thirtyDaysAgo), to: toDateParam(today) };

  const { data: summary } = useQuery({
    queryKey: ["analytics", "daily-summary", pharmacyId],
    queryFn: () => analyticsApi.dailySummary(pharmacyId),
  });

  const { data: deadStock } = useQuery({
    queryKey: ["analytics", "dead-stock", pharmacyId],
    queryFn: () => analyticsApi.deadStock(pharmacyId, { days: 60 }),
    enabled: tab === "dead-stock",
  });

  const { data: marginLeaks } = useQuery({
    queryKey: ["analytics", "margin-leakage", pharmacyId, dateParams],
    queryFn: () => analyticsApi.marginLeakage(pharmacyId, dateParams),
    enabled: tab === "margins",
  });

  const { data: scorecards } = useQuery({
    queryKey: ["analytics", "scorecards", pharmacyId, dateParams],
    queryFn: () => analyticsApi.branchScorecards(pharmacyId, dateParams),
    enabled: tab === "branches",
  });

  const revenueChange = summary?.sales?.revenueChangePercent ?? 0;
  const changeIcon = revenueChange >= 0 ? TrendingUp : TrendingDown;
  const changeColor = revenueChange >= 0 ? "text-green-600" : "text-red-600";

  const summaryStats = [
    {
      title: "Today's Revenue",
      value: summary?.sales?.todayRevenue != null
        ? `TZS ${summary.sales.todayRevenue.toLocaleString()}`
        : "—",
      icon: DollarSign,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950/30",
      detail: revenueChange !== 0
        ? `${revenueChange > 0 ? "+" : ""}${revenueChange.toFixed(1)}% vs yesterday`
        : undefined,
    },
    {
      title: "Sales Today",
      value: summary?.sales?.todaySalesCount ?? "—",
      icon: ShoppingCart,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      title: "Low Stock Items",
      value: summary?.inventory?.lowStockCount ?? "—",
      icon: AlertTriangle,
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-950/30",
    },
    {
      title: "Expiring in 30d",
      value: summary?.inventory?.expiringIn30Days ?? "—",
      icon: Package,
      color: "text-red-600",
      bg: "bg-red-50 dark:bg-red-950/30",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Analytics & Insights</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Real-time business intelligence for smarter decisions
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryStats.map((s) => (
          <Card key={s.title}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${s.bg}`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{s.title}</p>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
                {s.detail && (
                  <p className={`text-xs ${changeColor} flex items-center gap-1 mt-0.5`}>
                    {revenueChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {s.detail}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alert badges */}
      {summary?.alerts && (
        <div className="flex gap-3">
          {summary.alerts.pendingReorders > 0 && (
            <Badge variant="destructive" className="py-1 px-3">
              {summary.alerts.pendingReorders} pending reorders
            </Badge>
          )}
          {summary.alerts.unreadNotifications > 0 && (
            <Badge variant="secondary" className="py-1 px-3">
              {summary.alerts.unreadNotifications} unread notifications
            </Badge>
          )}
        </div>
      )}

      {/* Detail Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="dead-stock">Dead Stock</TabsTrigger>
          <TabsTrigger value="margins">Margin Leakage</TabsTrigger>
          <TabsTrigger value="branches">Branch Scorecards</TabsTrigger>
        </TabsList>

        {/* Overview placeholder */}
        <TabsContent value="overview">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mb-4 opacity-30" />
              <p>Charts coming soon — daily trends, payment mix, top drugs</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dead Stock */}
        <TabsContent value="dead-stock">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-red-500" />
                Dead Stock (No sales in 60+ days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drug</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Days Since Last Sale</TableHead>
                    <TableHead>Last Sold</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deadStock && deadStock.length > 0 ? deadStock.map((d, i) => (
                    <TableRow key={`${d.drugId}-${i}`}>
                      <TableCell className="font-medium">{d.drugName}</TableCell>
                      <TableCell>{d.branchName}</TableCell>
                      <TableCell className="text-right">{d.currentStock}</TableCell>
                      <TableCell className="text-right">TZS {d.stockValue.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={d.daysSinceLastSale > 90 ? "destructive" : "secondary"}>
                          {d.daysSinceLastSale}d
                        </Badge>
                      </TableCell>
                      <TableCell>{d.lastSoldAt ? new Date(d.lastSoldAt).toLocaleDateString() : "Never"}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No dead stock detected 🎉
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Margin Leakage */}
        <TabsContent value="margins">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-orange-500" />
                Margin Leakage — Items Sold Below Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt #</TableHead>
                    <TableHead>Drug</TableHead>
                    <TableHead className="text-right">Sold At</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Loss</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marginLeaks && marginLeaks.length > 0 ? marginLeaks.map((m, i) => (
                    <TableRow key={`${m.saleId}-${i}`}>
                      <TableCell className="font-mono text-xs">{m.receiptNumber}</TableCell>
                      <TableCell className="font-medium">{m.drugName}</TableCell>
                      <TableCell className="text-right">TZS {m.unitPrice.toLocaleString()}</TableCell>
                      <TableCell className="text-right">TZS {m.costPrice.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{m.quantity}</TableCell>
                      <TableCell className="text-right text-red-600 font-semibold">
                        -TZS {m.lossAmount.toLocaleString()}
                      </TableCell>
                      <TableCell>{new Date(m.saleDate).toLocaleDateString()}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No below-cost sales detected
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branch Scorecards */}
        <TabsContent value="branches">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-500" />
                Branch Performance Scorecards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scorecards && scorecards.length > 0 ? scorecards.map((b) => (
                  <Card key={b.branchId}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">{b.branchName}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Revenue</span>
                        <span className="font-semibold">TZS {b.totalRevenue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sales</span>
                        <span>{b.totalSales}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Avg Sale</span>
                        <span>TZS {b.avgSaleValue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Low Stock Items</span>
                        <Badge variant={b.lowStockItems > 0 ? "destructive" : "secondary"}>
                          {b.lowStockItems}
                        </Badge>
                      </div>
                      {b.topSellingDrug && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Top Drug</span>
                          <span className="font-medium truncate ml-2">{b.topSellingDrug}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )) : (
                  <div className="col-span-full text-center text-muted-foreground py-8">
                    No branch data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
