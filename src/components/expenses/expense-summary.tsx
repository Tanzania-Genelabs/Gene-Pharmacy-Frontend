"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Banknote, Receipt, TrendingUp, Wallet } from "lucide-react";
import { expenseApi } from "@/api/expense.api";
import { reportApi } from "@/api/report.api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BranchResponse, ExpenseBucket } from "@/types";
import { firstOfMonth, isoToday, methodLabel, money } from "./format";

function Kpi({ title, value, icon: Icon, hint, tone }: { title: string; value: string; icon: React.ComponentType<{ className?: string }>; hint?: React.ReactNode; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          {title}
          <Icon className="h-4 w-4" />
        </div>
        <div className={`text-2xl font-bold tabular-nums ${tone ?? ""}`}>{value}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function Buckets({ title, rows, label }: { title: string; rows: ExpenseBucket[]; label?: (name: string) => string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Nothing recorded in this period.</p>}
        {rows.map((r) => (
          <div key={r.id ?? r.name} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{label ? label(r.name) : r.name} <span className="text-muted-foreground">· {r.count}</span></span>
              <span className="tabular-nums font-medium">{money(r.total)} <span className="text-muted-foreground font-normal">({r.sharePct}%)</span></span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${Math.min(100, Number(r.sharePct))}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Totals, charts and the profit picture for a date range. Managers and owners only. */
export function ExpenseSummaryTab({ pharmacyId, branches, canPickBranch }: { pharmacyId: string; branches: BranchResponse[]; canPickBranch: boolean }) {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(isoToday());
  const [branchId, setBranchId] = useState("all");
  const params = { from, to, ...(branchId !== "all" ? { branchId } : {}) };
  const ready = !!from && !!to && from <= to;

  const summary = useQuery({ queryKey: ["expenses", pharmacyId, "summary", params], queryFn: () => expenseApi.summary(pharmacyId, params), enabled: ready });
  const profit = useQuery({ queryKey: ["expenses", pharmacyId, "profit", params], queryFn: () => reportApi.profit(pharmacyId, params), enabled: ready });

  const s = summary.data;
  const p = profit.data;
  const change = s && Number(s.previousTotal) > 0 ? Math.round(((Number(s.total) - Number(s.previousTotal)) / Number(s.previousTotal)) * 100) : null;
  const net = p?.netProfit != null ? Number(p.netProfit) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1"><span className="text-xs text-muted-foreground">From</span><Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
        <div className="space-y-1"><span className="text-xs text-muted-foreground">To</span><Input type="date" value={to} min={from} max={isoToday()} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
        {canPickBranch && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Branch</span>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          title="Total expenses"
          value={money(s?.total)}
          icon={Wallet}
          hint={change === null ? "No earlier period to compare" : (
            <span className={`inline-flex items-center gap-1 ${change > 0 ? "text-destructive" : "text-green-600"}`}>
              {change > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{Math.abs(change)}% vs the period before
            </span>
          )}
        />
        <Kpi title="Entries" value={s ? String(s.count) : "—"} icon={Receipt} />
        <Kpi title="Profit before expenses" value={money(p?.grossProfit)} icon={Banknote} hint="Sales minus cost of the drugs sold" />
        <Kpi
          title="Profit after expenses"
          value={net === null ? "—" : money(net)}
          icon={TrendingUp}
          tone={net === null ? "" : net < 0 ? "text-destructive" : "text-green-600"}
          hint={p?.netMarginPct != null ? `${p.netMarginPct}% of sales` : "Profit before expenses, minus expenses"}
        />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Expenses per day</CardTitle></CardHeader>
        <CardContent className="h-64">
          {s && s.byDay.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.byDay.map((d) => ({ date: d.date.slice(5), total: Number(d.total) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground pt-6">No expenses in this period.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Buckets title="By category" rows={s?.byCategory ?? []} />
        <Buckets title="By payment method" rows={s?.byPaymentMethod ?? []} label={methodLabel} />
      </div>

      {p && p.byBranch.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Profit by branch</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Cost of drugs</TableHead>
                  <TableHead className="text-right">Profit before expenses</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Profit after expenses</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {p.byBranch.map((b) => (
                  <TableRow key={b.branchId}>
                    <TableCell className="font-medium">{b.branchName}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(b.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(b.costOfGoods)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(b.grossProfit)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(b.expenses)}</TableCell>
                    <TableCell className={`text-right tabular-nums font-semibold ${b.netProfit != null && Number(b.netProfit) < 0 ? "text-destructive" : ""}`}>{money(b.netProfit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
