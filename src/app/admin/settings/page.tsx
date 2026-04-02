"use client";

import { useQuery } from "@tanstack/react-query";
import {
  adminUserApi,
  adminSubscriptionApi,
} from "@/api/admin.api";
import { pharmacyApi } from "@/api/pharmacy.api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Settings,
  Server,
  Database,
  Users,
  Building2,
  CreditCard,
  CheckCircle,
} from "lucide-react";

export default function AdminSettingsPage() {
  const { data: userStats } = useQuery({
    queryKey: ["admin", "settings", "user-stats"],
    queryFn: () => adminUserApi.stats(),
  });

  const { data: subStats } = useQuery({
    queryKey: ["admin", "settings", "sub-stats"],
    queryFn: () => adminSubscriptionApi.stats(),
  });

  const { data: pharmacies } = useQuery({
    queryKey: ["admin", "settings", "pharmacies"],
    queryFn: () => pharmacyApi.list({ size: 1 }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Platform overview and system health
        </p>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            System Health
          </CardTitle>
          <CardDescription>
            Current platform status and configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <HealthItem
              label="API Server"
              value="Running"
              status="healthy"
            />
            <HealthItem
              label="Database"
              value="PostgreSQL 15"
              status="healthy"
            />
            <HealthItem
              label="Cache"
              value="Redis 7"
              status="healthy"
            />
            <HealthItem
              label="Authentication"
              value="JWT (Stateless)"
              status="healthy"
            />
          </div>
        </CardContent>
      </Card>

      {/* Platform Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Pharmacies
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pharmacies?.totalElements ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Registered on the platform
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Users
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {userStats?.total ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {userStats?.enabled ?? 0} enabled, {userStats?.disabled ?? 0}{" "}
              disabled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Subscriptions
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {subStats
                ? subStats.active + subStats.trial + subStats.gracePeriod
                : 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {subStats?.expired ?? 0} expired, {subStats?.suspended ?? 0}{" "}
              suspended
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Platform Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Platform Configuration
          </CardTitle>
          <CardDescription>
            Core settings for the Gene Pharmacy SaaS platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <ConfigItem
              label="Multi-Tenancy"
              value="PostgreSQL Schema Isolation"
            />
            <ConfigItem label="Authentication" value="JWT + Spring Security 7" />
            <ConfigItem
              label="RBAC Roles"
              value="SuperAdmin → Owner → Manager → Seller"
            />
            <ConfigItem
              label="Subscription Plans"
              value="Trial, Basic, Standard, Premium"
            />
            <ConfigItem label="API Versioning" value="/api/v1/" />
            <ConfigItem label="Database Migrations" value="Flyway (Liquibase)" />
            <ConfigItem label="Caching" value="Redis (5-min TTL)" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HealthItem({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: "healthy" | "degraded" | "down";
}) {
  const color =
    status === "healthy"
      ? "text-green-500"
      : status === "degraded"
        ? "text-yellow-500"
        : "text-red-500";

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{value}</span>
        <CheckCircle className={`h-4 w-4 ${color}`} />
      </div>
    </div>
  );
}

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <span className="text-sm font-medium">{label}</span>
      <span className="text-sm text-muted-foreground">{value}</span>
    </div>
  );
}
