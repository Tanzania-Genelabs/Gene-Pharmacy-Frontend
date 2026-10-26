"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryApi } from "@/api/inventory.api";
import { drugApi } from "@/api/drug.api";
import { branchApi } from "@/api/branch.api";
import { toast } from "sonner";
import { Search, AlertTriangle, Package, ArrowRightLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { PackQuantityField } from "@/components/inventory/pack-quantity-field";
import { formatQuantity, packInfo } from "@/lib/packs";
import type { StockAdjustmentRequest, StockTransferRequest } from "@/types";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

export default function InventoryPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [showAdjust, setShowAdjust] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const emptyTransfer: StockTransferRequest = { drugId: "", fromBranchId: "", toBranchId: "", quantity: 0, reference: "" };
  const [transferForm, setTransferForm] = useState<StockTransferRequest>(emptyTransfer);
  const [adjustForm, setAdjustForm] = useState<StockAdjustmentRequest>({
    drugId: "",
    branchId: "",
    movementType: "Adjustment",
    adjustmentQuantity: 0,
    notes: "",
  });

  const { data: stockList, isLoading } = useQuery({
    queryKey: ["inventory", pharmacyId, page],
    queryFn: () => inventoryApi.list(pharmacyId, { page, size: 20 }),
    placeholderData: (prev) => prev,
  });

  const { data: lowStock } = useQuery({
    queryKey: ["inventory", "low-stock", pharmacyId],
    queryFn: () => inventoryApi.lowStock(pharmacyId),
  });

  const { data: movements } = useQuery({
    queryKey: ["inventory", "movements", pharmacyId, page],
    queryFn: () => inventoryApi.getMovements(pharmacyId, { page, size: 20 }),
  });

  const { data: drugs } = useQuery({
    queryKey: ["drugs", pharmacyId, "all"],
    queryFn: () => drugApi.list(pharmacyId, { size: 500 }),
    enabled: showAdjust || showTransfer,
  });

  const { data: branches } = useQuery({
    queryKey: ["branches", pharmacyId],
    queryFn: () => branchApi.list(pharmacyId),
    enabled: showAdjust || showTransfer,
  });

  const adjustMutation = useMutation({
    mutationFn: (data: StockAdjustmentRequest) => inventoryApi.adjust(pharmacyId, data),
    onSuccess: () => {
      toast.success("Stock adjusted successfully");
      qc.invalidateQueries({ queryKey: ["inventory", pharmacyId] });
      setShowAdjust(false);
      setAdjustForm({ drugId: "", branchId: "", movementType: "Adjustment", adjustmentQuantity: 0, notes: "" });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to adjust stock");
    },
  });

  const transferMutation = useMutation({
    mutationFn: (data: StockTransferRequest) =>
      inventoryApi.transfer(pharmacyId, { ...data, reference: data.reference?.trim() || undefined }),
    onSuccess: () => {
      toast.success("Stock transferred successfully");
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setShowTransfer(false);
      setTransferForm(emptyTransfer);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to transfer stock");
    },
  });

  function handleTransferSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!transferForm.drugId || !transferForm.fromBranchId || !transferForm.toBranchId) {
      toast.error("Drug, source branch and destination branch are required");
      return;
    }
    if (transferForm.fromBranchId === transferForm.toBranchId) {
      toast.error("Source and destination branch must differ");
      return;
    }
    if (!Number.isInteger(transferForm.quantity) || transferForm.quantity < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }
    transferMutation.mutate(transferForm);
  }

  function openAdjustForRow(drugId: string, branchId: string) {
    setAdjustForm((f) => ({ ...f, drugId, branchId }));
    setShowAdjust(true);
  }

  function handleAdjustSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustForm.drugId || !adjustForm.branchId) {
      toast.error("Drug and branch are required");
      return;
    }
    if (adjustForm.adjustmentQuantity === 0) {
      toast.error("Quantity cannot be zero");
      return;
    }
    adjustMutation.mutate(adjustForm);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Inventory</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {stockList?.totalElements ?? 0} stock records
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowTransfer(true)}>
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Transfer Stock
          </Button>
          <Button size="sm" onClick={() => setShowAdjust(true)}>
            <Package className="h-4 w-4 mr-2" />
            Adjust Stock
          </Button>
        </div>
      </div>

      {/* Adjust Stock Dialog */}
      <Dialog open={showAdjust} onOpenChange={setShowAdjust}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdjustSubmit} className="space-y-4 px-6 py-4">
            <div className="space-y-1">
              <Label htmlFor="adj-drug">Drug *</Label>
              <select
                id="adj-drug"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={adjustForm.drugId}
                onChange={(e) => setAdjustForm((f) => ({ ...f, drugId: e.target.value }))}
              >
                <option value="">Select drug…</option>
                {drugs?.content?.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="adj-branch">Branch *</Label>
              <select
                id="adj-branch"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={adjustForm.branchId}
                onChange={(e) => setAdjustForm((f) => ({ ...f, branchId: e.target.value }))}
              >
                <option value="">Select branch…</option>
                {branches?.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="adj-type">Adjustment Type *</Label>
              <select
                id="adj-type"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={adjustForm.movementType}
                onChange={(e) =>
                  setAdjustForm((f) => ({
                    ...f,
                    movementType: e.target.value as StockAdjustmentRequest["movementType"],
                  }))
                }
              >
                <option value="Adjustment">Manual Adjustment</option>
                <option value="Expiry">Write-off (Expiry / Damage)</option>
                <option value="Return">Customer / Supplier Return</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="adj-qty">
                Quantity{" "}
                <span className="text-muted-foreground font-normal text-xs">
                  (positive = add, negative = remove)
                </span>
              </Label>
              <PackQuantityField
                key={adjustForm.drugId}
                id="adj-qty"
                allowNegative
                placeholder="e.g. 50 or -10"
                info={packInfo(drugs?.content?.find((d) => d.id === adjustForm.drugId))}
                value={adjustForm.adjustmentQuantity}
                onChange={(units) => setAdjustForm((f) => ({ ...f, adjustmentQuantity: units }))}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="adj-notes">Notes</Label>
              <Input
                id="adj-notes"
                placeholder="Optional reason for adjustment…"
                value={adjustForm.notes ?? ""}
                onChange={(e) => setAdjustForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAdjust(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={adjustMutation.isPending}>
                {adjustMutation.isPending ? "Saving…" : "Apply Adjustment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Transfer Stock Dialog */}
      <Dialog open={showTransfer} onOpenChange={setShowTransfer}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Stock</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTransferSubmit} className="space-y-4 px-6 py-4">
            <div className="space-y-1">
              <Label htmlFor="tr-drug">Drug *</Label>
              <select
                id="tr-drug"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={transferForm.drugId}
                onChange={(e) => setTransferForm((f) => ({ ...f, drugId: e.target.value }))}
              >
                <option value="">Select drug…</option>
                {drugs?.content?.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="tr-from">From branch *</Label>
              <select
                id="tr-from"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={transferForm.fromBranchId}
                onChange={(e) => setTransferForm((f) => ({ ...f, fromBranchId: e.target.value }))}
              >
                <option value="">Select source branch…</option>
                {branches?.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="tr-to">To branch *</Label>
              <select
                id="tr-to"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={transferForm.toBranchId}
                onChange={(e) => setTransferForm((f) => ({ ...f, toBranchId: e.target.value }))}
              >
                <option value="">Select destination branch…</option>
                {branches?.filter((b) => b.id !== transferForm.fromBranchId).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="tr-qty">Quantity *</Label>
              <PackQuantityField
                key={transferForm.drugId}
                id="tr-qty"
                placeholder="e.g. 20"
                info={packInfo(drugs?.content?.find((d) => d.id === transferForm.drugId))}
                value={transferForm.quantity}
                onChange={(units) => setTransferForm((f) => ({ ...f, quantity: units }))}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="tr-ref">Reference</Label>
              <Input
                id="tr-ref"
                placeholder="Optional reference or note…"
                value={transferForm.reference ?? ""}
                onChange={(e) => setTransferForm((f) => ({ ...f, reference: e.target.value }))}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowTransfer(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={transferMutation.isPending}>
                {transferMutation.isPending ? "Transferring…" : "Transfer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Low stock summary */}
      {lowStock && lowStock.totalElements > 0 && (
        <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {lowStock.totalElements} items are below reorder level
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStock.content.slice(0, 6).map((item) => (
                <Badge key={`${item.drugId}-${item.branchId}`} variant="outline" className="border-orange-300 dark:border-orange-700">
                  {item.drugName}: {formatQuantity(item.currentStock, packInfo(item))} left
                </Badge>
              ))}
              {lowStock.totalElements > 6 && (
                <Badge variant="outline" className="border-orange-300">
                  +{lowStock.totalElements - 6} more
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Current Stock</TabsTrigger>
          <TabsTrigger value="movements">Stock Movements</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drug</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Stock Level</TableHead>
                    <TableHead>Reorder Level</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j}>
                            <div className="h-4 w-full bg-muted animate-pulse rounded" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : stockList?.content.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                        No stock records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    stockList?.content.map((stock) => (
                      <TableRow key={stock.id}>
                        <TableCell className="font-medium">{stock.drugName}</TableCell>
                        <TableCell className="text-muted-foreground">{stock.branchName}</TableCell>
                        <TableCell className="tabular-nums font-semibold">
                          {formatQuantity(stock.quantity, packInfo(stock))}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {stock.reorderLevel} {stock.unit}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              stock.quantity <= stock.reorderLevel
                                ? "destructive"
                                : "default"
                            }
                          >
                            {stock.quantity <= stock.reorderLevel ? "Low" : "OK"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => openAdjustForRow(stock.drugId, stock.branchId)}
                          >
                            Adjust
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {stockList && stockList.totalPages > 1 && (
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" disabled={stockList.first} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={stockList.last} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="movements" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drug</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Performed By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements?.content.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                        No movements recorded yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    movements?.content.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.drugName}</TableCell>
                        <TableCell>
                          <Badge variant={m.quantityChange > 0 ? "default" : "secondary"}>
                            {m.quantityChange > 0 ? "IN" : "OUT"}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">{m.quantity}</TableCell>
                        <TableCell className="text-muted-foreground">{m.referenceNumber ?? "—"}</TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {new Date(m.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{m.performedBy}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
