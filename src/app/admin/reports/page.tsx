"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2, LineChart } from "lucide-react";
import { adminReportApi } from "@/api/admin.api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const tzs = (value: string | number) => `TSh ${Math.round(Number(value)).toLocaleString()}`;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminBusinessReportsPage() {
  const today = new Date();
  const [from, setFrom] = useState(isoDate(new Date(today.getFullYear(), today.getMonth() - 5, 1)));
  const [to, setTo] = useState(isoDate(today));
  const valid = from !== "" && to !== "" && from <= to;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "business-report", from, to],
    queryFn: () => adminReportApi.business({ from, to }),
    enabled: valid,
  });

  const maxMonth = Math.max(1, ...(data?.revenue.byMonth.map((m) => Number(m.amount)) ?? [1]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight"><LineChart className="h-7 w-7" /> Business reports</h1>
          <p className="text-muted-foreground">How Gene Pharmacy itself is doing: money received, new and lost pharmacies, and free trials that became paying customers.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="rep-from" className="text-muted-foreground">From</label>
          <Input id="rep-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          <label htmlFor="rep-to" className="text-muted-foreground">To</label>
          <Input id="rep-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
      </div>
      {!valid && <p className="text-sm text-destructive">The end date is before the start date.</p>}

      {isLoading && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
      {isError && <p className="py-8 text-center text-destructive">Could not load the report.</p>}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Money received" value={tzs(data.revenue.total)} hint={`${data.revenue.payments} payments in this period`} />
            <Stat label="Paying pharmacies now" value={String(data.customers.payingNow)} hint={`${data.customers.onTrialNow} on a free trial`} />
            <Stat label="Estimated monthly income" value={tzs(data.customers.estimatedMonthlyRecurring)} hint={`about ${tzs(data.customers.averagePerPayingPharmacy)} per paying pharmacy (plan list prices)`} />
            <Stat label="Received, all time" value={tzs(data.revenue.allTime)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Money received by month</CardTitle>
              <CardDescription>Confirmed subscription payments only. Free promotions and reversed entries are not counted.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3 overflow-x-auto pb-1">
                {data.revenue.byMonth.map((m) => (
                  <div key={m.month} className="flex min-w-14 flex-1 flex-col items-center gap-1" title={`${m.label}: ${tzs(m.amount)} from ${m.payments} payments`}>
                    <span className="text-xs tabular-nums">{Number(m.amount) > 0 ? tzs(m.amount) : "-"}</span>
                    <div className="w-full rounded-t bg-primary/70" style={{ height: `${Math.max(4, (Number(m.amount) / maxMonth) * 120)}px` }} />
                    <span className="text-xs text-muted-foreground">{m.label}</span>
                  </div>
                ))}
              </div>
              {data.revenue.byMethod.length > 0 && (
                <p className="mt-4 text-sm text-muted-foreground">
                  By method: {data.revenue.byMethod.map((x) => `${x.method} ${tzs(x.amount)} (${x.payments})`).join(" · ")}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>Growth</CardTitle><CardDescription>Pharmacies that registered in this period</CardDescription></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><span className="text-2xl font-semibold">{data.growth.newPharmacies}</span> new ({data.growth.newApproved} approved)</p>
                <p className="text-muted-foreground">{data.growth.activePharmacies} active of {data.growth.totalPharmacies} registered</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Free trial to paying</CardTitle><CardDescription>Trials that started in this period</CardDescription></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>
                  <span className="text-2xl font-semibold">{data.trials.conversionPercent === null ? "-" : `${data.trials.conversionPercent}%`}</span>{" "}
                  {data.trials.converted} of {data.trials.started} went on to pay
                </p>
                {data.trials.convertedNames.length > 0 && <p className="text-muted-foreground">{data.trials.convertedNames.join(", ")}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Stopped using it</CardTitle><CardDescription>Plan ran out in this period and was not renewed</CardDescription></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><span className="text-2xl font-semibold">{data.churn.lostPharmacies}</span> pharmacies ({data.churn.lostPaying} were paying)</p>
                <p className="text-muted-foreground">{data.churn.closedOrSuspended} closed or suspended in total</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Top payers</CardTitle><CardDescription>Most money received in this period</CardDescription></CardHeader>
              <CardContent>
                {data.topPayers.length === 0 ? <p className="text-sm text-muted-foreground">No payments in this period.</p> : (
                  <ul className="divide-y text-sm">
                    {data.topPayers.map((t) => (
                      <li key={t.pharmacyId} className="flex justify-between gap-3 py-2">
                        <Link href={`/admin/pharmacies/${t.pharmacyId}`} className="font-medium hover:underline">{t.name}</Link>
                        <span className="text-muted-foreground">{tzs(t.amount)} · {t.payments} payments</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Pharmacies that left</CardTitle><CardDescription>Worth a phone call</CardDescription></CardHeader>
              <CardContent>
                {data.churn.items.length === 0 ? <p className="text-sm text-muted-foreground">None in this period.</p> : (
                  <ul className="divide-y text-sm">
                    {data.churn.items.map((c) => (
                      <li key={c.pharmacyId} className="flex items-center justify-between gap-3 py-2">
                        <Link href={`/admin/pharmacies/${c.pharmacyId}`} className="font-medium hover:underline">{c.name}</Link>
                        <span className="flex items-center gap-2 text-muted-foreground">{c.plan} · ended {c.endedOn} {c.wasPaying && <Badge variant="secondary">was paying</Badge>}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
