"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { expiryApi } from "@/api/expiry.api";
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
  AlertTriangle,
  Clock,
  TrendingDown,
  Package,
  ShieldAlert,
} from "lucide-react";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

export default function ExpiryPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const [tab, setTab] = useState("overview");

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["expiry", "dashboard", pharmacyId],
    queryFn: () => expiryApi.dashboard(pharmacyId),
  });

  const { data: nearExpiry } = useQuery({
    queryKey: ["expiry", "near-expiry", pharmacyId],
    queryFn: () => expiryApi.nearExpiry(pharmacyId, { days: 90 }),
  });

  const { data: reorders } = useQuery({
    queryKey: ["expiry", "reorders", pharmacyId],
    queryFn: () => expiryApi.reorderRecommendations(pharmacyId),
  });

  const stats = [
    {
      title: "Expired",
      value: dashboard?.expiredCount ?? 0,
      icon: ShieldAlert,
      color: "text-red-600",
      bg: "bg-red-50 dark:bg-red-950/30",
    },
    {
      title: "Expiring in 7 days",
      value: dashboard?.expiringIn7Days ?? 0,
      icon: AlertTriangle,
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-950/30",
    },
    {
      title: "Expiring in 30 days",
      value: dashboard?.expiringIn30Days ?? 0,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950/30",
    },
    {
      title: "At-Risk Value",
      value: dashboard?.totalAtRiskValue != null
        ? `TZS ${dashboard.totalAtRiskValue.toLocaleString()}`
        : "—",
      icon: TrendingDown,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950/30",
    },
  ];

  function urgencyBadge(urgency: string) {
    const map: Record<string, string> = {
      Critical: "destructive",
      High: "destructive",
      Medium: "secondary",
      Low: "outline",
    };
    return <Badge variant={map[urgency] as "destructive" | "secondary" | "outline" ?? "secondary"}>{urgency}</Badge>;
  }

  function expiryBadge(days: number) {
    if (days <= 0) return <Badge variant="destructive">Expired</Badge>;
    if (days <= 7) return <Badge variant="destructive">{days}d left</Badge>;
    if (days <= 30) return <Badge className="bg-orange-500 text-white">{days}d left</Badge>;
    return <Badge variant="secondary">{days}d left</Badge>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Expiry & Stock Health</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor expiring drugs and get smart reorder suggestions
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.title}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${s.bg}`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{s.title}</p>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Near-Expiry Items</TabsTrigger>
          <TabsTrigger value="reorders">Reorder Suggestions</TabsTrigger>
        </TabsList>

        {/* Near-expiry items */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Items Approaching Expiry
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drug</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Qty Left</TableHead>
                    <TableHead className="text-right">Original Price</TableHead>
                    <TableHead className="text-right">Markdown Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nearExpiry && nearExpiry.length > 0 ? (
                    nearExpiry.map((item, i) => (
                      <TableRow key={`${item.drugId}-${item.batchNumber}-${i}`}>
                        <TableCell className="font-medium">{item.drugName}</TableCell>
                        <TableCell>{item.branchName}</TableCell>
                        <TableCell className="font-mono text-xs">{item.batchNumber}</TableCell>
                        <TableCell>{item.expiryDate}</TableCell>
                        <TableCell>{expiryBadge(item.daysUntilExpiry)}</TableCell>
                        <TableCell className="text-right">{item.remainingQuantity}</TableCell>
                        <TableCell className="text-right">TZS {item.originalPrice.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          TZS {item.suggestedMarkdownPrice.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        {isLoading ? "Loading…" : "No near-expiry items. Your stock is healthy! 🎉"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reorder recommendations */}
        <TabsContent value="reorders">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-500" />
                Smart Reorder Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drug</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Avg Daily Usage</TableHead>
                    <TableHead className="text-right">Days Left</TableHead>
                    <TableHead className="text-right">Order Qty</TableHead>
                    <TableHead>Urgency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reorders && reorders.length > 0 ? (
                    reorders.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.drugName}</TableCell>
                        <TableCell>{r.branchName}</TableCell>
                        <TableCell className="text-right">{r.currentStock}</TableCell>
                        <TableCell className="text-right">{r.avgDailyUsage.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{r.daysOfStockRemaining}</TableCell>
                        <TableCell className="text-right font-semibold">{r.suggestedQuantity}</TableCell>
                        <TableCell>{urgencyBadge(r.urgency)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No reorder recommendations at this time.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
