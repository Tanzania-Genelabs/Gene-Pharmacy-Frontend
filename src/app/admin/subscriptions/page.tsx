"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { adminSubscriptionApi } from "@/api/admin.api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  Loader2,
  Activity,
  Clock,
  AlertTriangle,
  Pause,
  PlayCircle,
  Gift,
  Search,
} from "lucide-react";
import { GrantAccessDialog } from "@/components/admin/grant-access-dialog";
import { MethodBadge } from "@/components/admin/method-badge";
import { Input } from "@/components/ui/input";
import type { AdminSubscriptionRow } from "@/types";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  Trial: "outline",
  Active: "default",
  GracePeriod: "secondary",
  Expired: "destructive",
  Suspended: "destructive",
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "Trial", label: "Trial" },
  { value: "Active", label: "Active" },
  { value: "GracePeriod", label: "Grace Period" },
  { value: "Expired", label: "Expired" },
  { value: "Suspended", label: "Suspended" },
];

const PLAN_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All Plans" },
  { value: "Basic", label: "Basic" },
  { value: "Standard", label: "Standard" },
  { value: "Premium", label: "Premium" },
  { value: "Trial", label: "Trial" },
];

export default function AdminSubscriptionsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [grantFor, setGrantFor] = useState<string | null>(null);
  const [grantOpen, setGrantOpen] = useState(false);

  // Wait for a pause in typing before asking the server.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  function openGrant(pharmacyId?: string) {
    setGrantFor(pharmacyId ?? null);
    setGrantOpen(true);
  }

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "subscriptions", statusFilter, planFilter, search, page],
    queryFn: () =>
      adminSubscriptionApi.list({
        status: statusFilter === "all" ? undefined : statusFilter,
        planType: planFilter === "all" ? undefined : planFilter,
        search: search || undefined,
        page,
        size: 20,
      }),
  });

  const { data: stats } = useQuery({
    queryKey: ["admin", "subscriptions", "stats"],
    queryFn: () => adminSubscriptionApi.stats(),
  });

  const subscriptions: AdminSubscriptionRow[] = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-muted-foreground">
            Who is on which plan, what they have paid, and when access ends. Problem accounts are listed first.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/payments">All payments</Link>
          </Button>
          <Button onClick={() => openGrant()}>
            <Gift className="h-4 w-4 mr-2" />
            Give access
          </Button>
        </div>
      </div>

      <GrantAccessDialog open={grantOpen} onOpenChange={setGrantOpen} pharmacyId={grantFor ?? undefined} />

      {/* Stat Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total" value={stats.total} icon={CreditCard} />
          <StatCard label="Trial" value={stats.trial} icon={PlayCircle} />
          <StatCard label="Active" value={stats.active} icon={Activity} />
          <StatCard
            label="Grace Period"
            value={stats.gracePeriod}
            icon={Clock}
          />
          <StatCard
            label="Expired"
            value={stats.expired}
            icon={AlertTriangle}
          />
          <StatCard label="Suspended" value={stats.suspended} icon={Pause} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search pharmacy name…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8 w-64"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 w-44"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={planFilter}
          onChange={(e) => {
            setPlanFilter(e.target.value);
            setPage(0);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 w-40"
        >
          {PLAN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription List</CardTitle>
          <CardDescription>
            {data?.totalElements ?? 0} total subscriptions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">
                No subscriptions found
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Subscriptions will appear once pharmacies are onboarded.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Pharmacy</th>
                    <th className="pb-3 font-medium">Plan</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Valid until</th>
                    <th className="pb-3 font-medium text-right">Paid so far</th>
                    <th className="pb-3 font-medium">Last payment</th>
                    <th className="pb-3 font-medium">Access</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {subscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-muted/50 transition-colors align-top">
                      <td className="py-3 pr-3 font-medium">
                        {sub.pharmacyName ?? <span className="font-mono text-xs text-muted-foreground">{sub.pharmacyId.substring(0, 8)}…</span>}
                      </td>
                      <td className="py-3 pr-3">
                        <Badge variant="outline">{sub.planType}</Badge>
                      </td>
                      <td className="py-3 pr-3">
                        <Badge variant={STATUS_VARIANT[sub.status] ?? "outline"}>{sub.status}</Badge>
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap">
                        {new Date(sub.endDate).toLocaleDateString()}
                        <p className="text-xs text-muted-foreground">
                          {sub.daysRemaining ? `${sub.daysRemaining} day${sub.daysRemaining === 1 ? "" : "s"} left` : "ended"}
                          {sub.graceEndDate && new Date(sub.graceEndDate) > new Date(sub.endDate)
                            ? ` · grace to ${new Date(sub.graceEndDate).toLocaleDateString()}`
                            : ""}
                        </p>
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums whitespace-nowrap">
                        <span className="font-medium">TZS {Number(sub.payments.totalPaid).toLocaleString()}</span>
                        <p className="text-xs text-muted-foreground">
                          {sub.payments.paymentCount} payment{sub.payments.paymentCount === 1 ? "" : "s"}
                        </p>
                      </td>
                      <td className="py-3 pr-3">
                        {sub.payments.lastPayment ? (
                          <div className="space-y-0.5">
                            <MethodBadge method={sub.payments.lastPayment.method} />
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {sub.payments.lastPayment.method === "Promotion"
                                ? "Free"
                                : `TZS ${Number(sub.payments.lastPayment.amount).toLocaleString()}`}
                              {sub.payments.lastPayment.at ? ` · ${new Date(sub.payments.lastPayment.at).toLocaleDateString()}` : ""}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No payments yet</span>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <Badge variant={sub.accessGranted ? "default" : "destructive"}>
                          {sub.accessGranted ? "Granted" : "Blocked"}
                        </Badge>
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <Button variant="outline" size="sm" onClick={() => openGrant(sub.pharmacyId)}>
                          Give access
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <p className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
