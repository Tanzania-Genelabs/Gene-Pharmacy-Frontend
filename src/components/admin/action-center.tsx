import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, CreditCard, Pause, ShieldAlert, Building2, ServerCrash } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { timeAgo } from "@/lib/audit";
import type { AdminActions } from "@/types";

const tzs = (value: string | number) => `TSh ${Math.round(Number(value)).toLocaleString()}`;

function Section({
  icon: Icon,
  title,
  count,
  href,
  tone = "amber",
  children,
}: {
  icon: typeof Clock;
  title: string;
  count: number;
  href: string;
  tone?: "amber" | "red" | "blue";
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  const color = tone === "red" ? "text-red-600 dark:text-red-400" : tone === "blue" ? "text-blue-600 dark:text-blue-400" : "text-amber-600 dark:text-amber-400";
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Icon className={`h-4 w-4 ${color}`} /> {title} <span className={`rounded-full bg-muted px-2 text-xs ${color}`}>{count}</span>
        </p>
        <Link href={href} className="text-xs font-medium text-primary underline-offset-2 hover:underline">Handle</Link>
      </div>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">{children}</ul>
    </div>
  );
}

/** Everything that is waiting for a decision, with a link to where it is handled. */
export function ActionCenter({ actions }: { actions: AdminActions }) {
  const a = actions;
  const total =
    a.pendingPharmacies.count + a.paymentRequests.count + a.expiringSubscriptions.count + a.endedSubscriptions.count + a.suspendedPharmacies.count + a.systemProblems.count;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {total === 0 ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}
          {total === 0 ? "Nothing is waiting for you" : "Needs your decision"}
        </CardTitle>
        <CardDescription>{total === 0 ? "No requests, expiring plans or system problems right now." : "Open each group to act on it. Every action is recorded in the audit log."}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 lg:grid-cols-2">
        {a.security.twoFactorEnabled === false && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 lg:col-span-2">
            <p className="flex items-center gap-2 text-sm font-semibold"><ShieldAlert className="h-4 w-4 text-red-600" /> Your admin account has no two-factor sign-in</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This account can reach every pharmacy. <Link href="/admin/settings" className="font-medium text-primary underline-offset-2 hover:underline">Turn on two-factor</Link>.
            </p>
          </div>
        )}

        <Section icon={Clock} title="Pharmacies waiting for approval" count={a.pendingPharmacies.count} href="/admin/pharmacies?status=PendingApproval">
          {a.pendingPharmacies.items.map((p) => (
            <li key={p.pharmacyId}><Link href={`/admin/pharmacies/${p.pharmacyId}`} className="font-medium text-foreground hover:underline">{p.name}</Link> · {p.city ?? "-"} · registered {timeAgo(p.since)}</li>
          ))}
        </Section>

        <Section icon={CreditCard} title="Payment requests to confirm" count={a.paymentRequests.count} href="/admin/payments">
          {a.paymentRequests.items.map((r) => (
            <li key={r.paymentId}><Link href={`/admin/pharmacies/${r.pharmacyId}`} className="font-medium text-foreground hover:underline">{r.name}</Link> · {r.planType ?? "-"} · {tzs(r.amount)} · asked {timeAgo(r.since)}</li>
          ))}
        </Section>

        <Section icon={Clock} title="Plans ending within 7 days" count={a.expiringSubscriptions.count} href="/admin/subscriptions">
          {a.expiringSubscriptions.items.map((p) => (
            <li key={p.pharmacyId}><Link href={`/admin/pharmacies/${p.pharmacyId}`} className="font-medium text-foreground hover:underline">{p.name}</Link> · {p.plan} · {p.detail}</li>
          ))}
        </Section>

        <Section icon={CreditCard} title="Active pharmacies with no running plan" count={a.endedSubscriptions.count} href="/admin/subscriptions" tone="red">
          {a.endedSubscriptions.items.map((p) => (
            <li key={p.pharmacyId}><Link href={`/admin/pharmacies/${p.pharmacyId}`} className="font-medium text-foreground hover:underline">{p.name}</Link> · {p.detail}</li>
          ))}
        </Section>

        <Section icon={Pause} title="Suspended pharmacies" count={a.suspendedPharmacies.count} href="/admin/pharmacies?status=Suspended" tone="blue">
          {a.suspendedPharmacies.items.map((p) => (
            <li key={p.pharmacyId}><Link href={`/admin/pharmacies/${p.pharmacyId}`} className="font-medium text-foreground hover:underline">{p.name}</Link> · {p.city ?? "-"}</li>
          ))}
        </Section>

        <Section icon={ServerCrash} title="System problems" count={a.systemProblems.count} href="/admin/settings" tone="red">
          {a.systemProblems.items.map((w, i) => (
            <li key={i}><span className="font-medium uppercase text-foreground">{w.level}</span> · {w.message}</li>
          ))}
        </Section>

        {a.security.recentEvents.length > 0 && (
          <div className="rounded-lg border p-3 lg:col-span-2">
            <p className="flex items-center gap-2 text-sm font-semibold"><Building2 className="h-4 w-4 text-blue-600" /> Recent security events on admin accounts</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {a.security.recentEvents.map((e) => (
                <li key={e.id}>{timeAgo(e.createdAt)} · {e.description}{e.ipAddress ? ` · ${e.ipAddress}` : ""}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
