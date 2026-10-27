"use client";

import { use, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, CheckCircle2, Clock, CreditCard, Loader2, Smartphone, XCircle } from "lucide-react";
import { billingApi } from "@/api/billing.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { monthlySaving, periodLabel, unitPrice } from "@/lib/billing";
import type { BillingOverview, BillingPeriodUnit, BillingPlan, PaymentStatus, SubscriptionStatus } from "@/types";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

const money = (value: string | number) => `TZS ${Number(value).toLocaleString()}`;

const SUBSCRIPTION_BADGE: Record<SubscriptionStatus, "default" | "secondary" | "destructive" | "outline"> = {
  Trial: "outline",
  Active: "default",
  GracePeriod: "secondary",
  Expired: "destructive",
  Suspended: "destructive",
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

const PAYMENT_LABEL: Partial<Record<PaymentStatus, string>> = {
  Requested: "Awaiting confirmation",
  Rejected: "Declined",
};

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

export default function BillingPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const qc = useQueryClient();

  const [planType, setPlanType] = useState<BillingPlan | "">("");
  const [unit, setUnit] = useState<BillingPeriodUnit>("month");
  const [count, setCount] = useState(1);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [trackedId, setTrackedId] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(0);

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

  const plans = overview?.plans ?? [];
  const selectedPlan = plans.find((p) => p.planType === (planType || plans[0]?.planType));
  // The price of one week/month of the chosen plan; null when the plan isn't sold that way.
  const price = unitPrice(selectedPlan, unit);
  const total = price === null ? 0 : price * count;
  const saving = unit === "week" ? monthlySaving(selectedPlan) : 0;
  const sellableByWeek = plans.some((p) => unitPrice(p, "week") !== null);

  function chooseUnit(next: BillingPeriodUnit) {
    setUnit(next);
    setCount(1);
  }

  const payMutation = useMutation({
    mutationFn: () =>
      billingApi.pay(pharmacyId, { planType: selectedPlan!.planType, periodUnit: unit, periodCount: count, phoneNumber }),
    onSuccess: (payment) => {
      setTrackedId(payment.id);
      qc.invalidateQueries({ queryKey: ["billing", "payments", pharmacyId] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Could not start the payment");
    },
  });

  function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlan || price === null) return;
    if (!phoneNumber.trim()) {
      toast.error("Enter the mobile number to pay from");
      return;
    }
    payMutation.mutate();
  }

  const subscription = overview?.subscription ?? null;
  const waitingRequest = history?.content?.find((p) => p.status === "Requested") ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Billing</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Your Gene Pharmacy subscription. Choose a plan and pay by mobile money or cash.
        </p>
      </div>

      {/* Current subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" /> Current subscription
          </CardTitle>
          <CardDescription>
            {isLoading ? "Loading…" : subscription ? "Paying early never loses days: the new period is added after the current one." : "No subscription yet."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subscription && (
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Plan</p>
                <p className="font-semibold">{subscription.planType}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant={SUBSCRIPTION_BADGE[subscription.status]}>{subscription.status}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valid until</p>
                <p className="font-semibold">{subscription.endDate}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Days left</p>
                <p className="font-semibold">{subscription.daysRemaining ?? "—"}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pay */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pay or renew</CardTitle>
          <CardDescription>
            {overview?.paymentsEnabled
              ? "You will get a prompt on your phone; enter your mobile-money PIN to approve it."
              : "Pick a plan, tell us how you paid, and Gene Pharmacy will activate it once the money is confirmed."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!overview?.paymentsEnabled ? (
            overview ? (
              <RequestPlanForm pharmacyId={pharmacyId} overview={overview} waiting={waitingRequest} />
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )
          ) : (
            <form onSubmit={handlePay} className="grid gap-4 sm:grid-cols-2 max-w-2xl">
              <div className="space-y-1 sm:col-span-2">
                <Label>How would you like to pay?</Label>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Billing period">
                  {(["week", "month"] as const).map((option) => {
                    const available = option === "month" || sellableByWeek;
                    return (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={unit === option}
                        disabled={!available}
                        onClick={() => chooseUnit(option)}
                        className={`rounded-md border p-3 text-left text-sm transition-colors disabled:opacity-50 ${unit === option ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
                      >
                        <span className="block font-medium">{option === "week" ? "Weekly" : "Monthly"}</span>
                        <span className="block text-xs text-muted-foreground">
                          {option === "week" ? "Smaller payments, more often" : "One payment, best value"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="b-plan">Plan</Label>
                <select
                  id="b-plan"
                  className={selectClass}
                  value={selectedPlan?.planType ?? ""}
                  onChange={(e) => setPlanType(e.target.value as BillingPlan)}
                >
                  {plans.map((p) => {
                    const each = unitPrice(p, unit);
                    return (
                      <option key={p.planType} value={p.planType} disabled={each === null}>
                        {p.planType} — {each === null ? `not sold by the ${unit}` : `${money(each)} / ${unit}`}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="b-count">{unit === "week" ? "How many weeks" : "How many months"}</Label>
                <select
                  id="b-count"
                  className={selectClass}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                >
                  {overview.durations[unit].map((n) => (
                    <option key={n} value={n}>
                      {periodLabel(unit, n)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="b-phone">Mobile number to pay from *</Label>
                <Input
                  id="b-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="0712 345 678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  M-Pesa, Tigo Pesa, Airtel Money and Halopesa are supported; the network is detected from the number.
                </p>
              </div>
              <div className="sm:col-span-2 flex items-center justify-between border-t pt-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total for {periodLabel(unit, count)}</p>
                  <p className="text-xl font-bold">{money(total)}</p>
                  {saving > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Tip: a month of this plan costs {money(saving)} less than four weeks.
                    </p>
                  )}
                </div>
                <Button type="submit" disabled={payMutation.isPending || !selectedPlan || price === null}>
                  {payMutation.isPending ? "Sending prompt…" : "Pay with mobile money"}
                </Button>
              </div>
            </form>
          )}
          {overview?.paymentsEnabled && overview && (
            <div className="mt-6 border-t pt-6">
              <p className="font-medium text-sm">Paid another way, or paying cash?</p>
              <p className="text-xs text-muted-foreground mb-4">Tell Gene Pharmacy which plan you paid for and we will activate it once we confirm the money.</p>
              <RequestPlanForm pharmacyId={pharmacyId} overview={overview} waiting={waitingRequest} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Paid by</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history?.content?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {p.planType} · {p.periodLabel}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{p.method === "Promotion" ? "Free" : money(p.amount)}</TableCell>
                  <TableCell>
                    {p.method === "Cash" ? "Cash" : p.method === "Promotion" ? "Promotion" : p.channel ?? "Mobile money"}
                    {p.status === "Rejected" && p.failureReason && (
                      <span className="block text-xs text-destructive">{p.failureReason}</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.internalReference}</TableCell>
                  <TableCell>
                    <Badge variant={PAYMENT_BADGE[p.status]}>{PAYMENT_LABEL[p.status] ?? p.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {history && history.content.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No payments yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {history && history.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {history.number + 1} of {history.totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={history.first} onClick={() => setHistoryPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={history.last} onClick={() => setHistoryPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

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
                  A prompt for {money(tracked?.amount ?? total)} was sent to {tracked?.phoneNumber ?? "your phone"}.
                  Enter your mobile-money PIN to approve it.
                </p>
              </>
            ) : tracked.status === "Completed" ? (
              <>
                <CheckCircle2 className="h-10 w-10 text-green-600" />
                <p className="text-sm">
                  Thank you! Your {tracked.planType} plan is now active. {money(tracked.amount)} received via{" "}
                  {tracked.channel ?? "mobile money"}.
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

/**
 * "I want this plan and I paid by mobile money / cash." Nothing is activated until a Gene Pharmacy admin
 * confirms the money arrived.
 */
function RequestPlanForm({
  pharmacyId,
  overview,
  waiting,
}: {
  pharmacyId: string;
  overview: BillingOverview;
  waiting: { planType: BillingPlan | null; periodLabel: string; amount: string; method: string | null } | null;
}) {
  const qc = useQueryClient();
  const plans = overview.plans;
  const [planType, setPlanType] = useState<BillingPlan | "">("");
  const [unit, setUnit] = useState<BillingPeriodUnit>("month");
  const [count, setCount] = useState(1);
  const [method, setMethod] = useState<"MobileMoney" | "Cash">("MobileMoney");
  const [reference, setReference] = useState("");

  const selected = plans.find((p) => p.planType === (planType || plans[0]?.planType));
  const price = unitPrice(selected, unit);
  const total = price === null ? 0 : price * count;
  const sellableByWeek = plans.some((p) => unitPrice(p, "week") !== null);

  const send = useMutation({
    mutationFn: () =>
      billingApi.request(pharmacyId, {
        planType: selected!.planType,
        periodUnit: unit,
        periodCount: count,
        method,
        reference: reference.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Request sent. Gene Pharmacy will activate your plan once the payment is confirmed.");
      setReference("");
      qc.invalidateQueries({ queryKey: ["billing", "payments", pharmacyId] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Could not send the request");
    },
  });

  if (waiting) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30 max-w-2xl">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div>
          <p className="font-medium">Waiting for Gene Pharmacy to confirm your payment</p>
          <p className="text-muted-foreground">
            {waiting.planType} plan · {waiting.periodLabel} · {money(waiting.amount)} ({waiting.method === "Cash" ? "cash" : "mobile money"}).
            Your access starts as soon as it is confirmed.
          </p>
        </div>
      </div>
    );
  }

  if (plans.length === 0) {
    return <p className="text-sm text-muted-foreground">No plans are on sale right now. Please contact Gene Pharmacy support.</p>;
  }

  return (
    <form
      className="space-y-5 max-w-2xl"
      onSubmit={(e) => {
        e.preventDefault();
        if (selected && price !== null) send.mutate();
      }}
    >
      <div className="space-y-2">
        <Label>1. Choose a plan</Label>
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Plan">
          {plans.map((p) => {
            const weekly = unitPrice(p, "week");
            const monthly = unitPrice(p, "month");
            const isSelected = selected?.planType === p.planType;
            return (
              <button
                key={p.planType}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setPlanType(p.planType)}
                className={`rounded-md border p-3 text-left transition-colors ${isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted"}`}
              >
                <span className="flex items-center justify-between font-medium">
                  {p.planType}
                  {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </span>
                {monthly !== null && (
                  <span className="block text-lg font-bold">
                    {money(monthly)}
                    <span className="text-xs font-normal text-muted-foreground"> / month</span>
                  </span>
                )}
                {weekly !== null && <span className="block text-xs text-muted-foreground">or {money(weekly)} / week</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="r-unit">2. For how long</Label>
          <select
            id="r-unit"
            className={selectClass}
            value={unit}
            onChange={(e) => {
              setUnit(e.target.value as BillingPeriodUnit);
              setCount(1);
            }}
          >
            <option value="month">By the month</option>
            {sellableByWeek && <option value="week">By the week</option>}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="r-count">{unit === "week" ? "How many weeks" : "How many months"}</Label>
          <select id="r-count" className={selectClass} value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {overview.durations[unit].map((n) => (
              <option key={n} value={n}>
                {periodLabel(unit, n)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {price === null && <p className="text-sm text-destructive">The {selected?.planType} plan is not sold by the {unit}.</p>}

      <div className="space-y-2">
        <Label>3. How did you pay?</Label>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment method">
          {(
            [
              { value: "MobileMoney", label: "Mobile money / payment gateway", hint: "M-Pesa, Tigo Pesa, Airtel Money, Halopesa", Icon: Smartphone },
              { value: "Cash", label: "Cash", hint: "Paid in person to Gene Pharmacy", Icon: Banknote },
            ] as const
          ).map(({ value, label, hint, Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={method === value}
              onClick={() => setMethod(value)}
              className={`rounded-md border p-3 text-left text-sm transition-colors ${method === value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted"}`}
            >
              <span className="flex items-center gap-2 font-medium">
                <Icon className="h-4 w-4" /> {label}
              </span>
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="r-ref">{method === "Cash" ? "Receipt number (optional)" : "Transaction ID / reference (optional)"}</Label>
        <Input
          id="r-ref"
          placeholder={method === "Cash" ? "e.g. R-0123" : "e.g. the M-Pesa confirmation code"}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          maxLength={100}
        />
        <p className="text-xs text-muted-foreground">It helps us find your payment quickly.</p>
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <div>
          <p className="text-xs text-muted-foreground">Total for {periodLabel(unit, count)}</p>
          <p className="text-xl font-bold">{money(total)}</p>
        </div>
        <Button type="submit" disabled={send.isPending || !selected || price === null}>
          {send.isPending ? "Sending…" : "Send request to Gene Pharmacy"}
        </Button>
      </div>
    </form>
  );
}
