"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { purchaseOrderApi } from "@/api/purchase-order.api";
import { supplierApi } from "@/api/supplier.api";
import { branchApi } from "@/api/branch.api";
import { drugApi } from "@/api/drug.api";
import { PackQuantityField } from "@/components/inventory/pack-quantity-field";
import { formatQuantity, packInfo } from "@/lib/packs";
import { toast } from "sonner";
import { Plus, FileText, MoreHorizontal, Trash2, PackageCheck, Loader2 } from "lucide-react";
import { apiErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import type {
  PurchaseOrderStatus, CreatePurchaseOrderRequest, PurchaseOrderItemRequest,
  PurchaseOrderResponse, ReceiveItemRequest,
} from "@/types";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

const STATUS_VARIANT: Record<PurchaseOrderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  Draft: "secondary",
  Ordered: "outline",
  PartiallyReceived: "outline",
  Received: "default",
  Cancelled: "destructive",
};

/** Generate a simple order number: PO-YYYYMMDD-XXXX */
function generateOrderNumber(): string {
  const today = new Date();
  const date = today.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `PO-${date}-${rand}`;
}

const today = new Date().toISOString().split("T")[0];

const emptyForm = (): CreatePurchaseOrderRequest => ({
  supplierId: "",
  branchId: "",
  orderNumber: generateOrderNumber(),
  orderDate: today,
  expectedDate: "",
  notes: "",
  items: [],
});

const emptyLine = (): PurchaseOrderItemRequest => ({
  drugId: "",
  quantityOrdered: 1,
  unitPrice: 0,
});

