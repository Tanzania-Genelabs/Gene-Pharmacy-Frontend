"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportApi } from "@/api/report.api";
import { BarChart3, Download, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { toast } from "sonner";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage({ params }: PageProps) {
  const { pharmacyId } = use(params);

  const today = new Date().toISOString().split("T")[0];
  const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  const [from, setFrom] = useState(thirtyAgo);
  const [to, setTo] = useState(today);

  const dateParams = { from, to };

  const { data: summary } = useQuery({
    queryKey: ["reports", "summary", pharmacyId, dateParams],
    queryFn: () => reportApi.salesSummary(pharmacyId, dateParams),
    enabled: !!from && !!to,
  });

  const { data: daily } = useQuery({
    queryKey: ["reports", "daily", pharmacyId, dateParams],
    queryFn: () => reportApi.salesDaily(pharmacyId, dateParams),
    enabled: !!from && !!to,
  });

  const { data: topDrugs } = useQuery({
    queryKey: ["reports", "top-drugs", pharmacyId, dateParams],
    queryFn: () => reportApi.topDrugs(pharmacyId, { ...dateParams, limit: 10 }),
    enabled: !!from && !!to,
  });

  const { data: paymentMethods } = useQuery({
    queryKey: ["reports", "payment-methods", pharmacyId, dateParams],
    queryFn: () => reportApi.paymentMethods(pharmacyId, dateParams),
    enabled: !!from && !!to,
  });

  const { data: inventorySummary } = useQuery({
    queryKey: ["reports", "inventory", pharmacyId],
    queryFn: () => reportApi.inventorySummary(pharmacyId),
  });

  const handleExportSales = async (format: "pdf" | "excel") => {
    try {
      const blob = await reportApi.exportSales(pharmacyId, format, dateParams);
      downloadBlob(blob, `sales-report-${from}-${to}.${format === "excel" ? "xlsx" : "pdf"}`);
      toast.success("Report exported successfully");
    } catch {
      toast.error("Failed to export report");
    }
  };

  const kpis = [
    {
      title: "Total Revenue",
      value: summary?.totalRevenue != null ? `TZS ${summary.totalRevenue.toLocaleString()}` : "—",
      icon: DollarSign,
      color: "text-green-600 dark:text-green-400",
    },
    {
      title: "Total Sales",
      value: summary?.totalSales?.toLocaleString() ?? "—",
      icon: TrendingUp,
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Avg Sale Value",
      value: summary ? `TZS ${summary.avgSaleValue?.toLocaleString()}` : "—",
      icon: BarChart3,
      color: "text-purple-600 dark:text-purple-400",
    },
    {
      title: "Active Branches",
      value: summary?.activeBranches?.toLocaleString() ?? "—",
      icon: TrendingDown,
      color: "text-destructive",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Reports</h2>
          <p className="text-muted-foreground text-sm mt-1">Analytics and export</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExportSales("excel")}>
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExportSales("pdf")}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Date range filter */}
      <div className="flex items-end gap-4">
        <div className="space-y-1">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={from} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={to} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTo(e.target.value)} className="w-40" />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-foreground">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">Sales Trend</TabsTrigger>
          <TabsTrigger value="drugs">Top Drugs</TabsTrigger>
          <TabsTrigger value="payment">Payment Methods</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              {daily && daily.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={daily}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                  No data for selected range
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drugs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Selling Drugs</CardTitle>
            </CardHeader>
            <CardContent>
              {topDrugs && topDrugs.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topDrugs} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="drugName" type="category" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="totalQuantity" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment Method Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              {paymentMethods && paymentMethods.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={paymentMethods}
                      dataKey="totalAmount"
                      nameKey="paymentMethod"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {paymentMethods.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total Products</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{inventorySummary?.totalDrugs ?? "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Low Stock Items</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-orange-600">{inventorySummary?.lowStockCount ?? "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Out of Stock</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-destructive">{inventorySummary?.outOfStockCount ?? "—"}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
