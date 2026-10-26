"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, CreditCard, Loader2, XCircle } from "lucide-react";
import { billingApi } from "@/api/billing.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BillingPlan, PaymentStatus, SubscriptionStatus } from "@/types";

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
  Failed: "destructive",
  Cancelled: "outline",
  Reversed: "outline",
};

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

export default function BillingPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const qc = useQueryClient();

  const [planType, setPlanType] = useState<BillingPlan | "">("");
  const [months, setMonths] = useState(1);
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
  const total = useMemo(
    () => (selectedPlan ? Number(selectedPlan.monthlyPrice) * months : 0),
    [selectedPlan, months],
  );

  const payMutation = useMutation({
    mutationFn: () =>
      billingApi.pay(pharmacyId, { planType: selectedPlan!.planType, months, phoneNumber }),
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
    if (!selectedPlan) return;
    if (!phoneNumber.trim()) {
      toast.error("Enter the mobile number to pay from");
      return;
    }
    payMutation.mutate();
  }

  const subscription = overview?.subscription ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Billing</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Your Gene Pharmacy subscription, paid with mobile money.
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
            You will get a prompt on your phone; enter your mobile-money PIN to approve it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!overview?.paymentsEnabled ? (
            <p className="text-sm text-muted-foreground">
              Online payment is not available yet. Please contact Gene Pharmacy support to renew.
            </p>
          ) : (
            <form onSubmit={handlePay} className="grid gap-4 sm:grid-cols-2 max-w-2xl">
              <div className="space-y-1">
                <Label htmlFor="b-plan">Plan</Label>
                <select
                  id="b-plan"
                  className={selectClass}
                  value={selectedPlan?.planType ?? ""}
                  onChange={(e) => setPlanType(e.target.value as BillingPlan)}
                >
                  {plans.map((p) => (
                    <option key={p.planType} value={p.planType}>
                      {p.planType} — {money(p.monthlyPrice)} / month
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="b-months">Length</Label>
                <select
                  id="b-months"
                  className={selectClass}
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                >
                  {overview.durations.map((m) => (
                    <option key={m} value={m}>
                      {m} {m === 1 ? "month" : "months"}
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
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-xl font-bold">{money(total)}</p>
                </div>
                <Button type="submit" disabled={payMutation.isPending || !selectedPlan}>
                  {payMutation.isPending ? "Sending prompt…" : "Pay with mobile money"}
                </Button>
              </div>
            </form>
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
                <TableHead>Network</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history?.content?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {p.planType} · {p.months} {p.months === 1 ? "month" : "months"}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{money(p.amount)}</TableCell>
                  <TableCell>{p.channel ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{p.internalReference}</TableCell>
                  <TableCell>
                    <Badge variant={PAYMENT_BADGE[p.status]}>{p.status}</Badge>
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
