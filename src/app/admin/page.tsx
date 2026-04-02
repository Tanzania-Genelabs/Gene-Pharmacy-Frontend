"use client";

import { useQuery } from "@tanstack/react-query";
import { pharmacyApi } from "@/api/pharmacy.api";
import { adminUserApi } from "@/api/admin.api";
import { adminSubscriptionApi } from "@/api/admin.api";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  ShieldCheck,
  Clock,
  Activity,
  Users,
  Crown,
  Briefcase,
  Store,
  UserCheck,
  UserX,
  CreditCard,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import type { PharmacyResponse } from "@/types";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  Active: "default",
  PendingApproval: "secondary",
  Suspended: "destructive",
  Deactivated: "outline",
  Rejected: "destructive",
};

function StatCard({
  label,
  value,
  icon: Icon,
  description,
  href,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  href?: string;
}) {
  const content = (
    <Card className={href ? "hover:border-primary/50 transition-colors cursor-pointer" : ""}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export default function AdminDashboardPage() {
  const { data: pharmacies, isLoading: pharmaLoading } = useQuery({
    queryKey: ["admin", "pharmacies"],
    queryFn: () => pharmacyApi.list({ size: 100 }),
  });
  const { data: userStats } = useQuery({
    queryKey: ["admin", "users", "stats"],
    queryFn: () => adminUserApi.stats(),
  });
  const { data: subStats } = useQuery({
    queryKey: ["admin", "subscriptions", "stats"],
    queryFn: () => adminSubscriptionApi.stats(),
  });

  const all: PharmacyResponse[] = pharmacies?.content ?? [];
  const active = all.filter((p) => p.status === "Active");
  const pending = all.filter((p) => p.status === "PendingApproval");
  const suspended = all.filter((p) => p.status === "Suspended");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">Platform-wide overview — Gene Pharmacy SaaS</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/users"><Users className="mr-2 h-4 w-4" />Manage Users</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/admin/pharmacies"><Building2 className="mr-2 h-4 w-4" />Manage Pharmacies</Link>
          </Button>
        </div>
      </div>

      {/* Pharmacy stats */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Pharmacies
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Pharmacies" value={all.length} icon={Building2} href="/admin/pharmacies" />
          <StatCard label="Active" value={active.length} icon={Activity} description="Operational" href="/admin/pharmacies" />
          <StatCard label="Pending Approval" value={pending.length} icon={Clock} description="Awaiting review" href="/admin/pharmacies" />
          <StatCard label="Suspended" value={suspended.length} icon={ShieldCheck} description="Requires attention" href="/admin/pharmacies" />
        </div>
      </div>

      {/* User stats */}
      {userStats && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" /> Platform Users
          </h2>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Total Users" value={userStats.total} icon={Users} href="/admin/users" />
            <StatCard label="Owners" value={userStats.owners} icon={Crown} href="/admin/users" />
            <StatCard label="Managers" value={userStats.managers} icon={Briefcase} href="/admin/users" />
            <StatCard label="Sellers" value={userStats.sellers} icon={Store} href="/admin/users" />
            <StatCard label="Enabled" value={userStats.enabled} icon={UserCheck} description="Active accounts" />
            <StatCard label="Disabled" value={userStats.disabled} icon={UserX} description="Blocked accounts" />
          </div>
        </div>
      )}

      {/* Subscription stats */}
      {subStats && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Subscriptions
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total" value={subStats.total} icon={CreditCard} href="/admin/subscriptions" />
            <StatCard label="Active" value={subStats.active} icon={TrendingUp} description="Currently billed" href="/admin/subscriptions" />
            <StatCard label="Expired" value={subStats.expired} icon={Clock} description="Needs renewal" href="/admin/subscriptions" />
            <StatCard label="Trial" value={subStats.trial} icon={ArrowRight} description="In trial period" href="/admin/subscriptions" />
          </div>
        </div>
      )}

      {/* Pharmacy list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Registered Pharmacies</CardTitle>
            <CardDescription>All pharmacies on the platform</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/pharmacies">View all <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {pharmaLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading pharmacies…</p>
          ) : all.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No pharmacies yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Pharmacies will appear here once owners register at{" "}
                <Link href="/register" className="text-primary underline underline-offset-2">/register</Link>.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">City</th>
                    <th className="pb-3 font-medium">Phone</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {all.slice(0, 10).map((p) => (
                    <tr key={p.id} className="hover:bg-muted/50 transition-colors">
                      <td className="py-3 font-medium">{p.name}</td>
                      <td className="py-3">{p.city}</td>
                      <td className="py-3">{p.phone}</td>
                      <td className="py-3">
                        <Badge variant={STATUS_VARIANT[p.status] ?? "outline"}>{p.status}</Badge>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {all.length > 10 && (
                <div className="mt-3 pt-3 border-t text-center">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/admin/pharmacies">View all {all.length} pharmacies <ArrowRight className="ml-1 h-4 w-4" /></Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
