"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  Gift,
  Loader2,
  Receipt,
  Smartphone,
  XCircle,
  Zap,
} from "lucide-react";
import { billingApi } from "@/api/billing.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addPeriod, monthlySaving, periodLabel, unitPrice } from "@/lib/billing";
import type {
  BillingOverview,
  BillingPeriodUnit,
  BillingPlan,
  PaymentStatus,
  SubscriptionPaymentResponse,
  SubscriptionResponse,
  SubscriptionStatus,
} from "@/types";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

/** How the owner is paying: a live mobile-money prompt (ClickPesa), or telling us about a payment already made. */
type PayMethod = "Prompt" | "MobileMoney" | "Cash";

const money = (value: string | number) => `TZS ${Number(value).toLocaleString()}`;
const longDate = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const RUNNING: SubscriptionStatus[] = ["Active", "Trial", "GracePeriod"];

const SUBSCRIPTION_BADGE: Record<SubscriptionStatus, "default" | "secondary" | "destructive" | "outline"> = {
  Trial: "outline",
  Active: "default",
  GracePeriod: "secondary",
  Expired: "destructive",
  Suspended: "destructive",
};

const SUBSCRIPTION_LABEL: Record<SubscriptionStatus, string> = {
  Trial: "Trial",
  Active: "Active",
  GracePeriod: "Grace period",
  Expired: "Expired",
  Suspended: "Suspended",
};

const PAYMENT_BADGE: Record<PaymentStatus, "default" | "secondary" | "destructive" | "outline"> = {
  Completed: "default",
  Pending: "secondary",
  Requested: "secondary",
  Failed: "destructive",
  Cancelled: "outline",
  Reversed: "outline",
  Rejected: "destructive",
};

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  Completed: "Paid",
  Pending: "Waiting for PIN",
  Requested: "Awaiting confirmation",
  Failed: "Failed",
  Cancelled: "Cancelled",
  Reversed: "Cancelled by Gene Pharmacy",
  Rejected: "Declined",
};

