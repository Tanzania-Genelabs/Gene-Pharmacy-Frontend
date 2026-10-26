"use client";

import { use, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/api/analytics.api";
import { branchApi } from "@/api/branch.api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
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
  Users,
  Wallet,
} from "lucide-react";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

type Preset = "today" | "7d" | "30d" | "custom";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom" },
];

/** Local calendar date as YYYY-MM-DD (toISOString would give the UTC date, which is wrong near midnight). */
function ymd(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/** The API sends money as decimal strings. */
function tzs(value: string | number | null | undefined): string {
  return `TZS ${Number(value ?? 0).toLocaleString("en-TZ", { maximumFractionDigits: 0 })}`;
}

function pct(value: string | number | null | undefined): string {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

function profitClass(value: string | number | null | undefined): string {
  return Number(value ?? 0) < 0 ? "text-red-600" : "text-green-600";
}

export default function AnalyticsPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const [tab, setTab] = useState("branches");
  const [branchId, setBranchId] = useState("");
  const [preset, setPreset] = useState<Preset>("today");
  const [customFrom, setCustomFrom] = useState(ymd(daysAgo(6)));
  const [customTo, setCustomTo] = useState(ymd(new Date()));

  const range = useMemo(() => {
    switch (preset) {
      case "today":
        return { from: ymd(new Date()), to: ymd(new Date()) };
      case "7d":
        return { from: ymd(daysAgo(6)), to: ymd(new Date()) };
      case "30d":
        return { from: ymd(daysAgo(29)), to: ymd(new Date()) };
      case "custom":
        return { from: customFrom, to: customTo };
    }
  }, [preset, customFrom, customTo]);
  const rangeValid = Boolean(range.from && range.to && range.from <= range.to);
  const branchParam = branchId || undefined;

  const { data: branches } = useQuery({
    queryKey: ["branches", pharmacyId],
    queryFn: () => branchApi.list(pharmacyId),
  });

  // The headline cards are always "today", optionally narrowed to one branch.
  const { data: summary } = useQuery({
    queryKey: ["analytics", "daily-summary", pharmacyId, branchId],
    queryFn: () => analyticsApi.dailySummary(pharmacyId, { date: ymd(new Date()), branchId: branchParam }),
    refetchInterval: 60_000,
  });

  const { data: scorecards, isLoading: scorecardsLoading } = useQuery({
    queryKey: ["analytics", "scorecards", pharmacyId, range],
    queryFn: () => analyticsApi.branchScorecards(pharmacyId, range),
    enabled: tab === "branches" && rangeValid,
  });

  const { data: sellers, isLoading: sellersLoading } = useQuery({
    queryKey: ["analytics", "sellers", pharmacyId, range, branchId],
    queryFn: () => analyticsApi.sellerPerformance(pharmacyId, { ...range, branchId: branchParam }),
    enabled: tab === "sellers" && rangeValid,
  });

  const { data: deadStock } = useQuery({
    queryKey: ["analytics", "dead-stock", pharmacyId],
    queryFn: () => analyticsApi.deadStock(pharmacyId, { daysSinceLastSale: 60 }),
    enabled: tab === "dead-stock",
  });

  const { data: marginLeaks } = useQuery({
    queryKey: ["analytics", "margin-leakage", pharmacyId, range, branchId],
    queryFn: () => analyticsApi.marginLeakage(pharmacyId, { ...range, branchId: branchParam }),
    enabled: tab === "margins" && rangeValid,
  });

  const revenueChange = Number(summary?.sales?.revenueChange ?? 0);
  const yesterdayRevenue = Number(summary?.sales?.yesterdayRevenue ?? 0);
  // No percentage when yesterday had no sales: there is nothing to compare against.
  const revenueChangePct = yesterdayRevenue > 0 ? (revenueChange / yesterdayRevenue) * 100 : null;
  const scopeLabel = branchId ? (branches?.find((b) => b.id === branchId)?.name ?? "Branch") : "All branches";

  const summaryStats = [
    {
      title: "Today's Revenue",
      value: summary ? tzs(summary.sales.todayRevenue) : "—",
      icon: DollarSign,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950/30",
      detail:
        revenueChangePct !== null
          ? { text: `${revenueChange >= 0 ? "+" : ""}${revenueChangePct.toFixed(1)}% vs yesterday`, up: revenueChange >= 0 }
          : undefined,
    },
    {
      title: "Today's Profit",
      value: summary ? tzs(summary.sales.grossProfit) : "—",
      valueClass: summary ? profitClass(summary.sales.grossProfit) : "",
      icon: Wallet,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      note: summary ? `${pct(summary.sales.marginPct)} margin · cost ${tzs(summary.sales.totalCost)}` : undefined,
    },
    {
      title: "Sales Today",
      value: summary?.sales?.todayCount ?? "—",
      icon: ShoppingCart,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
      note: summary && summary.sales.voidedCount > 0 ? `${summary.sales.voidedCount} voided` : undefined,
    },
    {
      title: "Low Stock Items",
      value: summary?.inventory?.lowStockCount ?? "—",
      icon: AlertTriangle,
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-950/30",
      note: summary ? `${summary.inventory.nearExpiryCount} expiring in 30 days` : undefined,
    },
  ];

  const branchTotals = useMemo(() => {
    const rows = scorecards ?? [];
    const revenue = rows.reduce((sum, r) => sum + Number(r.totalRevenue), 0);
    const profit = rows.reduce((sum, r) => sum + Number(r.grossProfit), 0);
    return {
      revenue,
      profit,
      transactions: rows.reduce((sum, r) => sum + r.totalTransactions, 0),
      margin: revenue > 0 ? (profit / revenue) * 100 : 0,
    };
  }, [scorecards]);

  const periodBar = (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <Button
          key={p.value}
          size="sm"
          variant={preset === p.value ? "default" : "outline"}
          onClick={() => setPreset(p.value)}
        >
          {p.label}
        </Button>
      ))}
      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <Input type="date" className="h-8 w-40" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} />
          <span className="text-muted-foreground text-sm">to</span>
          <Input type="date" className="h-8 w-40" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} />
        </div>
      )}
      {!rangeValid && <span className="text-xs text-red-600">Pick a valid date range</span>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Analytics & Insights</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Sales and profit — {scopeLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="an-branch" className="text-sm text-muted-foreground">Branch</label>
          <select
            id="an-branch"
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            <option value="">All branches</option>
            {branches?.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Today's numbers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryStats.map((s) => (
          <Card key={s.title}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${s.bg}`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{s.title}</p>
                <p className={`text-xl font-bold text-foreground ${s.valueClass ?? ""}`}>{s.value}</p>
                {s.detail && (
                  <p className={`text-xs ${s.detail.up ? "text-green-600" : "text-red-600"} flex items-center gap-1 mt-0.5`}>
                    {s.detail.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {s.detail.text}
                  </p>
                )}
                {s.note && <p className="text-xs text-muted-foreground mt-0.5">{s.note}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alert badges */}
      {summary?.alerts && (
        <div className="flex flex-wrap gap-3">
          {summary.alerts.criticalReorderCount > 0 && (
            <Badge variant="destructive" className="py-1 px-3">
              {summary.alerts.criticalReorderCount} critical reorders
            </Badge>
          )}
          {summary.alerts.marginLeakageCount > 0 && (
            <Badge variant="destructive" className="py-1 px-3">
              {summary.alerts.marginLeakageCount} sold below cost today
            </Badge>
          )}
          {summary.alerts.discountAbuseCount > 0 && (
            <Badge variant="secondary" className="py-1 px-3">
              {summary.alerts.discountAbuseCount} heavily discounted sales today
            </Badge>
          )}
        </div>
      )}

      {/* Detail Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="branches">By Branch</TabsTrigger>
          <TabsTrigger value="sellers">By Seller</TabsTrigger>
          <TabsTrigger value="dead-stock">Dead Stock</TabsTrigger>
          <TabsTrigger value="margins">Margin Leakage</TabsTrigger>
        </TabsList>

        {/* By Branch */}
        <TabsContent value="branches" className="mt-4 space-y-4">
          {periodBar}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-500" />
                Branch performance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Branch</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-right">Avg sale</TableHead>
                    <TableHead className="text-right">Low stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scorecardsLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading…</TableCell>
                    </TableRow>
                  ) : scorecards && scorecards.length > 0 ? (
                    scorecards.map((b) => (
                      <TableRow key={b.branchId}>
                        <TableCell className="font-medium">{b.branchName}</TableCell>
                        <TableCell className="text-right tabular-nums">{b.totalTransactions}</TableCell>
                        <TableCell className="text-right tabular-nums">{tzs(b.totalRevenue)}</TableCell>
                        <TableCell className={`text-right tabular-nums font-semibold ${profitClass(b.grossProfit)}`}>
                          {tzs(b.grossProfit)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{pct(b.marginPct)}</TableCell>
                        <TableCell className="text-right tabular-nums">{tzs(b.averageTransactionValue)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={b.lowStockCount > 0 ? "destructive" : "secondary"}>{b.lowStockCount}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No branch data for this period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {scorecards && scorecards.length > 1 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-semibold">All branches</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{branchTotals.transactions}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{tzs(branchTotals.revenue)}</TableCell>
                      <TableCell className={`text-right tabular-nums font-semibold ${profitClass(branchTotals.profit)}`}>
                        {tzs(branchTotals.profit)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{pct(branchTotals.margin)}</TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            Profit = revenue minus the buying price of the items sold. Branch comparison always shows every branch;
            the branch selector above does not filter it.
          </p>
        </TabsContent>

        {/* By Seller */}
        <TabsContent value="sellers" className="mt-4 space-y-4">
          {periodBar}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                Sales by seller — {scopeLabel}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Seller</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-right">Discounts</TableHead>
                    <TableHead className="text-right">Voided</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sellersLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading…</TableCell>
                    </TableRow>
                  ) : sellers && sellers.length > 0 ? (
                    sellers.map((s) => (
                      <TableRow key={`${s.sellerId ?? "none"}-${s.branchId}`}>
                        <TableCell className="font-medium">
                          {s.sellerName}
                          {s.role && <span className="ml-2 text-xs text-muted-foreground">{s.role}</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{s.branchName}</TableCell>
                        <TableCell className="text-right tabular-nums">{s.totalTransactions}</TableCell>
                        <TableCell className="text-right tabular-nums">{tzs(s.totalRevenue)}</TableCell>
                        <TableCell className={`text-right tabular-nums font-semibold ${profitClass(s.grossProfit)}`}>
                          {tzs(s.grossProfit)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{pct(s.marginPct)}</TableCell>
                        <TableCell className="text-right tabular-nums">{tzs(s.discounts)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={s.voidedCount > 0 ? "secondary" : "outline"}>{s.voidedCount}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No sales in this period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dead Stock */}
        <TabsContent value="dead-stock" className="mt-4">
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
                  {deadStock && deadStock.length > 0 ? deadStock.map((d) => (
                    <TableRow key={`${d.drugId}-${d.branchId}`}>
                      <TableCell className="font-medium">{d.drugName}</TableCell>
                      <TableCell>{d.branchName}</TableCell>
                      <TableCell className="text-right">{d.currentStock}</TableCell>
                      <TableCell className="text-right">{tzs(d.stockValue)}</TableCell>
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
        <TabsContent value="margins" className="mt-4 space-y-4">
          {periodBar}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-orange-500" />
                Margin Leakage — Items Sold At or Below Cost
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
                  {marginLeaks && marginLeaks.length > 0 ? marginLeaks.map((m) => (
                    <TableRow key={`${m.saleId}-${m.drugId}`}>
                      <TableCell className="font-mono text-xs">{m.receiptNumber}</TableCell>
                      <TableCell className="font-medium">{m.drugName}</TableCell>
                      <TableCell className="text-right">{tzs(m.unitPrice)}</TableCell>
                      <TableCell className="text-right">{tzs(m.buyingPrice)}</TableCell>
                      <TableCell className="text-right">{m.quantity}</TableCell>
                      <TableCell className="text-right text-red-600 font-semibold">
                        -{tzs(m.totalLoss)}
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
      </Tabs>
    </div>
  );
}
