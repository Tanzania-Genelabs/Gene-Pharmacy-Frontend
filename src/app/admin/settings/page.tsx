"use client";

import { useQuery } from "@tanstack/react-query";
import { adminSystemApi } from "@/api/admin.api";
import { timeAgo } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertOctagon,
  AlertTriangle,
  Building2,
  CheckCircle,
  CreditCard,
  Info,
  Loader2,
  RefreshCw,
  Server,
  Settings,
  Users,
  XCircle,
} from "lucide-react";
import type { SystemStatus, SystemWarningLevel } from "@/types";

type Health = "ok" | "warn" | "bad";

const WARNING_STYLE: Record<SystemWarningLevel, { icon: typeof Info; className: string; label: string }> = {
  critical: { icon: AlertOctagon, className: "text-red-600 dark:text-red-400", label: "Critical" },
  warning: { icon: AlertTriangle, className: "text-yellow-600 dark:text-yellow-400", label: "Warning" },
  info: { icon: Info, className: "text-blue-600 dark:text-blue-400", label: "Note" },
};

const sum = (counts: Record<string, number> | undefined) => Object.values(counts ?? {}).reduce((a, b) => a + b, 0);

export default function AdminSettingsPage() {
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["admin", "system-status"],
    queryFn: () => adminSystemApi.status(),
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Live platform status. Everything here is measured by the server when you open the page
            {data ? ` (checked ${timeAgo(data.checkedAt)})` : ""}.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Check again
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            Could not read the platform status. If the API itself is down, that is the answer.
          </CardContent>
        </Card>
      )}

      {data && <Status data={data} />}
    </div>
  );
}

function Status({ data }: { data: SystemStatus }) {
  const { application: app, database, migrations, cache, scheduler, backups, payments, errorTracking, authentication, platform } = data;

  const pharmacyTotal = sum(platform?.pharmacies);
  const subscriptionsWithAccess =
    (platform?.subscriptions.Active ?? 0) + (platform?.subscriptions.Trial ?? 0) + (platform?.subscriptions.GracePeriod ?? 0);

  return (
    <>
      {/* Things to act on */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Needs attention
          </CardTitle>
          <CardDescription>
            {data.warnings.length === 0 ? "Nothing needs your attention." : "Problems and gaps found on this server, most serious first."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.warnings.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4" /> Every check passed.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.warnings.map((warning, i) => {
                const style = WARNING_STYLE[warning.level];
                const Icon = style.icon;
                return (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${style.className}`} />
                    <span>
                      <span className={`font-medium ${style.className}`}>{style.label}: </span>
                      {warning.message}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            System health
          </CardTitle>
          <CardDescription>What is running right now</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-8 md:grid-cols-2">
            <Row
              label="API server"
              value={`Laravel ${app.laravel} · PHP ${app.php} · ${app.environment}${app.debug ? " · debug ON" : ""}`}
              health={app.debug && app.environment === "production" ? "bad" : "ok"}
            />
            <Row
              label="Database"
              value={database.reachable ? `${database.version} · ${database.latencyMs} ms` : "Not reachable"}
              health={database.reachable ? "ok" : "bad"}
            />
            <Row
              label="Migrations"
              value={
                migrations.applied === null
                  ? "Unknown"
                  : `${migrations.applied} applied, ${migrations.pending} pending`
              }
              health={migrations.pending ? "bad" : "ok"}
            />
            <Row
              label="Cache"
              value={`${cache.store}${cache.working ? "" : " (not working)"}`}
              health={cache.working ? "ok" : "bad"}
            />
            <Row
              label="Scheduler"
              value={scheduler.running ? `Running · last tick ${timeAgo(scheduler.lastRunAt)}` : scheduler.lastRunAt ? `Stopped · last tick ${timeAgo(scheduler.lastRunAt)}` : "Never ran"}
              health={scheduler.running ? "ok" : "warn"}
            />
            <Row
              label="Backups"
              value={
                backups.latestAt
                  ? `Latest ${timeAgo(backups.latestAt)} (${backups.latestSizeKb} KB) · ${backups.count} kept · ${backups.offServerCopy ? "copied off-server" : "this server only"}`
                  : "None found"
              }
              health={backups.latestAt && backups.offServerCopy ? "ok" : "warn"}
            />
            <Row
              label={`Payments (${payments.gateway})`}
              value={
                payments.configured
                  ? `Configured${payments.checksumEnabled ? " · signed" : ""} · ${payments.pendingCount ?? 0} waiting`
                  : "Not configured"
              }
              health={payments.configured ? "ok" : "warn"}
            />
            <Row
              label="Error tracking"
              value={errorTracking.configured ? "Sentry connected" : "Off"}
              health={errorTracking.configured ? "ok" : "warn"}
            />
            <Row
              label="Sign-in"
              value={`Signed tokens · access ${authentication.accessTokenMinutes} min · refresh ${authentication.refreshTokenDays} days, rotating`}
              health="ok"
            />
          </div>
          {payments.configured && (
            <p className="mt-4 text-xs text-muted-foreground">
              ClickPesa webhook address: <span className="font-mono">{payments.webhookUrl}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Platform summary */}
      {platform && (
        <div className="grid gap-4 md:grid-cols-3">
          <Summary
            title="Pharmacies"
            icon={Building2}
            value={pharmacyTotal}
            detail={Object.entries(platform.pharmacies).map(([status, n]) => `${n} ${status}`).join(" · ") || "None yet"}
          />
          <Summary
            title="Users"
            icon={Users}
            value={platform.users.total}
            detail={`${platform.users.enabled} enabled, ${platform.users.disabled} disabled`}
          />
          <Summary
            title="Subscriptions with access"
            icon={CreditCard}
            value={subscriptionsWithAccess}
            detail={`${platform.subscriptions.Expired ?? 0} expired, ${platform.subscriptions.Suspended ?? 0} suspended`}
          />
        </div>
      )}

      {/* Facts about how the platform is built */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            How the platform is set up
          </CardTitle>
          <CardDescription>
            Plan prices are edited under Plans &amp; Pricing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Fact label="Pharmacy separation" value="One shared database. Every record carries its pharmacy, and every request is checked against the signed-in user's pharmacy." />
          <Fact label="Roles" value="SuperAdmin → Owner → Manager → Seller" />
          <Fact
            label="Subscription plans"
            value={
              platform
                ? ["Trial", ...platform.plans.map((p) => (p.active ? p.planType : `${p.planType} (off)`))].join(", ")
                : "—"
            }
          />
          <Fact label="API version" value="/api/v1" />
          <Fact label="Time zone" value={app.timezone} />
          <Fact label="Public address" value={`${app.url}${data.security.https ? "" : " (not https)"}`} />
        </CardContent>
      </Card>
    </>
  );
}

function Row({ label, value, health }: { label: string; value: string; health: Health }) {
  const Icon = health === "ok" ? CheckCircle : health === "warn" ? AlertTriangle : XCircle;
  const color = health === "ok" ? "text-green-500" : health === "warn" ? "text-yellow-500" : "text-red-500";

  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b last:border-0">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-start gap-2 text-right">
        <span className="text-sm text-muted-foreground">{value}</span>
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-6 py-2 border-b last:border-0">
      <span className="text-sm font-medium shrink-0">{label}</span>
      <span className="text-sm text-muted-foreground text-right">{value}</span>
    </div>
  );
}

function Summary({
  title,
  icon: Icon,
  value,
  detail,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{detail}</p>
      </CardContent>
    </Card>
  );
}
