"use client";

import { use, useEffect, useMemo, useState } from "react";
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
import { DrugPicker } from "@/components/inventory/drug-picker";
import { DrugDetailsFields } from "@/components/inventory/drug-details-fields";
import { PackQuantityField } from "@/components/inventory/pack-quantity-field";
import { detailsChanged, detailsFromDrug, detailsNumbers, detailsToUpdate, type DrugDetailsForm } from "@/lib/drug-details";
import { apiErrorMessage } from "@/lib/errors";
import { formatQuantity, packInfo } from "@/lib/packs";
import { useAuthStore } from "@/store/auth.store";
import type { StockAdjustmentRequest, StockTransferRequest, UpdateDrugRequest } from "@/types";

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

  // The branch picked for adding stock is remembered on this device until it is changed, so a long
  // delivery can be entered without choosing the branch again for every drug.
  const user = useAuthStore((s) => s.user);
  const branchKey = `gene:inventory-branch:${pharmacyId}:${user?.id ?? ""}`;
  function chooseAdjustBranch(branchId: string) {
    setAdjustForm((f) => ({ ...f, branchId }));
    try {
      if (branchId) localStorage.setItem(branchKey, branchId);
      else localStorage.removeItem(branchKey);
    } catch {
      /* private mode: the choice just isn't remembered */
    }
  }

  // How the chosen drug is counted and priced; edited here and saved together with the stock entry.
  const [details, setDetails] = useState<DrugDetailsForm | null>(null);
  const [detailsDrugId, setDetailsDrugId] = useState("");

  // The search runs on the server so it covers every drug, not just the 20 on this page.
  const [stockSearch, setStockSearch] = useState("");
  const [stockTerm, setStockTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => { setStockTerm(stockSearch.trim()); setPage(0); }, 300);
    return () => clearTimeout(timer);
  }, [stockSearch]);

  const { data: stockList, isLoading } = useQuery({
    queryKey: ["inventory", pharmacyId, page, stockTerm],
    queryFn: () => inventoryApi.list(pharmacyId, { page, size: 20, search: stockTerm || undefined }),
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

  const selectedDrug = drugs?.content?.find((d) => d.id === adjustForm.drugId);

  // Fill the dosage and price fields when a drug is picked. Done once per drug, so a background refresh
  // of the drug list never wipes what is being typed.
  if (!adjustForm.drugId && detailsDrugId) {
    setDetails(null);
    setDetailsDrugId("");
  } else if (adjustForm.drugId && selectedDrug && detailsDrugId !== selectedDrug.id) {
    setDetails(detailsFromDrug(selectedDrug));
    setDetailsDrugId(selectedDrug.id);
  }

  // The remembered branch, once the list is known; forgotten if that branch was closed or removed.
  const rememberedBranchId = useMemo(() => {
    if (!branches) return "";
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(branchKey);
    } catch {
      /* ignore */
    }
    const active = branches.filter((b) => b.status === "Active");
    return (active.find((b) => b.id === saved) ?? (active.length === 1 ? active[0] : undefined))?.id ?? "";
  }, [branches, branchKey]);
  const adjustBranchId = adjustForm.branchId || rememberedBranchId;

  const detailsEdited = Boolean(details && selectedDrug && detailsChanged(details, selectedDrug));

  const adjustMutation = useMutation({
    // Dosage and price first, so the quantity is checked against the drug as it is now (e.g. halves).
    mutationFn: async ({ adjust, update }: { adjust: StockAdjustmentRequest; update: UpdateDrugRequest | null }) => {
      if (update) await drugApi.update(pharmacyId, adjust.drugId, update);
      if (adjust.adjustmentQuantity !== 0) await inventoryApi.adjust(pharmacyId, adjust);
      return { detailsSaved: update !== null, stockChanged: adjust.adjustmentQuantity !== 0 };
    },
    onSuccess: ({ detailsSaved, stockChanged }) => {
      toast.success(
        detailsSaved && stockChanged ? "Stock adjusted and drug details updated"
          : detailsSaved ? "Drug details updated"
          : "Stock adjusted successfully",
      );
      qc.invalidateQueries({ queryKey: ["inventory", pharmacyId] });
      qc.invalidateQueries({ queryKey: ["expiry"] });
      setShowAdjust(false);
      // The branch stays; everything else starts fresh for the next drug.
      setAdjustForm((f) => ({ drugId: "", branchId: f.branchId, movementType: "Adjustment", adjustmentQuantity: 0, notes: "" }));
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to adjust stock")),
    // The details may have been saved even when the stock step failed.
    onSettled: () => qc.invalidateQueries({ queryKey: ["drugs", pharmacyId] }),
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
    if (transferForm.quantity < 0.5 || !Number.isInteger(transferForm.quantity * 2)) {
      toast.error("Quantity must be at least half a unit, in whole numbers or halves");
      return;
    }
    transferMutation.mutate(transferForm);
  }

  // Expiry only makes sense for units coming in, not for removals or write-offs.
  const addingStock = adjustForm.movementType !== "Expiry" && adjustForm.adjustmentQuantity > 0;

  function openAdjustForRow(drugId: string, branchId: string) {
    setAdjustForm((f) => ({ ...f, drugId, branchId }));
    setShowAdjust(true);
  }

  // The quantity is entered in the drug as it is being edited here (a new pack size, half doses, …).
  const adjustInfo = (() => {
    if (!details) return packInfo(selectedDrug);
    const n = detailsNumbers(details);
    return {
      unit: details.unit,
      unitsPerPack: n.sellsInPacks ? n.unitsPerPack : 1,
      packUnit: n.sellsInPacks ? details.packUnit.trim() || null : null,
      halfUnit: details.allowsHalfDose,
    };
  })();

  function handleAdjustSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustForm.drugId) {
      toast.error("Choose a drug");
      return;
    }
    const changesStock = adjustForm.adjustmentQuantity !== 0;
    if (changesStock && !adjustBranchId) {
      toast.error("Choose a branch");
      return;
    }
    let update: UpdateDrugRequest | null = null;
    if (details && detailsEdited) {
      const result = detailsToUpdate(details);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      update = result.update;
    }
    if (!changesStock && !update) {
      toast.error("Enter a quantity, or change the dosage or price");
      return;
    }
    adjustMutation.mutate({
      adjust: addingStock
        ? { ...adjustForm, branchId: adjustBranchId }
        : { ...adjustForm, branchId: adjustBranchId, expiryDate: undefined, batchNumber: undefined },
      update,
    });
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
          <Button size="sm" data-guide="adjust-stock" onClick={() => setShowAdjust(true)}>
            <Package className="h-4 w-4 mr-2" />
            Adjust Stock
          </Button>
        </div>
      </div>

      {/* Adjust Stock Dialog */}
      <Dialog open={showAdjust} onOpenChange={setShowAdjust}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdjustSubmit} className="space-y-4 px-6 py-4">
            <div className="space-y-1">
              <Label htmlFor="adj-drug">Drug *</Label>
              <DrugPicker
                id="adj-drug"
                drugs={drugs?.content}
                value={adjustForm.drugId}
                onChange={(drugId) => setAdjustForm((f) => ({ ...f, drugId }))}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="adj-branch">Branch *</Label>
              <select
                id="adj-branch"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={adjustBranchId}
                onChange={(e) => chooseAdjustBranch(e.target.value)}
              >
                {!adjustBranchId && <option value="">Select branch…</option>}
                {branches?.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Remembered until you change it.</p>
            </div>

            {details && selectedDrug && (
              <DrugDetailsFields value={details} onChange={setDetails} changed={detailsEdited} />
            )}

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
                info={adjustInfo}
                value={adjustForm.adjustmentQuantity}
                onChange={(units) => setAdjustForm((f) => ({ ...f, adjustmentQuantity: units }))}
              />
            </div>

            {addingStock && (
              <div className="grid grid-cols-2 gap-3 rounded-md border border-dashed p-3">
                <div className="space-y-1">
                  <Label htmlFor="adj-expiry">Expiry date</Label>
                  <Input
                    id="adj-expiry"
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={adjustForm.expiryDate ?? ""}
                    onChange={(e) => setAdjustForm((f) => ({ ...f, expiryDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="adj-batch">Batch number</Label>
                  <Input
                    id="adj-batch"
                    placeholder="Optional"
                    value={adjustForm.batchNumber ?? ""}
                    maxLength={100}
                    onChange={(e) => setAdjustForm((f) => ({ ...f, batchNumber: e.target.value }))}
                  />
                </div>
                <p className="col-span-2 text-xs text-muted-foreground">
                  Optional. Add the expiry date printed on the pack so these units show up in the expiry alerts.
                </p>
              </div>
            )}

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
                {adjustMutation.isPending ? "Saving…" : adjustForm.adjustmentQuantity === 0 && detailsEdited ? "Save details" : "Apply Adjustment"}
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
              <DrugPicker
                id="tr-drug"
                drugs={drugs?.content}
                value={transferForm.drugId}
                onChange={(drugId) => setTransferForm((f) => ({ ...f, drugId }))}
              />
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

        <TabsContent value="stock" className="mt-4 space-y-3">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search stock by name, brand or barcode…"
              className="pl-8"
              value={stockSearch}
              onChange={(e) => setStockSearch(e.target.value)}
            />
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drug</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Stock Level</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Reorder Level</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24" />
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
                  ) : stockList?.content.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                        {stockTerm ? `No stock matches “${stockTerm}”` : "No stock records found"}
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
                        <TableCell className="tabular-nums text-sm">
                          {stock.sellingPrice == null ? "—" : (
                            <>
                              TZS {stock.sellingPrice.toLocaleString()}
                              <span className="text-xs text-muted-foreground"> / {stock.unit}</span>
                              {stock.allowsHalfDose && (
                                <div className="text-xs text-muted-foreground">
                                  ½ dose: TZS {(stock.halfDosePrice ?? stock.sellingPrice / 2).toLocaleString()}
                                </div>
                              )}
                              {stock.unitsPerPack > 1 && (
                                <div className="text-xs text-muted-foreground">
                                  {stock.packUnit ?? "pack"} of {stock.unitsPerPack}: TZS {(stock.sellingPrice * stock.unitsPerPack).toLocaleString()}
                                </div>
                              )}
                            </>
                          )}
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
