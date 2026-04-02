"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentApi } from "@/api/payment.api";
import { branchApi } from "@/api/branch.api";
import { toast } from "sonner";
import {
  CreditCard,
  Smartphone,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
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

  const emptyForm = (): InitiatePaymentRequest => ({
    branchId: "",
    provider: "Mpesa" as PaymentProvider,
    amount: 0,
    phoneNumber: "",
  });
  const [form, setForm] = useState<InitiatePaymentRequest>(emptyForm());

  const { data, isLoading } = useQuery({
    queryKey: ["payments", pharmacyId, page],
    queryFn: () => paymentApi.list(pharmacyId, { page, size: 20 }),
    placeholderData: (prev) => prev,
  });

  const { data: branches } = useQuery({
    queryKey: ["branches", pharmacyId],
    queryFn: () => branchApi.list(pharmacyId),
    enabled: showInitiate,
  });

  const initiateMutation = useMutation({
    mutationFn: (data: InitiatePaymentRequest) => paymentApi.initiate(pharmacyId, data),
    onSuccess: () => {
      toast.success("Payment initiated — awaiting confirmation");
      qc.invalidateQueries({ queryKey: ["payments", pharmacyId] });
      setShowInitiate(false);
      setForm(emptyForm());
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to initiate payment");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.branchId || !form.amount) {
      toast.error("Branch and amount are required");
      return;
    }
    initiateMutation.mutate(form);
  }

  const providers: PaymentProvider[] = ["Mpesa", "TigoPesa", "AirtelMoney", "HaloPesa", "Cash", "Card"];

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
              <Label htmlFor="p-branch">Branch *</Label>
              <select id="p-branch"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.branchId}
                onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}>
                <option value="">Select branch…</option>
                {branches?.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-provider">Payment Provider *</Label>
              <select id="p-provider"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.provider}
                onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value as PaymentProvider }))}>
                {providers.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-amount">Amount (TZS) *</Label>
              <Input id="p-amount" type="number" min={1} value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-phone">Customer Phone</Label>
              <Input id="p-phone" placeholder="+255 7XX XXX XXX"
                value={form.phoneNumber ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={initiateMutation.isPending}>
                {initiateMutation.isPending ? "Processing…" : "Send Payment Request"}
              </Button>
            </DialogFooter>
          </form>
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
                      {p.provider}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    TZS {p.amount.toLocaleString()}
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