export default function PurchaseOrdersPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<CreatePurchaseOrderRequest>(emptyForm());
  const [lineItem, setLineItem] = useState<PurchaseOrderItemRequest>(emptyLine());
  const [receivingId, setReceivingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["purchase-orders", pharmacyId, page],
    queryFn: () => purchaseOrderApi.list(pharmacyId, { page, size: 20 }),
    placeholderData: (prev) => prev,
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", pharmacyId, "all"],
    queryFn: () => supplierApi.list(pharmacyId, { size: 200 }),
    enabled: showAdd,
  });

  const { data: branches } = useQuery({
    queryKey: ["branches", pharmacyId],
    queryFn: () => branchApi.list(pharmacyId),
    enabled: showAdd,
  });

  const { data: drugs } = useQuery({
    queryKey: ["drugs", pharmacyId, "all"],
    queryFn: () => drugApi.list(pharmacyId, { size: 500 }),
    enabled: showAdd,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatePurchaseOrderRequest) => purchaseOrderApi.create(pharmacyId, data),
    onSuccess: () => {
      toast.success("Purchase order created");
      qc.invalidateQueries({ queryKey: ["purchase-orders", pharmacyId] });
      setShowAdd(false);
      setForm(emptyForm());
      setLineItem(emptyLine());
    },
    onError: () => toast.error("Failed to create order"),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => purchaseOrderApi.confirm(pharmacyId, id),
    onSuccess: () => {
      toast.success("Order confirmed");
      qc.invalidateQueries({ queryKey: ["purchase-orders", pharmacyId] });
    },
    onError: () => toast.error("Failed to confirm order"),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => purchaseOrderApi.cancel(pharmacyId, id),
    onSuccess: () => {
      toast.success("Order cancelled");
      qc.invalidateQueries({ queryKey: ["purchase-orders", pharmacyId] });
    },
    onError: () => toast.error("Failed to cancel order"),
  });

  const receiveMutation = useMutation({
    mutationFn: ({ orderId, items }: { orderId: string; items: ReceiveItemRequest[] }) =>
      purchaseOrderApi.receiveItems(pharmacyId, orderId, items),
    onSuccess: () => {
      toast.success("Delivery received into stock");
      qc.invalidateQueries({ queryKey: ["purchase-orders", pharmacyId] });
      qc.invalidateQueries({ queryKey: ["inventory", pharmacyId] });
      qc.invalidateQueries({ queryKey: ["expiry"] });
      setReceivingId(null);
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Could not receive this delivery")),
  });

  function addLineItem() {
    if (!lineItem.drugId) { toast.error("Select a drug"); return; }
    if (lineItem.quantityOrdered < 1) { toast.error("Quantity must be at least 1"); return; }
    if (lineItem.unitPrice < 0) { toast.error("Unit price cannot be negative"); return; }
    setForm((f) => ({ ...f, items: [...f.items, { ...lineItem }] }));
    setLineItem(emptyLine());
  }

  function removeLineItem(idx: number) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.supplierId) { toast.error("Supplier is required"); return; }
    if (!form.branchId) { toast.error("Branch is required"); return; }
    if (!form.orderNumber.trim()) { toast.error("Order number is required"); return; }
    if (!form.orderDate) { toast.error("Order date is required"); return; }
    if (form.items.length === 0) { toast.error("Add at least one item"); return; }

    createMutation.mutate({
      ...form,
      expectedDate: form.expectedDate || undefined,
      notes: form.notes?.trim() || undefined,
    } as CreatePurchaseOrderRequest);
  }

  const supplierMap = Object.fromEntries(
    (suppliers?.content ?? []).map((s) => [s.id, s.name])
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Purchase Orders</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {data?.totalElements ?? 0} orders
          </p>
        </div>
        <Button size="sm" onClick={() => { setForm(emptyForm()); setShowAdd(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          New Order
        </Button>
      </div>

      {/* New Purchase Order Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Purchase Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">

            {/* Supplier & Branch */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="po-supplier">Supplier <span className="text-destructive">*</span></Label>
                <select
                  id="po-supplier"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.supplierId}
                  onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))}
                >
                  <option value="">Select supplier…</option>
                  {suppliers?.content?.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="po-branch">Branch <span className="text-destructive">*</span></Label>
                <select
                  id="po-branch"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.branchId}
                  onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
                >
                  <option value="">Select branch…</option>
                  {branches?.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Order Number & Dates */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="po-number">Order Number <span className="text-destructive">*</span></Label>
                <Input
                  id="po-number"
                  value={form.orderNumber}
                  onChange={(e) => setForm((f) => ({ ...f, orderNumber: e.target.value }))}
                  placeholder="PO-20260226-1234"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="po-date">Order Date <span className="text-destructive">*</span></Label>
                <Input
                  id="po-date"
                  type="date"
                  max={today}
                  value={form.orderDate}
                  onChange={(e) => setForm((f) => ({ ...f, orderDate: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="po-expected">Expected Delivery</Label>
                <Input
                  id="po-expected"
                  type="date"
                  min={today}
                  value={form.expectedDate ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, expectedDate: e.target.value }))}
                />
              </div>
            </div>

            {/* Line item builder */}
            <div className="space-y-2">
              <Label>Order Items <span className="text-destructive">*</span></Label>
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    value={lineItem.drugId}
                    onChange={(e) => setLineItem((l) => ({ ...l, drugId: e.target.value }))}
                  >
                    <option value="">Select drug…</option>
                    {drugs?.content?.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <PackQuantityField
                    key={lineItem.drugId}
                    placeholder="Qty"
                    info={packInfo(drugs?.content?.find((d) => d.id === lineItem.drugId))}
                    value={lineItem.quantityOrdered}
                    onChange={(units) => setLineItem((l) => ({ ...l, quantityOrdered: units }))}
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    type="number" min={0} step="0.01"
                    placeholder={`Price per ${packInfo(drugs?.content?.find((d) => d.id === lineItem.drugId)).unit} (TZS)`}
                    value={lineItem.unitPrice || ""}
                    onChange={(e) =>
                      setLineItem((l) => ({ ...l, unitPrice: parseFloat(e.target.value) || 0 }))
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Button type="button" variant="outline" size="sm" className="w-full" onClick={addLineItem}>
                    Add
                  </Button>
                </div>
              </div>

              {form.items.length > 0 && (
                <div className="border rounded-md divide-y max-h-44 overflow-y-auto text-sm">
                  {form.items.map((item, idx) => {
                    const lineDrug = drugs?.content?.find((d) => d.id === item.drugId);
                    const drugName = lineDrug?.name ?? item.drugId;
                    const total = item.quantityOrdered * item.unitPrice;
                    return (
                      <div key={idx} className="flex items-center justify-between px-3 py-2 gap-2">
                        <span className="font-medium truncate flex-1">{drugName}</span>
                        <span className="text-muted-foreground tabular-nums shrink-0">
                          {formatQuantity(item.quantityOrdered, packInfo(lineDrug))} × TZS {item.unitPrice.toLocaleString()}
                          {" = "}
                          <strong>TZS {total.toLocaleString()}</strong>
                        </span>
                        <Button
                          type="button" variant="ghost" size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => removeLineItem(idx)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                  {form.items.length > 0 && (
                    <div className="px-3 py-2 text-right font-semibold text-sm bg-muted/40">
                      Total: TZS{" "}
                      {form.items
                        .reduce((sum, i) => sum + i.quantityOrdered * i.unitPrice, 0)
                        .toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="po-notes">Notes</Label>
              <Input
                id="po-notes"
                placeholder="Optional notes…"
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating…" : "Create Order"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 w-full bg-muted animate-pulse rounded" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !data?.content.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No purchase orders found
                  </TableCell>
                </TableRow>
              ) : (
                data.content.map((order) => (
                  <TableRow key={order.id} className="hover:bg-accent/50">
                    <TableCell className="font-mono text-xs">{order.orderNumber}</TableCell>
                    <TableCell className="font-medium">
                      {supplierMap[order.supplierId] ?? order.supplierId.slice(0, 8) + "…"}
                    </TableCell>
                    <TableCell className="tabular-nums">{order.totalItems}</TableCell>
                    <TableCell className="tabular-nums font-medium">
                      TZS {Number(order.totalAmount).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[order.status] ?? "secondary"}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground text-xs">
                      {order.orderDate}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground text-xs">
                      {order.expectedDate ?? "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {order.status === "Draft" && (
                            <DropdownMenuItem onClick={() => confirmMutation.mutate(order.id)}>
                              Confirm Order
                            </DropdownMenuItem>
                          )}
                          {["Ordered", "PartiallyReceived"].includes(order.status) && (
                            <DropdownMenuItem onClick={() => setReceivingId(order.id)}>
                              <PackageCheck className="h-4 w-4 mr-2" />
                              Receive Delivery
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {["Draft", "Ordered"].includes(order.status) && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => cancelMutation.mutate(order.id)}
                            >
                              Cancel Order
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

      <ReceiveDialog
        pharmacyId={pharmacyId}
        orderId={receivingId}
        saving={receiveMutation.isPending}
        onClose={() => setReceivingId(null)}
        onSubmit={(orderId, items) => receiveMutation.mutate({ orderId, items })}
      />

      {data && data.totalPages > 1 && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" disabled={data.first} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="flex items-center text-sm text-muted-foreground px-2">
            Page {page + 1} of {data.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={data.last} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

const todayIso = new Date().toISOString().split("T")[0];

interface ReceiveLine {
  drugId: string;
  quantity: string;
  batchNumber: string;
  expiryDate: string;
}

/**
 * What actually arrived: how many of each line, and the batch number and expiry date printed on the boxes.
 * Lines with an expiry date are recorded as batches, so the expiry alerts can see them.
 */
function ReceiveDialog({
  pharmacyId,
  orderId,
  saving,
  onClose,
  onSubmit,
}: {
  pharmacyId: string;
  orderId: string | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (orderId: string, items: ReceiveItemRequest[]) => void;
}) {
  const { data: order, isLoading } = useQuery({
    queryKey: ["purchase-orders", pharmacyId, "detail", orderId],
    queryFn: () => purchaseOrderApi.getById(pharmacyId, orderId!),
    enabled: !!orderId,
  });

  return (
    <Dialog open={!!orderId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receive delivery{order ? ` · ${order.orderNumber}` : ""}</DialogTitle>
        </DialogHeader>
        {isLoading || !order ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          // Keyed by order so the lines start fresh for each delivery.
          <ReceiveForm key={order.id} order={order} saving={saving} onClose={onClose} onSubmit={onSubmit} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReceiveForm({
  order,
  saving,
  onClose,
  onSubmit,
}: {
  order: PurchaseOrderResponse;
  saving: boolean;
  onClose: () => void;
  onSubmit: (orderId: string, items: ReceiveItemRequest[]) => void;
}) {
  const open = order.items.filter((i) => i.quantityOrdered - i.quantityReceived > 0);
  // Everything still outstanding is assumed to have arrived; change what did not.
  const [lines, setLines] = useState<ReceiveLine[]>(
    open.map((i) => ({ drugId: i.drugId, quantity: String(i.quantityOrdered - i.quantityReceived), batchNumber: "", expiryDate: "" })),
  );

  const patch = (idx: number, change: Partial<ReceiveLine>) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...change } : l)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const items: ReceiveItemRequest[] = [];
    for (const [idx, line] of lines.entries()) {
      const qty = Number(line.quantity);
      if (!qty) continue;
      const outstanding = open[idx].quantityOrdered - open[idx].quantityReceived;
      if (!Number.isInteger(qty) || qty < 0 || qty > outstanding) {
        toast.error(`${open[idx].drugName}: enter a whole number from 0 to ${outstanding}`);
        return;
      }
      items.push({
        drugId: line.drugId,
        quantityReceived: qty,
        expiryDate: line.expiryDate || undefined,
        batchNumber: line.batchNumber.trim() || undefined,
      });
    }
    if (items.length === 0) {
      toast.error("Enter how many units arrived");
      return;
    }
    onSubmit(order.id, items);
  }

  return (
    <form onSubmit={submit} className="space-y-4 py-2">
      <p className="text-sm text-muted-foreground">
        Enter what arrived. Add the <strong>expiry date</strong> printed on the boxes so the units appear in the expiry alerts.
      </p>
      <div className="space-y-3">
        {open.map((item, idx) => {
          const outstanding = item.quantityOrdered - item.quantityReceived;
          return (
            <div key={item.id} className="grid grid-cols-12 items-end gap-3 rounded-md border p-3">
              <div className="col-span-12 sm:col-span-4">
                <p className="font-medium text-sm">{item.drugName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.quantityReceived} of {item.quantityOrdered} received · {outstanding} to come
                </p>
              </div>
              <div className="col-span-4 sm:col-span-2 space-y-1">
                <Label htmlFor={`rq-${idx}`} className="text-xs">Arrived now</Label>
                <Input
                  id={`rq-${idx}`}
                  type="number"
                  min={0}
                  max={outstanding}
                  value={lines[idx].quantity}
                  onChange={(e) => patch(idx, { quantity: e.target.value })}
                />
              </div>
              <div className="col-span-4 sm:col-span-3 space-y-1">
                <Label htmlFor={`rb-${idx}`} className="text-xs">Batch number</Label>
                <Input id={`rb-${idx}`} placeholder="Optional" maxLength={100} value={lines[idx].batchNumber} onChange={(e) => patch(idx, { batchNumber: e.target.value })} />
              </div>
              <div className="col-span-4 sm:col-span-3 space-y-1">
                <Label htmlFor={`re-${idx}`} className="text-xs">Expiry date</Label>
                <Input id={`re-${idx}`} type="date" min={todayIso} value={lines[idx].expiryDate} onChange={(e) => patch(idx, { expiryDate: e.target.value })} />
              </div>
            </div>
          );
        })}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Receive into stock"}
        </Button>
      </DialogFooter>
    </form>
  );
}
