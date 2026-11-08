"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { inventoryApi } from "@/api/inventory.api";
import { insightsApi } from "@/api/insights.api";
import { money } from "@/components/expenses/format";
import { drugApi } from "@/api/drug.api";
import { branchApi } from "@/api/branch.api";
import { toast } from "sonner";
import {
  Search, AlertTriangle, Package, ArrowRightLeft, Boxes, PackageX, TrendingDown, Wallet, CalendarClock, ChevronDown,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { StockAdjustmentRequest, StockResponse, StockStatusFilter, StockTransferRequest, UpdateDrugRequest } from "@/types";

const STATUS_CHIPS: { value: StockStatusFilter | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "low", label: "Low" },
  { value: "out", label: "Out of stock" },
  { value: "ok", label: "OK" },
];

/** Same rules as the server's status filter: out = empty, low = at/under the reorder level, otherwise OK. */
function stockStatus(stock: Pick<StockResponse, "quantity" | "reorderLevel">): StockStatusFilter {
  if (stock.quantity <= 0) return "out";
  if (stock.quantity <= stock.reorderLevel) return "low";
  return "ok";
}

function StatusBadge({ status }: { status: StockStatusFilter }) {
  const style = {
    out: "bg-red-600 text-white",
    low: "bg-amber-500 text-white",
    ok: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
  }[status];
  const label = { out: "Out of stock", low: "Low", ok: "OK" }[status];
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", style)}>{label}</span>;
}

