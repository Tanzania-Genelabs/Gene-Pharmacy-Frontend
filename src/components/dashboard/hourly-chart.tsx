"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/components/expenses/format";
import type { OwnerDashboardResponse } from "@/types";
import { CHART, compactMoney, hourLabel, plural, tooltipStyle } from "./format";

/** Today's sales per hour; the current hour is drawn in full colour. Opening hours only, widened to any hour with sales. */
export function HourlyChart({ hourly, currentHour }: { hourly: OwnerDashboardResponse["hourly"]; currentHour: number }) {
  const sold = hourly.filter((h) => Number(h.revenue) > 0).map((h) => h.hour);
  const first = Math.min(7, ...sold);
  const last = Math.max(21, currentHour, ...sold);
  const rows = hourly
    .filter((h) => h.hour >= first && h.hour <= last)
    .map((h) => ({ hour: h.hour, label: hourLabel(h.hour), revenue: Number(h.revenue), salesCount: h.salesCount }));
  const busiest = rows.reduce<(typeof rows)[number] | null>((best, r) => (r.revenue > (best?.revenue ?? 0) ? r : best), null);

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" /> Sales by hour today
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {busiest ? `Busiest so far: ${busiest.label} (${money(busiest.revenue)})` : "Bars appear as sales come in."}
        </p>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={rows} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={false} tickFormatter={compactMoney} width={44} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              contentStyle={tooltipStyle}
              labelFormatter={(label) => `${label} – ${String(label).slice(0, 2)}:59`}
              formatter={(value, _name, item) => [`${money(Number(value))} · ${plural((item.payload as { salesCount: number }).salesCount, "sale")}`, "Sold"]}
            />
            <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={28}>
              {rows.map((r) => (
                <Cell key={r.hour} fill={r.hour === currentHour ? CHART.revenue : CHART.revenueSoft} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
