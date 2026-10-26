"use client";

import { use, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentApi } from "@/api/payment.api";
import { toast } from "sonner";
import {
  CreditCard,
  Smartphone,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { InitiatePaymentRequest, PaymentProvider, PaymentStatus } from "@/types";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

function statusBadge(status: PaymentStatus) {
  const map: Record<PaymentStatus, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
    Completed: { variant: "default", icon: CheckCircle2 },
    Pending: { variant: "secondary", icon: Clock },
    Failed: { variant: "destructive", icon: XCircle },
    Cancelled: { variant: "outline", icon: XCircle },
    Reversed: { variant: "outline", icon: XCircle },
  };
  const { variant, icon: Icon } = map[status] ?? map.Pending;
  return (
    <Badge variant={variant} className="flex items-center gap-1 w-fit">
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  );
}

function providerIcon(provider: PaymentProvider) {
  if (provider === "Cash") return <CreditCard className="h-4 w-4" />;
  return <Smartphone className="h-4 w-4" />;
}

export default function PaymentsPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [showInitiate, setShowInitiate] = useState(false);
  const [trackedId, setTrackedId] = useState<string | null>(null);

  // Polls every 3s while the customer is entering their PIN; the server throttles calls to ClickPesa.
  const { data: tracked } = useQuery({
    queryKey: ["payment", pharmacyId, trackedId],
    queryFn: () => paymentApi.getById(pharmacyId, trackedId!),
    enabled: !!trackedId,
    refetchInterval: (query) => (query.state.data && query.state.data.status !== "Pending" ? false : 3000),
  });

  useEffect(() => {
    if (tracked && tracked.status !== "Pending") {
      qc.invalidateQueries({ queryKey: ["payments", pharmacyId] });
    }
  }, [tracked, qc, pharmacyId]);

  const emptyForm = (): InitiatePaymentRequest => ({
    provider: "ClickPesa" as PaymentProvider,
    amount: 0,
    phoneNumber: "",
  });
  const [form, setForm] = useState<InitiatePaymentRequest>(emptyForm());

  const { data, isLoading } = useQuery({
    queryKey: ["payments", pharmacyId, page],
    queryFn: () => paymentApi.list(pharmacyId, { page, size: 20 }),
    placeholderData: (prev) => prev,
  });

  const initiateMutation = useMutation({
    mutationFn: (data: InitiatePaymentRequest) => paymentApi.initiate(pharmacyId, data),
    onSuccess: (payment) => {
      qc.invalidateQueries({ queryKey: ["payments", pharmacyId] });
      setShowInitiate(false);
      setForm(emptyForm());
      if (payment.status === "Completed") {
        toast.success("Payment recorded");
      } else {
        setTrackedId(payment.id); // customer now has a prompt on their phone: watch it live
      }
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to initiate payment");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || form.amount <= 0) {
      toast.error("Enter the amount to collect");
      return;
    }
    if (form.provider !== "Cash" && !form.phoneNumber?.trim()) {
      toast.error("Enter the customer's mobile number");
      return;
    }
    initiateMutation.mutate(form);
  }

  const providers: { value: PaymentProvider; label: string }[] = [
    { value: "ClickPesa", label: "Mobile money (M-Pesa, Tigo Pesa, Airtel Money, Halopesa)" },
    { value: "Cash", label: "Cash" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Payments</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Mobile money & card payment transactions
          </p>
        </div>
        <Button size="sm" onClick={() => setShowInitiate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Initiate Payment
        </Button>
      </div>

      {/* Initiate Payment Dialog */}
      <Dialog open={showInitiate} onOpenChange={setShowInitiate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Initiate Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
            <div className="space-y-1">
              <Label htmlFor="p-provider">Payment method *</Label>
              <select id="p-provider"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.provider}
                onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value as PaymentProvider }))}>
                {providers.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-amount">Amount (TZS) *</Label>
              <Input id="p-amount" type="number" min={1} value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))} />
            </div>
            {form.provider !== "Cash" && (
            <div className="space-y-1">
              <Label htmlFor="p-phone">Customer mobile number *</Label>
              <Input id="p-phone" placeholder="0712 345 678"
                value={form.phoneNumber ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))} />
              <p className="text-xs text-muted-foreground">
                The customer receives a prompt on this phone and enters their mobile-money PIN to approve.
              </p>
            </div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={initiateMutation.isPending}>
                {initiateMutation.isPending ? "Processing…" : "Send Payment Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Live status while the customer approves on their phone */}
      <Dialog open={!!trackedId} onOpenChange={(open) => !open && setTrackedId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {!tracked || tracked.status === "Pending"
                ? "Waiting for the customer…"
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
                  A payment prompt was sent to {tracked?.phoneNumber ?? "the customer's phone"}. Ask them to
                  enter their mobile-money PIN to approve TZS {Number(tracked?.amount ?? 0).toLocaleString()}.
                </p>
              </>
            ) : tracked.status === "Completed" ? (
              <>
                <CheckCircle2 className="h-10 w-10 text-green-600" />
                <p className="text-sm">TZS {Number(tracked.amount).toLocaleString()} received via {tracked.channel ?? "mobile money"}.</p>
              </>
            ) : (
              <>
                <XCircle className="h-10 w-10 text-destructive" />
                <p className="text-sm text-muted-foreground">{tracked.failureReason ?? "The customer did not approve the payment."}</p>
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

      {/* Payment List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.content?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.internalReference}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {providerIcon(p.provider)}
                      {p.channel ?? p.provider}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    TZS {Number(p.amount).toLocaleString()}
                  </TableCell>
                  <TableCell>{p.phoneNumber ?? "—"}</TableCell>
                  <TableCell>{statusBadge(p.status)}</TableCell>
                  <TableCell>{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
              {!isLoading && (!data?.content || data.content.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No payment transactions yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {data.number + 1} of {data.totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={data.first} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={data.last} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