function fmtUnits(n: number | string) {
  const v = Number(n);
  return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1);
}

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

  // What the stock table and the numbers above it are about: one branch or all of them, and a status.
  const [viewBranchId, setViewBranchId] = useState("");
  // A status can be opened from a link, e.g. ?status=low from the dashboard.
  const statusParam = useSearchParams().get("status");
  const [statusFilter, setStatusFilter] = useState<StockStatusFilter | "">(
    statusParam === "low" || statusParam === "out" || statusParam === "ok" ? statusParam : "",
  );
  const [invTab, setInvTab] = useState("stock");
  function chooseStatus(status: StockStatusFilter | "") {
    setStatusFilter(status);
    setPage(0);
  }
  /** From a number card: filter the table and bring it into view. */
  function showStatus(status: StockStatusFilter | "") {
    chooseStatus(status);
    setInvTab("stock");
    document.getElementById("stock-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const { data: stockList, isLoading } = useQuery({
    queryKey: ["inventory", pharmacyId, page, stockTerm, statusFilter, viewBranchId],
    queryFn: () =>
      inventoryApi.list(pharmacyId, {
        page,
        size: 20,
        search: stockTerm || undefined,
        status: statusFilter || undefined,
        branchId: viewBranchId || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const { data: insights, isError: insightsError } = useQuery({
    queryKey: ["inventory", pharmacyId, "insights", viewBranchId],
    queryFn: () => insightsApi.inventoryInsights(pharmacyId, { branchId: viewBranchId || undefined }),
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Inventory</h2>
          <p className="text-muted-foreground text-sm mt-1">
            How much stock you have, what it is worth, and what to buy next.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Branch"
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={viewBranchId}
            onChange={(e) => { setViewBranchId(e.target.value); setPage(0); }}
          >
            <option value="">All branches</option>
            {branches?.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
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

      {/* ── Stock at a glance ─────────────────────────────────────────── */}
      {insightsError && (
        <p className="text-sm text-red-600">Could not load the stock numbers. Check your connection and try again.</p>
      )}
      {insights && (
        <section className="space-y-4">
          {(insights.missingBuyingPrice > 0 || insights.missingSellingPrice > 0) && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-0.5">
                {insights.missingBuyingPrice > 0 && (
                  <p>
                    <strong>{insights.missingBuyingPrice}</strong> product{insights.missingBuyingPrice === 1 ? " has" : "s have"} no
                    buying price — profit numbers will be wrong.
                  </p>
                )}
                {insights.missingSellingPrice > 0 && (
                  <p>
                    <strong>{insights.missingSellingPrice}</strong> product{insights.missingSellingPrice === 1 ? " has" : "s have"} no
                    selling price — the &quot;value if all sold&quot; is too low.
                  </p>
                )}
                <p className="text-xs opacity-80">Add the prices on the Drugs page, or with &quot;Adjust&quot; in the table below.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <button type="button" onClick={() => showStatus("")} className="text-left">
              <Card className="h-full transition-colors hover:border-primary">
                <CardContent className="p-4">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Boxes className="h-3.5 w-3.5" />Products in stock</p>
                  <p className="text-2xl font-bold tabular-nums">{insights.inStock.toLocaleString()}</p>
                  <p className="text-[11px] text-muted-foreground">
                    of {insights.products.toLocaleString()} products · {fmtUnits(insights.totalUnits)} units in total
                  </p>
                </CardContent>
              </Card>
            </button>
            <button type="button" onClick={() => showStatus("low")} className="text-left">
              <Card className={cn("h-full transition-colors hover:border-primary", insights.lowStock > 0 && "border-amber-300 dark:border-amber-800")}>
                <CardContent className="p-4">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><TrendingDown className="h-3.5 w-3.5" />Low stock</p>
                  <p className={cn("text-2xl font-bold tabular-nums", insights.lowStock > 0 && "text-amber-600")}>{insights.lowStock}</p>
                  <p className="text-[11px] text-muted-foreground">At or under the reorder level · tap to see</p>
                </CardContent>
              </Card>
            </button>
            <button type="button" onClick={() => showStatus("out")} className="text-left">
              <Card className={cn("h-full transition-colors hover:border-primary", insights.outOfStock > 0 && "border-red-300 dark:border-red-800")}>
                <CardContent className="p-4">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><PackageX className="h-3.5 w-3.5" />Out of stock</p>
                  <p className={cn("text-2xl font-bold tabular-nums", insights.outOfStock > 0 && "text-red-600")}>{insights.outOfStock}</p>
                  <p className="text-[11px] text-muted-foreground">None left to sell · tap to see</p>
                </CardContent>
              </Card>
            </button>
            <Link href={`/${pharmacyId}/expiry`} className="text-left">
              <Card className={cn("h-full transition-colors hover:border-primary", (insights.expired.batches > 0 || insights.expiringSoon.batches > 0) && "border-orange-300 dark:border-orange-800")}>
                <CardContent className="p-4">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" />Expiring in {insights.expiringSoon.days} days</p>
                  <p className={cn("text-2xl font-bold tabular-nums", insights.expiringSoon.batches > 0 && "text-orange-600")}>
                    {insights.expiringSoon.batches} <span className="text-sm font-normal text-muted-foreground">batch{insights.expiringSoon.batches === 1 ? "" : "es"}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">Worth {money(insights.expiringSoon.costValue)} at cost</p>
                  <p className={cn("text-[11px]", insights.expired.batches > 0 ? "font-medium text-red-600" : "text-muted-foreground")}>
                    Already expired: {insights.expired.batches} ({money(insights.expired.costValue)})
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wallet className="h-3.5 w-3.5" />Stock value (what you paid)</p>
                <p className="text-xl font-bold tabular-nums">{money(insights.costValue)}</p>
                <p className="text-[11px] text-muted-foreground">Everything on the shelf at its buying price</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Value if all sold</p>
                <p className="text-xl font-bold tabular-nums">{money(insights.retailValue)}</p>
                <p className="text-[11px] text-muted-foreground">Everything on the shelf at its selling price</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Expected profit</p>
                <p className={cn("text-xl font-bold tabular-nums", Number(insights.expectedProfit) < 0 ? "text-red-600" : "text-emerald-600")}>
                  {money(insights.expectedProfit)}
                </p>
                <p className="text-[11px] text-muted-foreground">Value if all sold − stock value</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Running out soon</CardTitle>
                <p className="text-xs text-muted-foreground">Based on how fast each drug sold recently. Buy these first.</p>
              </CardHeader>
              <CardContent>
                {insights.runningOut.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing is about to run out.</p>
                ) : (
                  <ul className="divide-y">
                    {insights.runningOut.map((r) => (
                      <li key={r.drugId} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2 text-sm">
                        <span className="font-medium">{r.drugName}</span>
                        <span className="text-muted-foreground">
                          <span className="font-semibold text-foreground">{fmtUnits(r.quantity)}</span> {r.unit ?? ""} left
                          {" · "}sells ~{fmtUnits(Number(Number(r.soldPerDay).toFixed(1)))}/day
                          {r.daysLeft != null && (
                            <>
                              {" · "}
                              <span className={cn("font-semibold", Number(r.daysLeft) <= 3 ? "text-red-600" : "text-amber-600")}>
                                ~{Math.max(0, Math.floor(Number(r.daysLeft)))} day{Math.floor(Number(r.daysLeft)) === 1 ? "" : "s"} left
                              </span>
                            </>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Biggest stock value</CardTitle>
                <p className="text-xs text-muted-foreground">Where most of your money is sitting on the shelf.</p>
              </CardHeader>
              <CardContent>
                {insights.topValue.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No stock yet.</p>
                ) : (
                  <ul className="divide-y">
                    {insights.topValue.map((r) => (
                      <li key={r.drugId} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2 text-sm">
                        <span className="font-medium">
                          {r.drugName}{" "}
                          <span className="text-xs font-normal text-muted-foreground">{fmtUnits(r.quantity)} {r.unit ?? ""}</span>
                        </span>
                        <span className="tabular-nums">
                          <span className="font-semibold">{money(r.costValue)}</span>
                          <span className="text-xs text-muted-foreground"> · sells for {money(r.retailValue)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {insights.categories.length > 0 && (
            <details className="group rounded-xl border bg-card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-medium">
                <span>Stock by category ({insights.categories.length})</span>
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-4 pb-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Products</TableHead>
                      <TableHead className="text-right">Low or out</TableHead>
                      <TableHead className="text-right">Value (what you paid)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {insights.categories.map((c) => (
                      <TableRow key={c.category ?? "none"}>
                        <TableCell className="font-medium">{c.category ?? "No category"}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.products}</TableCell>
                        <TableCell className={cn("text-right tabular-nums", c.lowOrOut > 0 && "font-semibold text-amber-600")}>{c.lowOrOut}</TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">{money(c.costValue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </details>
          )}
        </section>
      )}

      <Tabs value={invTab} onValueChange={setInvTab} id="stock-table" className="scroll-mt-4">
        <TabsList>
          <TabsTrigger value="stock">Current Stock</TabsTrigger>
          <TabsTrigger value="movements">Stock Movements</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search stock by name, brand or barcode…"
                className="pl-8"
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_CHIPS.map((c) => (
                <button
                  key={c.value || "all"}
                  type="button"
                  onClick={() => chooseStatus(c.value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                    statusFilter === c.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background text-muted-foreground hover:border-primary hover:text-foreground",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {stockList?.totalElements ?? 0} stock record{stockList?.totalElements === 1 ? "" : "s"}
            {statusFilter && ` · showing only "${STATUS_CHIPS.find((c) => c.value === statusFilter)?.label}"`}
          </p>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drug</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>In stock</TableHead>
                    <TableHead>Selling price</TableHead>
                    <TableHead>Reorder at</TableHead>
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
                        {stockTerm ? `No stock matches “${stockTerm}”` : statusFilter ? "Nothing here — good news" : "No stock records found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    stockList?.content.map((stock) => (
                      <TableRow key={stock.id}>
                        <TableCell className="font-medium">{stock.drugName}</TableCell>
                        <TableCell className="text-muted-foreground">{stock.branchName}</TableCell>
                        <TableCell className="tabular-nums font-semibold whitespace-nowrap">
                          {formatQuantity(stock.quantity, packInfo(stock))}
                          {stock.unitsPerPack > 1 && (
                            <div className="text-xs font-normal text-muted-foreground">= {fmtUnits(stock.quantity)} {stock.unit}</div>
                          )}
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
                          <StatusBadge status={stockStatus(stock)} />
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
