"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, Check, Gift, Inbox, Loader2, Search, Smartphone, Wallet, X } from "lucide-react";
import { adminPaymentApi } from "@/api/admin.api";
import { pharmacyApi } from "@/api/pharmacy.api";
import { GrantAccessDialog } from "@/components/admin/grant-access-dialog";
import { MethodBadge } from "@/components/admin/method-badge";
import { apiErrorMessage } from "@/lib/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminPaymentResponse, PaymentStatus } from "@/types";

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

const STATUS_BADGE: Record<PaymentStatus, "default" | "secondary" | "destructive" | "outline"> = {
  Completed: "default",
  Pending: "secondary",
  Requested: "secondary",
  Failed: "destructive",
  Cancelled: "outline",
  Reversed: "outline",
  Rejected: "destructive",
};

const STATUS_LABEL: Record<PaymentStatus, string> = {
  Completed: "Received",
  Pending: "Waiting",
  Requested: "Awaiting confirmation",
  Failed: "Failed",
  Cancelled: "Cancelled",
  Reversed: "Voided",
  Rejected: "Declined",
};

const money = (value: string | number) => `TZS ${Number(value).toLocaleString()}`;
const isoDate = (d: Date) => d.toISOString().split("T")[0];

export default function AdminPaymentsPage() {
  const qc = useQueryClient();
  const [from, setFrom] = useState(() => isoDate(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState("");
  const [pharmacyId, setPharmacyId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [grantOpen, setGrantOpen] = useState(false);
  const [voiding, setVoiding] = useState<AdminPaymentResponse | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [approving, setApproving] = useState<AdminPaymentResponse | null>(null);
  const [approveAmount, setApproveAmount] = useState("");
  const [approveReference, setApproveReference] = useState("");
  const [declining, setDeclining] = useState<AdminPaymentResponse | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  // Wait for a pause in typing before asking the server.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const rangeInvalid = !from || !to || to < from;

  const { data: summary } = useQuery({
    queryKey: ["admin", "payments", "summary", from, to],
    queryFn: () => adminPaymentApi.summary({ from, to }),
    enabled: !rangeInvalid,
  });

  const { data: pharmacies } = useQuery({
    queryKey: ["admin", "pharmacies", "for-payments-filter"],
    queryFn: () => pharmacyApi.list({ size: 200 }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payments", "list", from, to, method, status, pharmacyId, search, page],
    queryFn: () =>
      adminPaymentApi.list({
        from,
        to,
        method: method || undefined,
        status: status || undefined,
        pharmacyId: pharmacyId || undefined,
        search: search || undefined,
        page,
        size: 25,
      }),
    enabled: !rangeInvalid,
    placeholderData: (previous) => previous,
  });

  // Plan requests from pharmacies, whatever the date range: they stay here until someone decides.
  const { data: requested } = useQuery({
    queryKey: ["admin", "payments", "requests"],
    queryFn: () => adminPaymentApi.list({ status: "Requested", size: 50 }),
    refetchInterval: 30_000,
  });
  const requests = requested?.content ?? [];

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["admin", "payments"] });
    qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
  };

  const approveMutation = useMutation({
    mutationFn: () =>
      adminPaymentApi.approve(approving!.id, {
        amount: approveAmount.trim() ? Number(approveAmount) : undefined,
        reference: approveReference.trim() || undefined,
      }),
    onSuccess: ({ payment, subscription }) => {
      toast.success(`${payment.pharmacyName ?? "The pharmacy"} now has access until ${subscription.endDate}.`);
      refreshAll();
      setApproving(null);
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Could not confirm this request")),
  });

  const declineMutation = useMutation({
    mutationFn: () => adminPaymentApi.reject(declining!.id, declineReason.trim()),
    onSuccess: (payment) => {
      toast.success(`Declined the request from ${payment.pharmacyName ?? "the pharmacy"}.`);
      refreshAll();
      setDeclining(null);
      setDeclineReason("");
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Could not decline this request")),
  });

  function openApprove(p: AdminPaymentResponse) {
    setApproving(p);
    setApproveAmount(String(Number(p.amount)));
    setApproveReference(p.externalReference ?? "");
  }

  const voidMutation = useMutation({
    mutationFn: () => adminPaymentApi.void(voiding!.id, voidReason.trim()),
    onSuccess: ({ payment }) => {
      toast.success(`Voided. ${payment.pharmacyName ?? "The pharmacy"}'s access was adjusted.`);
      qc.invalidateQueries({ queryKey: ["admin", "payments"] });
      qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      setVoiding(null);
      setVoidReason("");
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Could not void this entry")),
  });

  const total = (m: string) => summary?.byMethod.find((x) => x.method === m);
  const mobileMoney = {
    total: Number(total("ClickPesa")?.total ?? 0) + Number(total("MobileMoney")?.total ?? 0),
    count: (total("ClickPesa")?.count ?? 0) + (total("MobileMoney")?.count ?? 0),
  };
  const rows = data?.content ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">
            Everything pharmacies have paid for their subscriptions: mobile money in the app, cash you recorded, and free promotions.
          </p>
        </div>
        <Button onClick={() => setGrantOpen(true)}>
          <Gift className="h-4 w-4 mr-2" />
          Give access
        </Button>
      </div>

      <GrantAccessDialog open={grantOpen} onOpenChange={setGrantOpen} />

      {/* Requests waiting for a decision */}
      {requests.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" /> Plan requests waiting ({requests.length})
            </CardTitle>
            <CardDescription>
              These pharmacies picked a plan and say they paid. Check the money arrived (mobile money or cash), then confirm to switch their access on.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {requests.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="space-y-0.5">
                  <p className="font-medium">{r.pharmacyName ?? "—"}</p>
                  <p className="text-sm">
                    {r.planType} · {r.periodLabel} · <span className="tabular-nums font-semibold">{money(r.amount)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                    <MethodBadge method={r.method} />
                    {r.externalReference && <>reference <span className="font-mono">{r.externalReference}</span></>}
                    <span>asked {new Date(r.createdAt).toLocaleString()}</span>
                    {r.recordedBy && <>by {r.recordedBy}</>}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => openApprove(r)}>
                    <Check className="h-4 w-4 mr-1" /> Confirm payment
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeclining(r)}>
                    <X className="h-4 w-4 mr-1" /> Decline
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Period + totals */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="pay-from">From</label>
          <Input id="pay-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} className="w-40" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="pay-to">To</label>
          <Input id="pay-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} className="w-40" />
        </div>
        {rangeInvalid && <p className="text-sm text-destructive">Choose a valid period (the end can&apos;t be before the start).</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Total icon={Wallet} title="Received" value={money(summary?.received ?? 0)} detail={`${summary?.completedCount ?? 0} completed entries`} />
        <Total icon={Smartphone} title="Mobile money" value={money(mobileMoney.total)} detail={`${mobileMoney.count} payments`} />
        <Total icon={Banknote} title="Cash recorded" value={money(total("Cash")?.total ?? 0)} detail={`${total("Cash")?.count ?? 0} payments`} />
        <Total
          icon={Gift}
          title="Free promotions"
          value={String(total("Promotion")?.count ?? 0)}
          detail={`${summary?.pendingCount ?? 0} waiting · ${summary?.failedCount ?? 0} failed · ${summary?.voidedCount ?? 0} voided`}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Receipt, reference, phone, note…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="pl-8 w-72" />
        </div>
        <select aria-label="Method" value={method} onChange={(e) => { setMethod(e.target.value); setPage(0); }} className={`${selectClass} w-44`}>
          <option value="">All methods</option>
          <option value="ClickPesa">Mobile money (in the app)</option>
          <option value="MobileMoney">Mobile money (owner says paid)</option>
          <option value="Cash">Cash</option>
          <option value="Promotion">Promotion</option>
        </select>
        <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} className={`${selectClass} w-40`}>
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABEL) as PaymentStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select aria-label="Pharmacy" value={pharmacyId} onChange={(e) => { setPharmacyId(e.target.value); setPage(0); }} className={`${selectClass} w-52`}>
          <option value="">All pharmacies</option>
          {pharmacies?.content.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Ledger */}
      <Card>
        <CardHeader>
          <CardTitle>Payment ledger</CardTitle>
          <CardDescription>
            {data ? `${data.totalElements.toLocaleString()} entries in this period` : "Loading…"} · Voided entries stay on the list so the record is complete.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="mx-auto h-10 w-10 mb-3 opacity-40" />
              No payments in this period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Pharmacy</th>
                    <th className="pb-3 font-medium">For</th>
                    <th className="pb-3 font-medium">Method</th>
                    <th className="pb-3 font-medium text-right">Amount</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Details</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/50 align-top">
                      <td className="py-3 pr-3 whitespace-nowrap text-muted-foreground">{new Date(p.createdAt).toLocaleString()}</td>
                      <td className="py-3 pr-3 font-medium">{p.pharmacyName ?? "—"}</td>
                      <td className="py-3 pr-3 whitespace-nowrap">
                        {p.planType} · {p.periodLabel}
                      </td>
                      <td className="py-3 pr-3"><MethodBadge method={p.method} /></td>
                      <td className="py-3 pr-3 text-right tabular-nums whitespace-nowrap">
                        {p.method === "Promotion" ? "Free" : money(p.amount)}
                      </td>
                      <td className="py-3 pr-3">
                        <Badge variant={STATUS_BADGE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                      </td>
                      <td className="py-3 pr-3 text-xs text-muted-foreground max-w-xs">
                        <span className="font-mono">{p.internalReference}</span>
                        {p.externalReference && p.method === "Cash" && <> · receipt {p.externalReference}</>}
                        {p.phoneNumber && <> · {p.phoneNumber}</>}
                        {p.channel && <> · {p.channel}</>}
                        {p.recordedBy && <> · by {p.recordedBy}</>}
                        {p.note && <p className="mt-0.5 italic">&ldquo;{p.note}&rdquo;</p>}
                        {p.failureReason && p.status !== "Completed" && <p className="mt-0.5 text-destructive">{p.failureReason}</p>}
                      </td>
                      <td className="py-3 text-right">
                        {p.status === "Requested" && (
                          <Button variant="ghost" size="sm" onClick={() => openApprove(p)}>
                            Review
                          </Button>
                        )}
                        {p.status === "Completed" && p.method !== "ClickPesa" && (
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setVoiding(p)}>
                            Void
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <p className="text-sm text-muted-foreground">Page {page + 1} of {data.totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={data.first} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={data.last} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm a request */}
      <Dialog open={!!approving} onOpenChange={(open) => !open && setApproving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm this payment?</DialogTitle>
          </DialogHeader>
          {approving && (
            <div className="space-y-4 px-6 py-4">
              <p className="text-sm">
                <strong>{approving.pharmacyName}</strong> asked for the <strong>{approving.planType}</strong> plan for{" "}
                <strong>{approving.periodLabel}</strong> and says they paid by{" "}
                {approving.method === "Cash" ? "cash" : "mobile money"}. Confirming switches their access on straight away.
              </p>
              <div className="space-y-1">
                <Label htmlFor="appr-amount">Amount you received (TZS)</Label>
                <Input id="appr-amount" type="number" min={1} value={approveAmount} onChange={(e) => setApproveAmount(e.target.value)} />
                <p className="text-xs text-muted-foreground">Listed price is {money(approving.amount)}. Change it only if you agreed a different amount.</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="appr-ref">Reference / receipt</Label>
                <Input id="appr-ref" value={approveReference} onChange={(e) => setApproveReference(e.target.value)} maxLength={100} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproving(null)}>Not yet</Button>
            <Button disabled={!(Number(approveAmount) > 0) || approveMutation.isPending} onClick={() => approveMutation.mutate()}>
              {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm and activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline a request */}
      <Dialog open={!!declining} onOpenChange={(open) => !open && setDeclining(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Decline this request?</DialogTitle>
          </DialogHeader>
          {declining && (
            <div className="space-y-4 px-6 py-4">
              <p className="text-sm">
                <strong>{declining.pharmacyName}</strong> will not get access. They can send a new request.
              </p>
              <div className="space-y-1">
                <Label htmlFor="decl-reason">Reason (the owner will see this) *</Label>
                <Input id="decl-reason" placeholder="e.g. We did not receive the payment" value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} maxLength={300} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclining(null)}>Cancel</Button>
            <Button variant="destructive" disabled={declineReason.trim().length < 3 || declineMutation.isPending} onClick={() => declineMutation.mutate()}>
              {declineMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Decline request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void */}
      <Dialog open={!!voiding} onOpenChange={(open) => !open && setVoiding(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Void this entry?</DialogTitle>
          </DialogHeader>
          {voiding && (
            <div className="space-y-4 px-6 py-4">
              <p className="text-sm">
                This takes <strong>{voiding.periodLabel}</strong> of {voiding.planType} back off{" "}
                <strong>{voiding.pharmacyName}</strong>&apos;s subscription
                {voiding.method === "Cash" ? ` and removes ${money(voiding.amount)} from the money received` : ""}. The entry stays on the list marked as voided.
              </p>
              <div className="space-y-1">
                <Label htmlFor="void-reason">Reason *</Label>
                <Input id="void-reason" placeholder="e.g. Recorded for the wrong pharmacy" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoiding(null)}>Keep it</Button>
            <Button variant="destructive" disabled={voidReason.trim().length < 3 || voidMutation.isPending} onClick={() => voidMutation.mutate()}>
              {voidMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Void entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Total({
  icon: Icon,
  title,
  value,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
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
