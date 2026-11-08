"use client";

import { use, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/api/analytics.api";
import { branchApi } from "@/api/branch.api";
import { insightsApi } from "@/api/insights.api";
import { PeriodPicker } from "@/components/insights/period-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DollarSign,
  Package,
  Building2,
  Users,
  Wallet,
  ShoppingCart,
  HelpCircle,
  Search,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { isValidRange, parseYmd, presetRange, rangeLabel, ymd, type DateRange, type PeriodPreset } from "@/lib/periods";
import type { ProfitGroup, ProfitPeriodRow } from "@/types";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

const MONEY_PRESETS: PeriodPreset[] = ["today", "yesterday", "7d", "month", "lastMonth", "custom"];

const GROUPS: { value: ProfitGroup; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

type ProductSort = "most" | "least" | "loss";

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

/** "Sat 7 Nov", "Week of 2 Nov", "Nov 2026". */
function periodLabel(row: ProfitPeriodRow): string {
  if (row.group === "month") {
    const [y, m] = row.period.split("-").map(Number);
    return new Date(y, (m || 1) - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }
  const d = parseYmd(row.period).toLocaleDateString("en-GB", { weekday: row.group === "day" ? "short" : undefined, day: "numeric", month: "short" });
  return row.group === "week" ? `Week of ${d}` : d;
}

export default function AnalyticsPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const role = useAuthStore((s) => s.user?.role);
  // Profit is for owners and managers only (the server refuses it to sellers too).
  const canSeeProfit = role === "Owner" || role === "Manager" || role === "SuperAdmin";
  const [tab, setTab] = useState("branches");
  const [branchId, setBranchId] = useState("");
  const [preset, setPreset] = useState<PeriodPreset>("today");
  const [custom, setCustom] = useState<DateRange>(() => ({ from: ymd(new Date()), to: ymd(new Date()) }));
  const [group, setGroup] = useState<ProfitGroup>("day");
  const [productSearch, setProductSearch] = useState("");
  const [productSort, setProductSort] = useState<ProductSort>("most");
  const [showHelp, setShowHelp] = useState(false);

  const range = presetRange(preset, custom);
  const rangeValid = isValidRange(range);
  const branchParam = branchId || undefined;

  const { data: branches } = useQuery({
    queryKey: ["branches", pharmacyId],
    queryFn: () => branchApi.list(pharmacyId),
  });

  // Only used for the warning badges (sold below cost, heavy discounts, reorders) for today.
  const { data: summary } = useQuery({
    queryKey: ["analytics", "daily-summary", pharmacyId, branchId],
    queryFn: () => analyticsApi.dailySummary(pharmacyId, { date: ymd(new Date()), branchId: branchParam }),
    refetchInterval: 60_000,
    enabled: canSeeProfit,
  });

  const { data: breakdown, isLoading: breakdownLoading, isError: breakdownError } = useQuery({
    queryKey: ["analytics", "profit-breakdown", pharmacyId, range.from, range.to, branchId, group],
    queryFn: () => insightsApi.profitBreakdown(pharmacyId, { from: range.from, to: range.to, branchId: branchParam, group }),
    enabled: canSeeProfit && rangeValid,
    placeholderData: (prev) => prev,
  });

  const { data: scorecards, isLoading: scorecardsLoading } = useQuery({
    queryKey: ["analytics", "scorecards", pharmacyId, range.from, range.to],
    queryFn: () => analyticsApi.branchScorecards(pharmacyId, range),
    enabled: canSeeProfit && tab === "branches" && rangeValid,
  });

  const { data: sellers, isLoading: sellersLoading } = useQuery({
    queryKey: ["analytics", "sellers", pharmacyId, range.from, range.to, branchId],
    queryFn: () => analyticsApi.sellerPerformance(pharmacyId, { ...range, branchId: branchParam }),
    enabled: canSeeProfit && tab === "sellers" && rangeValid,
  });

  const { data: deadStock } = useQuery({
    queryKey: ["analytics", "dead-stock", pharmacyId],
    queryFn: () => analyticsApi.deadStock(pharmacyId, { daysSinceLastSale: 60 }),
    enabled: canSeeProfit && tab === "dead-stock",
  });

  const { data: marginLeaks } = useQuery({
    queryKey: ["analytics", "margin-leakage", pharmacyId, range.from, range.to, branchId],
    queryFn: () => analyticsApi.marginLeakage(pharmacyId, { ...range, branchId: branchParam }),
    enabled: canSeeProfit && tab === "margins" && rangeValid,
  });

  const scopeLabel = branchId ? (branches?.find((b) => b.id === branchId)?.name ?? "Branch") : "All branches";

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

  // Profit per period as bars: the longest bar is the biggest profit (or loss).
  const periodMax = useMemo(
    () => Math.max(1, ...(breakdown?.periods ?? []).map((p) => Math.abs(Number(p.profit)))),
    [breakdown],
  );

  const products = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    const rows = (breakdown?.products ?? []).filter((p) => !term || p.drugName.toLowerCase().includes(term));
    const profit = (p: { profit: string }) => Number(p.profit);
    return [...rows].sort((a, b) => {
      if (productSort === "least") return profit(a) - profit(b);
      if (productSort === "loss") {
        const aLoss = profit(a) < 0;
        const bLoss = profit(b) < 0;
        if (aLoss !== bLoss) return aLoss ? -1 : 1;
        return aLoss ? profit(a) - profit(b) : profit(b) - profit(a);
      }
      return profit(b) - profit(a);
    });
  }, [breakdown, productSearch, productSort]);
  const lossCount = (breakdown?.products ?? []).filter((p) => Number(p.profit) < 0).length;

  if (!canSeeProfit) {
    return (
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Analytics</h2>
        <p className="text-muted-foreground">Only the owner or a manager can see money and profit here.</p>
      </div>
    );
  }

  const moneyCards = [
    {
      title: "Sales",
      value: breakdown ? tzs(breakdown.revenue) : "—",
      help: "All the money customers paid (voided sales not counted).",
      icon: ShoppingCart,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      title: "Cost of drugs",
      value: breakdown ? tzs(breakdown.cost) : "—",
      help: "What you paid your supplier for the drugs that were sold.",
      icon: Package,
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-950/30",
    },
    {
      title: "Profit",
      value: breakdown ? tzs(breakdown.profit) : "—",
      valueClass: breakdown ? profitClass(breakdown.profit) : "",
      help: breakdown?.marginPct != null
        ? `Sales − cost of drugs. You keep ${pct(breakdown.marginPct)} of every sale.`
        : "Sales − cost of drugs.",
      icon: Wallet,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Analytics</h2>
          <p className="text-muted-foreground text-sm mt-1">
            How much you sold and how much you earned — {scopeLabel}
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

      {/* ── Money ─────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            Money
          </h3>
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            aria-expanded={showHelp}
          >
            <HelpCircle className="h-4 w-4" />
            How is profit worked out?
          </button>
        </div>
        {showHelp && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
            <p><strong>Profit = Sales − buying price of what was sold.</strong></p>
            <p className="text-muted-foreground">
              Example: you sell a box for TZS 3,000 that you bought for TZS 2,000 → profit is TZS 1,000.
              Rent, salaries and other expenses are not taken out here. If a drug has no buying price saved,
              its profit will look too high — add the buying price on the Drugs page.
            </p>
          </div>
        )}

        <PeriodPicker
          presets={MONEY_PRESETS}
          preset={preset}
          onPresetChange={setPreset}
          custom={custom}
          onCustomChange={setCustom}
        />
        {rangeValid && <p className="text-sm text-muted-foreground">{rangeLabel(range)}</p>}
        {breakdownError && (
          <p className="text-sm text-red-600">Could not load the money numbers. Check your connection and try again.</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {moneyCards.map((c) => (
            <Card key={c.title}>
              <CardContent className="flex items-start gap-4 p-5">
                <div className={`flex shrink-0 items-center justify-center w-10 h-10 rounded-lg ${c.bg}`}>
                  <c.icon className={`h-5 w-5 ${c.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">{c.title}</p>
                  <p className={cn("text-2xl font-bold text-foreground tabular-nums break-words", c.valueClass, breakdownLoading && "opacity-50")}>
                    {c.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{c.help}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Warnings for today */}
        {summary?.alerts && (
          <div className="flex flex-wrap gap-3">
            {summary.alerts.marginLeakageCount > 0 && (
              <Badge variant="destructive" className="py-1 px-3">
                Today: {summary.alerts.marginLeakageCount} item{summary.alerts.marginLeakageCount === 1 ? "" : "s"} sold below buying price
              </Badge>
            )}
            {summary.alerts.discountAbuseCount > 0 && (
              <Badge variant="secondary" className="py-1 px-3">
                Today: {summary.alerts.discountAbuseCount} sale{summary.alerts.discountAbuseCount === 1 ? "" : "s"} with a big discount
              </Badge>
            )}
            {summary.alerts.criticalReorderCount > 0 && (
              <Badge variant="destructive" className="py-1 px-3">
                {summary.alerts.criticalReorderCount} drug{summary.alerts.criticalReorderCount === 1 ? "" : "s"} must be reordered now
              </Badge>
            )}
          </div>
        )}

        {/* Profit by day / week / month */}
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Profit by {GROUPS.find((g) => g.value === group)?.label.toLowerCase()}</CardTitle>
            <div className="flex rounded-md border border-input p-0.5 text-sm">
              {GROUPS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGroup(g.value)}
                  className={cn(
                    "rounded px-3 py-1 font-medium transition-colors",
                    group === g.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {breakdownLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : !breakdown?.periods.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No sales in this period</p>
            ) : (
              <ul className="space-y-3">
                {breakdown.periods.map((p) => {
                  const profit = Number(p.profit);
                  return (
                    <li key={p.period} className="space-y-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                        <span className="font-medium">{periodLabel(p)}</span>
                        <span className={cn("font-semibold tabular-nums", profitClass(profit))}>{tzs(profit)}</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", profit < 0 ? "bg-red-500" : "bg-emerald-500")}
                          style={{ width: `${Math.max(2, (Math.abs(profit) / periodMax) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {p.salesCount} sale{p.salesCount === 1 ? "" : "s"} · sold {tzs(p.revenue)} · cost {tzs(p.cost)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Profit by product */}
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="text-base">Profit by product</CardTitle>
            <p className="text-sm text-muted-foreground">
              Which drug earned you what.
              {lossCount > 0 && (
                <span className="ml-1 font-medium text-red-600">
                  {lossCount} product{lossCount === 1 ? " was" : "s were"} sold at a loss.
                </span>
              )}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Find a product…"
                  className="pl-8"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>
              <select
                aria-label="Sort products"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={productSort}
                onChange={(e) => setProductSort(e.target.value as ProductSort)}
              >
                <option value="most">Most profit first</option>
                <option value="least">Least profit first</option>
                <option value="loss">Loss-making first</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Units sold</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdownLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading…</TableCell>
                  </TableRow>
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {productSearch.trim() ? `No product matches “${productSearch.trim()}”` : "No products sold in this period"}
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((p) => {
                    const loss = Number(p.profit) < 0;
                    return (
                      <TableRow key={p.drugId} className={loss ? "bg-red-50/60 dark:bg-red-950/20" : undefined}>
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-1">
                            {loss && <TrendingDown className="h-3.5 w-3.5 shrink-0 text-red-600" />}
                            {p.drugName}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">
                          {Number(p.unitsSold).toLocaleString()} <span className="text-xs text-muted-foreground">{p.unit ?? ""}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">{tzs(p.revenue)}</TableCell>
                        <TableCell className={cn("text-right tabular-nums font-semibold whitespace-nowrap", profitClass(p.profit))}>
                          {tzs(p.profit)}
                        </TableCell>
                        <TableCell className={cn("text-right tabular-nums", loss && "text-red-600")}>
                          {p.marginPct == null ? "—" : pct(p.marginPct)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">
          Margin = profit ÷ sales. A margin of 25% means you keep TZS 250 of every TZS 1,000 sold.
        </p>
      </section>

      {/* Detail Tabs */}
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">More details</h3>
        <p className="text-sm text-muted-foreground">
          Branches, sellers and losses use the period chosen at the top. Dead stock looks at the last 60 days.
        </p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="branches">By Branch</TabsTrigger>
          <TabsTrigger value="sellers">By Seller</TabsTrigger>
          <TabsTrigger value="dead-stock">Dead Stock</TabsTrigger>
          <TabsTrigger value="margins">Sold at a loss</TabsTrigger>
        </TabsList>

        {/* By Branch */}
        <TabsContent value="branches" className="mt-4 space-y-4">
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
            Profit = sales minus the buying price of the items sold. This table always shows every branch;
            the branch selector at the top does not filter it.
          </p>
        </TabsContent>

        {/* By Seller */}
        <TabsContent value="sellers" className="mt-4 space-y-4">
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-orange-500" />
                Sold at a loss — items sold at or below their buying price
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