export default function BillingPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const qc = useQueryClient();
  const [trackedId, setTrackedId] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(0);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const { data: overview, isLoading } = useQuery({
    queryKey: ["billing", pharmacyId],
    queryFn: () => billingApi.overview(pharmacyId),
  });

  const { data: history } = useQuery({
    queryKey: ["billing", "payments", pharmacyId, historyPage],
    queryFn: () => billingApi.payments(pharmacyId, { page: historyPage, size: 10 }),
    placeholderData: (previous) => previous,
  });

  // Polls every 3s while the owner is entering their PIN; the server throttles calls to ClickPesa.
  const { data: tracked } = useQuery({
    queryKey: ["billing", "payment", pharmacyId, trackedId],
    queryFn: () => billingApi.payment(pharmacyId, trackedId!),
    enabled: !!trackedId,
    refetchInterval: (query) => (query.state.data && query.state.data.status !== "Pending" ? false : 3000),
  });

  // When the payment settles, refresh the subscription and the history.
  useEffect(() => {
    if (tracked && tracked.status !== "Pending") {
      qc.invalidateQueries({ queryKey: ["billing", pharmacyId] });
      qc.invalidateQueries({ queryKey: ["billing", "payments", pharmacyId] });
    }
  }, [tracked, qc, pharmacyId]);

  const subscription = overview?.subscription ?? null;
  const waiting = history?.content?.find((p) => p.status === "Requested") ?? null;
  const hasAccess = !!subscription?.accessGranted;
  // Without access there is nothing else to do on this page, so the checkout is always open.
  const showCheckout = !waiting && (!hasAccess || checkoutOpen);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Billing</h2>
        <p className="text-muted-foreground text-sm mt-1">Your Gene Pharmacy plan, renewals and payments.</p>
      </div>

      <StatusCard
        loading={isLoading}
        subscription={subscription}
        waiting={waiting}
        checkoutOpen={showCheckout}
        onToggleCheckout={hasAccess && !waiting ? () => setCheckoutOpen((o) => !o) : undefined}
      />

      {overview && showCheckout && (
        <Checkout
          pharmacyId={pharmacyId}
          overview={overview}
          onPromptSent={(payment) => {
            setTrackedId(payment.id);
            setCheckoutOpen(false);
          }}
          onRequestSent={() => setCheckoutOpen(false)}
        />
      )}

      <PaymentHistory
        history={history?.content}
        page={history ? { number: history.number, totalPages: history.totalPages, first: history.first, last: history.last } : null}
        onPage={(delta) => setHistoryPage((p) => p + delta)}
      />

      {/* Live status while the owner approves on their phone */}
      <Dialog open={!!trackedId} onOpenChange={(open) => !open && setTrackedId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {!tracked || tracked.status === "Pending"
                ? "Waiting for your approval…"
                : tracked.status === "Completed"
                  ? "Payment received"
                  : "Payment not completed"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 px-6 py-6 text-center">
            {!tracked || tracked.status === "Pending" ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  A prompt{tracked ? ` for ${money(tracked.amount)}` : ""} was sent to {tracked?.phoneNumber ?? "your phone"}. Enter your
                  mobile-money PIN to approve it.
                </p>
              </>
            ) : tracked.status === "Completed" ? (
              <>
                <CheckCircle2 className="h-10 w-10 text-green-600" />
                <p className="text-sm">
                  Thank you! Your {tracked.planType} plan is now active. {money(tracked.amount)} received via {tracked.channel ?? "mobile money"}.
                </p>
              </>
            ) : (
              <>
                <XCircle className="h-10 w-10 text-destructive" />
                <p className="text-sm text-muted-foreground">
                  {tracked.failureReason ?? "The payment was not approved. You have not been charged."}
                </p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrackedId(null)}>
              {tracked && tracked.status !== "Pending" ? "Close" : "Close (it will update in the list)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Current plan ─────────────────────────────────────────────────────────────

function StatusCard({
  loading,
  subscription,
  waiting,
  checkoutOpen,
  onToggleCheckout,
}: {
  loading: boolean;
  subscription: SubscriptionResponse | null;
  waiting: SubscriptionPaymentResponse | null;
  checkoutOpen: boolean;
  onToggleCheckout?: () => void;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const active = !!subscription?.accessGranted;
  const start = subscription?.startDate ? new Date(`${subscription.startDate}T00:00:00`) : null;
  const end = subscription?.endDate ? new Date(`${subscription.endDate}T00:00:00`) : null;
  const totalDays = start && end ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000)) : 0;
  const daysLeft = subscription?.daysRemaining ?? 0;
  const progress = totalDays ? Math.min(100, Math.max(0, (daysLeft / totalDays) * 100)) : 0;
  const lowOnDays = active && daysLeft <= 7;

  return (
    <Card className={active ? "" : "border-amber-300 dark:border-amber-800"}>
      <CardContent className="p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${active ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"}`}
            >
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              {subscription ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-bold">{subscription.planType} plan</h3>
                    <Badge variant={SUBSCRIPTION_BADGE[subscription.status]}>{SUBSCRIPTION_LABEL[subscription.status]}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {active && end
                      ? `Valid until ${longDate(end)}`
                      : end
                        ? `Ended on ${longDate(end)}. Renew to keep using Gene Pharmacy.`
                        : "Renew to keep using Gene Pharmacy."}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-bold">No active plan</h3>
                  <p className="text-sm text-muted-foreground mt-1">Choose a plan below to start using Gene Pharmacy.</p>
                </>
              )}
            </div>
          </div>

          {active && (
            <div className="md:w-72 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className={`text-3xl font-bold tabular-nums ${lowOnDays ? "text-amber-600" : ""}`}>{daysLeft}</span>
                <span className="text-sm text-muted-foreground">day{daysLeft === 1 ? "" : "s"} left</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${lowOnDays ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${progress}%` }} />
              </div>
              {lowOnDays && <p className="text-xs text-amber-600">Renew soon to avoid interruption.</p>}
            </div>
          )}
        </div>

        {waiting && (
          <div className="mt-6 flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium">Waiting for Gene Pharmacy to confirm your payment</p>
              <p className="text-muted-foreground">
                {waiting.planType} plan · {waiting.periodLabel} · {money(waiting.amount)} ({waiting.method === "Cash" ? "cash" : "mobile money"}).
                Your plan starts as soon as it is confirmed.
              </p>
            </div>
          </div>
        )}

        {onToggleCheckout && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-sm text-muted-foreground">Paying early never loses days: the new period starts when the current one ends.</p>
            <Button variant={checkoutOpen ? "outline" : "default"} onClick={onToggleCheckout}>
              {checkoutOpen ? "Close" : "Renew or change plan"}
              <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${checkoutOpen ? "rotate-180" : ""}`} />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Choose a plan and pay ────────────────────────────────────────────────────

function Checkout({
  pharmacyId,
  overview,
  onPromptSent,
  onRequestSent,
}: {
  pharmacyId: string;
  overview: BillingOverview;
  onPromptSent: (payment: SubscriptionPaymentResponse) => void;
  onRequestSent: () => void;
}) {
  const qc = useQueryClient();
  const plans = overview.plans;
  const subscription = overview.subscription;

  // Start on the plan they already have, so renewing is one click.
  const [planType, setPlanType] = useState<BillingPlan | "">(() => plans.find((p) => p.planType === subscription?.planType)?.planType ?? "");
  const [unit, setUnit] = useState<BillingPeriodUnit>("month");
  const [count, setCount] = useState(1);
  const [method, setMethod] = useState<PayMethod>(overview.paymentsEnabled ? "Prompt" : "MobileMoney");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [reference, setReference] = useState("");

  const selected = plans.find((p) => p.planType === (planType || plans[0]?.planType));
  const price = unitPrice(selected, unit);
  const total = price === null ? 0 : price * count;
  const saving = unit === "week" ? monthlySaving(selected) : 0;
  const sellableByWeek = plans.some((p) => unitPrice(p, "week") !== null);

  // Same rule as the server: a running plan is extended from its end date, a lapsed one starts today.
  const { from, until } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = subscription?.endDate ? new Date(`${subscription.endDate}T00:00:00`) : null;
    const running = !!subscription && RUNNING.includes(subscription.status) && !!end && end >= today;
    const start = running ? end! : today;
    return { from: start, until: addPeriod(start, unit, count) };
  }, [subscription, unit, count]);

  const errorMessage = (err: unknown, fallback: string) =>
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

  const prompt = useMutation({
    mutationFn: () => billingApi.pay(pharmacyId, { planType: selected!.planType, periodUnit: unit, periodCount: count, phoneNumber: phoneNumber.trim() }),
    onSuccess: (payment) => {
      qc.invalidateQueries({ queryKey: ["billing", "payments", pharmacyId] });
      onPromptSent(payment);
    },
    onError: (err) => toast.error(errorMessage(err, "Could not start the payment")),
  });

  const request = useMutation({
    mutationFn: () =>
      billingApi.request(pharmacyId, {
        planType: selected!.planType,
        periodUnit: unit,
        periodCount: count,
        method: method === "Cash" ? "Cash" : "MobileMoney",
        reference: reference.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Request sent. Gene Pharmacy will activate your plan once the payment is confirmed.");
      qc.invalidateQueries({ queryKey: ["billing", "payments", pharmacyId] });
      onRequestSent();
    },
    onError: (err) => toast.error(errorMessage(err, "Could not send the request")),
  });

  const busy = prompt.isPending || request.isPending;
  const canSubmit = !!selected && price !== null && !busy && (method !== "Prompt" || phoneNumber.trim().length > 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (method === "Prompt") prompt.mutate();
    else request.mutate();
  }

  if (plans.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No plans are on sale right now. Please contact Gene Pharmacy support.
        </CardContent>
      </Card>
    );
  }

  const methods: { value: PayMethod; title: string; hint: string; Icon: typeof Smartphone }[] = [
    ...(overview.paymentsEnabled
      ? [{ value: "Prompt" as const, title: "Pay now", hint: "Get a mobile-money prompt on your phone", Icon: Zap }]
      : []),
    { value: "MobileMoney", title: "I paid by mobile money", hint: "M-Pesa, Tigo Pesa, Airtel Money, Halopesa", Icon: Smartphone },
    { value: "Cash", title: "I paid cash", hint: "Paid in person to Gene Pharmacy", Icon: Banknote },
  ];

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
      <div className="space-y-6">
        {/* 1. Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <Step n={1} /> Choose a plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Plan">
              {plans.map((p) => {
                const each = unitPrice(p, unit);
                const isSelected = selected?.planType === p.planType;
                const isCurrent = subscription?.planType === p.planType && !!subscription?.accessGranted;
                return (
                  <button
                    key={p.planType}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={each === null}
                    onClick={() => setPlanType(p.planType)}
                    className={`relative rounded-lg border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted"}`}
                  >
                    <span className="flex items-center justify-between">
                      <span className="font-semibold">{p.planType}</span>
                      {isSelected ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        isCurrent && <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Current</span>
                      )}
                    </span>
                    <span className="mt-2 block text-2xl font-bold tabular-nums">{each === null ? "—" : money(each)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {each === null ? `Not sold by the ${unit}` : `per ${unit}`}
                    </span>
                    <span className="mt-2 block text-xs text-muted-foreground">
                      {p.maxUsers === null ? "Unlimited accounts" : `Up to ${p.maxUsers} accounts`} ·{" "}
                      {p.maxBranches === null ? "unlimited branches" : `${p.maxBranches} ${p.maxBranches === 1 ? "branch" : "branches"}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 2. Period */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <Step n={2} /> How long
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sellableByWeek && (
              <div className="inline-flex rounded-lg bg-muted p-1" role="radiogroup" aria-label="Billing period">
                {(["month", "week"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    role="radio"
                    aria-checked={unit === u}
                    onClick={() => {
                      setUnit(u);
                      setCount(1);
                    }}
                    className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${unit === u ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {u === "month" ? "Monthly" : "Weekly"}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={unit === "week" ? "Number of weeks" : "Number of months"}>
              {overview.durations[unit].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={count === n}
                  onClick={() => setCount(n)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${count === n ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  {periodLabel(unit, n)}
                </button>
              ))}
            </div>
            {saving > 0 && (
              <p className="text-xs text-muted-foreground">Tip: paying monthly for {selected?.planType} saves {money(saving)} compared with four weeks.</p>
            )}
          </CardContent>
        </Card>

        {/* 3. Payment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <Step n={3} /> Payment
            </CardTitle>
            {!overview.paymentsEnabled && (
              <CardDescription>
                Pay Gene Pharmacy by mobile money or cash, then tell us here. Your plan starts once we confirm the money.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`grid gap-3 ${methods.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`} role="radiogroup" aria-label="Payment method">
              {methods.map(({ value, title, hint, Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={method === value}
                  onClick={() => setMethod(value)}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors ${method === value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted"}`}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Icon className="h-4 w-4" /> {title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
                </button>
              ))}
            </div>

            {method === "Prompt" ? (
              <div className="space-y-1 max-w-sm">
                <Label htmlFor="b-phone">Mobile number to pay from *</Label>
                <Input
                  id="b-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="0712 345 678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">The network is detected from the number.</p>
              </div>
            ) : (
              <div className="space-y-1 max-w-sm">
                <Label htmlFor="b-ref">{method === "Cash" ? "Receipt number" : "Transaction ID"} (optional)</Label>
                <Input
                  id="b-ref"
                  placeholder={method === "Cash" ? "e.g. R-0123" : "e.g. the M-Pesa confirmation code"}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">It helps us find your payment quickly.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card className="lg:sticky lg:top-4">
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Plan" value={selected?.planType ?? "—"} />
          <Row label="Length" value={periodLabel(unit, count)} />
          <Row label="Price" value={price === null ? "—" : `${money(price)} / ${unit}`} />
          <div className="flex items-start gap-2 rounded-md bg-muted/60 p-3 text-xs">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              Active from <strong>{longDate(from)}</strong> to <strong>{longDate(until)}</strong>
            </span>
          </div>
          <div className="flex items-baseline justify-between border-t pt-3">
            <span className="text-muted-foreground">Total</span>
            <span className="text-2xl font-bold tabular-nums">{money(total)}</span>
          </div>
          <Button type="submit" className="w-full" disabled={!canSubmit}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : method === "Prompt" ? "Pay with mobile money" : "Send to Gene Pharmacy"}
          </Button>
          {method !== "Prompt" && (
            <p className="text-xs text-muted-foreground text-center">Gene Pharmacy confirms the payment, usually the same day.</p>
          )}
        </CardContent>
      </Card>
    </form>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
      {n}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// ─── History ──────────────────────────────────────────────────────────────────

function MethodLabel({ payment }: { payment: SubscriptionPaymentResponse }) {
  const [Icon, label] =
    payment.method === "Cash"
      ? [Banknote, "Cash"]
      : payment.method === "Promotion"
        ? [Gift, "Promotion"]
        : [Smartphone, payment.channel ?? "Mobile money"];
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" /> {label}
    </span>
  );
}

