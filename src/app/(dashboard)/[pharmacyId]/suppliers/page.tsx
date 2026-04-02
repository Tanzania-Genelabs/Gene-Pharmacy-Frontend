"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supplierApi } from "@/api/supplier.api";
import { toast } from "sonner";
import {
  Plus, Search, MoreHorizontal, Truck, X,
  CreditCard, DollarSign, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import type {
  SupplierResponse, CreateSupplierRequest, UpdateSupplierRequest,
  RecordPaymentRequest, SupplierPaymentMethod,
} from "@/types";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

const PAYMENT_METHODS: { value: SupplierPaymentMethod; label: string }[] = [
  { value: "Cash", label: "Cash" },
  { value: "BankTransfer", label: "Bank Transfer" },
  { value: "MobileMoney", label: "Mobile Money" },
  { value: "Cheque", label: "Cheque" },
];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  Active: "default",
  Suspended: "destructive",
  Inactive: "secondary",
};

// ─── Add / Edit Dialog ────────────────────────────────────────────────────────

interface SupplierFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pharmacyId: string;
  supplier?: SupplierResponse | null;
}

function SupplierFormDialog({ open, onOpenChange, pharmacyId, supplier }: SupplierFormDialogProps) {
  const qc = useQueryClient();
  const isEdit = !!supplier;

  const [form, setForm] = useState<CreateSupplierRequest>({
    name: supplier?.name ?? "",
    contactPerson: supplier?.contactPerson ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    address: supplier?.address ?? "",
    city: supplier?.city ?? "",
    country: supplier?.country ?? "",
    taxNumber: supplier?.taxNumber ?? "",
    notes: supplier?.notes ?? "",
  });

  const set = (field: keyof CreateSupplierRequest, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const createMutation = useMutation({
    mutationFn: (data: CreateSupplierRequest) => supplierApi.create(pharmacyId, data),
    onSuccess: () => {
      toast.success("Supplier added");
      qc.invalidateQueries({ queryKey: ["suppliers", pharmacyId] });
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to add supplier"),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateSupplierRequest) =>
      supplierApi.update(pharmacyId, supplier!.id, data),
    onSuccess: () => {
      toast.success("Supplier updated");
      qc.invalidateQueries({ queryKey: ["suppliers", pharmacyId] });
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to update supplier"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Supplier name is required"); return; }
    const clean = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, (v as string).trim() || undefined])
    ) as unknown as CreateSupplierRequest;
    if (isEdit) { updateMutation.mutate(clean); } else { createMutation.mutate(clean); }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sup-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="sup-name"
                placeholder="e.g. Pharma Distributors Ltd"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sup-contact">Contact Person</Label>
                <Input
                  id="sup-contact"
                  placeholder="Full name"
                  value={form.contactPerson}
                  onChange={(e) => set("contactPerson", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sup-phone">Phone</Label>
                <Input
                  id="sup-phone"
                  placeholder="+255 7XX XXX XXX"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sup-email">Email</Label>
              <Input
                id="sup-email"
                type="email"
                placeholder="supplier@example.com"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sup-address">Address</Label>
              <Input
                id="sup-address"
                placeholder="Street address"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sup-city">City</Label>
                <Input
                  id="sup-city"
                  placeholder="Dar es Salaam"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sup-country">Country</Label>
                <Input
                  id="sup-country"
                  placeholder="Tanzania"
                  value={form.country}
                  onChange={(e) => set("country", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sup-tax">Tax Number (TIN / VAT)</Label>
              <Input
                id="sup-tax"
                placeholder="Tax ID number"
                value={form.taxNumber}
                onChange={(e) => set("taxNumber", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sup-notes">Notes</Label>
              <Textarea
                id="sup-notes"
                placeholder="Optional remarks…"
                rows={3}
                value={form.notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set("notes", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Record Payment Dialog ─────────────────────────────────────────────────────

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pharmacyId: string;
  supplier: SupplierResponse;
}

function RecordPaymentDialog({ open, onOpenChange, pharmacyId, supplier }: RecordPaymentDialogProps) {
  const qc = useQueryClient();
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState<RecordPaymentRequest>({
    amount: 0,
    paymentMethod: "Cash",
    reference: "",
    notes: "",
    paymentDate: today,
  });

  const mutation = useMutation({
    mutationFn: (data: RecordPaymentRequest) =>
      supplierApi.recordPayment(pharmacyId, supplier.id, data),
    onSuccess: () => {
      toast.success("Payment recorded");
      qc.invalidateQueries({ queryKey: ["suppliers", pharmacyId] });
      qc.invalidateQueries({ queryKey: ["supplier-payments", pharmacyId, supplier.id] });
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to record payment"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || form.amount <= 0) { toast.error("Amount must be greater than 0"); return; }
    mutation.mutate({
      ...form,
      reference: form.reference?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
    } as RecordPaymentRequest);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Record Payment — {supplier.name}
            </span>
          </DialogTitle>
        </DialogHeader>

        {supplier.outstandingBalance > 0 && (
          <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            <DollarSign className="h-4 w-4 shrink-0" />
            Outstanding balance: <strong>TZS {supplier.outstandingBalance.toLocaleString()}</strong>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">
                Amount (TZS) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pay-amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={form.amount || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-date">
                Payment Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pay-date"
                type="date"
                max={today}
                value={form.paymentDate}
                onChange={(e) => setForm((p) => ({ ...p, paymentDate: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Payment Method <span className="text-destructive">*</span></Label>
            <Select
              value={form.paymentMethod}
              onValueChange={(v: string) =>
                setForm((p) => ({ ...p, paymentMethod: v as SupplierPaymentMethod }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-ref">Reference / Receipt No.</Label>
            <Input
              id="pay-ref"
              placeholder="e.g. TXN-00123"
              value={form.reference}
              onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-notes">Notes</Label>
            <Textarea
              id="pay-notes"
              placeholder="Optional remarks…"
              rows={2}
              value={form.notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Record Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Payment History Sheet ─────────────────────────────────────────────────────

interface PaymentHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pharmacyId: string;
  supplier: SupplierResponse;
}

function PaymentHistorySheet({ open, onOpenChange, pharmacyId, supplier }: PaymentHistorySheetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["supplier-payments", pharmacyId, supplier.id],
    queryFn: () => supplierApi.listPayments(pharmacyId, supplier.id, { size: 50 }),
    enabled: open,
  });

  const METHOD_LABEL: Record<string, string> = {
    Cash: "Cash", BankTransfer: "Bank Transfer",
    MobileMoney: "Mobile Money", Cheque: "Cheque",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Payment History — {supplier.name}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            Outstanding: <strong>TZS {(supplier.outstandingBalance ?? 0).toLocaleString()}</strong>
          </p>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-3 mt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 bg-muted animate-pulse rounded-md" />
            ))}
          </div>
        ) : !data?.content.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <CreditCard className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No payments recorded yet</p>
          </div>
        ) : (
          <div className="space-y-2 mt-4">
            {data.content.map((payment) => (
              <div
                key={payment.id}
                className="flex items-start justify-between rounded-md border px-4 py-3 text-sm"
              >
                <div className="space-y-0.5">
                  <p className="font-medium">TZS {Number(payment.amount).toLocaleString()}</p>
                  <p className="text-muted-foreground text-xs">
                    {METHOD_LABEL[payment.paymentMethod] ?? payment.paymentMethod}
                    {payment.reference && <> · {payment.reference}</>}
                  </p>
                  {payment.notes && (
                    <p className="text-muted-foreground text-xs italic">{payment.notes}</p>
                  )}
                </div>
                <div className="text-right text-xs text-muted-foreground shrink-0 ml-4">
                  <p>{new Date(payment.paymentDate).toLocaleDateString()}</p>
                  {payment.recordedBy && <p className="mt-0.5">{payment.recordedBy}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SuppliersPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<SupplierResponse | null>(null);
  const [paySupplier, setPaySupplier] = useState<SupplierResponse | null>(null);
  const [historySupplier, setHistorySupplier] = useState<SupplierResponse | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["suppliers", pharmacyId, page, search],
    queryFn: () =>
      supplierApi.list(pharmacyId, { page, size: 20, search: search || undefined }),
    placeholderData: (prev) => prev,
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => supplierApi.delete(pharmacyId, id),
    onSuccess: () => {
      toast.success("Supplier deactivated");
      qc.invalidateQueries({ queryKey: ["suppliers", pharmacyId] });
    },
    onError: () => toast.error("Failed to deactivate supplier"),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => supplierApi.reactivate(pharmacyId, id),
    onSuccess: () => {
      toast.success("Supplier reactivated");
      qc.invalidateQueries({ queryKey: ["suppliers", pharmacyId] });
    },
    onError: () => toast.error("Failed to reactivate supplier"),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Suppliers</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {data?.totalElements ?? 0} registered suppliers
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Supplier
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search suppliers…"
          className="pl-9"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Outstanding Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 w-full bg-muted animate-pulse rounded" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !data?.content.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    <Truck className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    {search ? "No suppliers match your search" : "No suppliers yet — add your first one"}
                  </TableCell>
                </TableRow>
              ) : (
                data.content.map((supplier) => (
                  <TableRow key={supplier.id} className="hover:bg-accent/50">
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {supplier.contactPerson ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">{supplier.phone ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{supplier.email ?? "—"}</TableCell>
                    <TableCell className="tabular-nums font-medium">
                      TZS {(supplier.outstandingBalance ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[supplier.status] ?? "secondary"}>
                        {supplier.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditSupplier(supplier)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPaySupplier(supplier)}>
                            Record Payment
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setHistorySupplier(supplier)}>
                            View Payments
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {supplier.status === "Active" ? (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deactivateMutation.mutate(supplier.id)}
                            >
                              Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => reactivateMutation.mutate(supplier.id)}
                            >
                              Reactivate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={data.first}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="flex items-center text-sm text-muted-foreground px-2">
            Page {page + 1} of {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={data.last}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <SupplierFormDialog
        open={addOpen}
        onOpenChange={(o) => { setAddOpen(o); }}
        pharmacyId={pharmacyId}
      />

      {editSupplier && (
        <SupplierFormDialog
          open={!!editSupplier}
          onOpenChange={(o) => { if (!o) setEditSupplier(null); }}
          pharmacyId={pharmacyId}
          supplier={editSupplier}
        />
      )}

      {paySupplier && (
        <RecordPaymentDialog
          open={!!paySupplier}
          onOpenChange={(o) => { if (!o) setPaySupplier(null); }}
          pharmacyId={pharmacyId}
          supplier={paySupplier}
        />
      )}

      {historySupplier && (
        <PaymentHistorySheet
          open={!!historySupplier}
          onOpenChange={(o) => { if (!o) setHistorySupplier(null); }}
          pharmacyId={pharmacyId}
          supplier={historySupplier}
        />
      )}
    </div>
  );
}
