"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/components/expenses/format";
import type { OwnerDashboardResponse } from "@/types";
import { CHART, compactMoney, shortDay, tooltipStyle } from "./format";

/** The last 14 days: sales as bars and profit as a line, on one money axis. */
export function DailyChart({ daily }: { daily: OwnerDashboardResponse["daily"] }) {
  const rows = daily.map((d) => ({ label: shortDay(d.date), revenue: Number(d.revenue), profit: Number(d.profit), salesCount: d.salesCount }));
  const hasSales = rows.some((r) => r.revenue > 0);

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" /> Last 14 days
        </CardTitle>
        <p className="text-xs text-muted-foreground">Sales and profit per day. Profit is before expenses.</p>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        {hasSales ? (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={rows} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
              <YAxis tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={false} tickFormatter={compactMoney} width={44} />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                contentStyle={tooltipStyle}
                formatter={(value, name) => [money(Number(value)), name === "revenue" ? "Sales" : "Profit"]}
              />
              <Legend
                iconSize={10}
                wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
                formatter={(value) => (value === "revenue" ? "Sales" : "Profit")}
              />
              <Bar dataKey="revenue" fill={CHART.revenue} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Line dataKey="profit" type="monotone" stroke={CHART.profit} strokeWidth={2} dot={{ r: 3, fill: CHART.profit, strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
            No sales in the last 14 days yet — your chart will grow from your first sale.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