function PaymentHistory({
  history,
  page,
  onPage,
}: {
  history: SubscriptionPaymentResponse[] | undefined;
  page: { number: number; totalPages: number; first: boolean; last: boolean } | null;
  onPage: (delta: number) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="h-4 w-4" /> Payment history
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {history && history.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No payments yet</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Date</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history?.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="pl-6 whitespace-nowrap">{longDate(new Date(p.createdAt))}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="font-medium">{p.planType}</span>
                      <span className="text-muted-foreground"> · {p.periodLabel}</span>
                    </TableCell>
                    <TableCell>
                      <MethodLabel payment={p} />
                      {p.externalReference && <span className="block font-mono text-xs text-muted-foreground">{p.externalReference}</span>}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums whitespace-nowrap">
                      {p.method === "Promotion" ? "Free" : money(p.amount)}
                    </TableCell>
                    <TableCell className="pr-6">
                      <Badge variant={PAYMENT_BADGE[p.status]}>{PAYMENT_LABEL[p.status]}</Badge>
                      {(p.status === "Rejected" || p.status === "Failed") && p.failureReason && (
                        <span className="mt-1 block text-xs text-destructive">{p.failureReason}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {page && page.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-6 py-3">
            <p className="text-sm text-muted-foreground">
              Page {page.number + 1} of {page.totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page.first} onClick={() => onPage(-1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page.last} onClick={() => onPage(1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
