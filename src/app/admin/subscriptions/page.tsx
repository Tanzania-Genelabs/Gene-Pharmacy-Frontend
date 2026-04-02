"use client";

import { useState } from "react";
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
} from "lucide-react";
import type { SubscriptionResponse } from "@/types";

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

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "subscriptions", statusFilter, planFilter, page],
    queryFn: () =>
      adminSubscriptionApi.list({
        status: statusFilter === "all" ? undefined : statusFilter,
        planType: planFilter === "all" ? undefined : planFilter,
        page,
        size: 20,
      }),
  });

  const { data: stats } = useQuery({
    queryKey: ["admin", "subscriptions", "stats"],
    queryFn: () => adminSubscriptionApi.stats(),
  });

  const subscriptions: SubscriptionResponse[] = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
        <p className="text-muted-foreground">
          Manage pharmacy plans, billing cycles, and payments
        </p>
      </div>

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
                    <th className="pb-3 font-medium">Start Date</th>
                    <th className="pb-3 font-medium">End Date</th>
                    <th className="pb-3 font-medium">Grace End</th>
                    <th className="pb-3 font-medium">Payment Ref</th>
                    <th className="pb-3 font-medium">Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {subscriptions.map((sub) => (
                    <tr
                      key={sub.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-3 font-mono text-xs text-muted-foreground">
                        {sub.pharmacyId.substring(0, 8)}…
                      </td>
                      <td className="py-3">
                        <Badge variant="outline">{sub.planType}</Badge>
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={STATUS_VARIANT[sub.status] ?? "outline"}
                        >
                          {sub.status}
                        </Badge>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(sub.startDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(sub.endDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {sub.graceEndDate
                          ? new Date(sub.graceEndDate).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="py-3 font-mono text-xs text-muted-foreground">
                        {sub.paymentReference ?? "—"}
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={sub.accessGranted ? "default" : "destructive"}
                        >
                          {sub.accessGranted ? "Granted" : "Blocked"}
                        </Badge>
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
