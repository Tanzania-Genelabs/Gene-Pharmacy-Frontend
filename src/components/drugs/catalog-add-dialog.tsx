"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Search } from "lucide-react";
import { catalogApi } from "@/api/catalog.api";
import { drugApi } from "@/api/drug.api";
import { branchApi } from "@/api/branch.api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiErrorMessage } from "@/lib/errors";
import { useDebounced } from "@/lib/use-debounced";
import { selectClass, skipReasonLabel } from "./format";
import type { CatalogItem, FromCatalogResult } from "@/types";

const MAX_ITEMS = 100;

export const newForMeKey = (pharmacyId: string) => ["drugs", pharmacyId, "catalog-new-for-me"] as const;

interface CatalogAddDialogProps {
  pharmacyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Open the older picker where each item gets its own price. */
  onPickPerItem: () => void;
  /** Added without a price: jump to the list of drugs with no selling price. */
  onFillPrices: () => void;
}

export function CatalogAddDialog({ pharmacyId, open, onOpenChange, onPickPerItem, onFillPrices }: CatalogAddDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle>Add from the shared catalog</DialogTitle>
          <DialogDescription>
            Medicines already in the system that you don&apos;t have yet. Tick the ones you sell and add them in one go.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <Body
            pharmacyId={pharmacyId}
            onClose={() => onOpenChange(false)}
            onPickPerItem={() => { onOpenChange(false); onPickPerItem(); }}
            onFillPrices={() => { onOpenChange(false); onFillPrices(); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Body({ pharmacyId, onClose, onPickPerItem, onFillPrices }: { pharmacyId: string; onClose: () => void; onPickPerItem: () => void; onFillPrices: () => void }) {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim(), 300);
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Record<string, CatalogItem>>({});
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [branchChoice, setBranchChoice] = useState("");
  const [result, setResult] = useState<FromCatalogResult | null>(null);

  const { data: facets } = useQuery({ queryKey: ["catalog", pharmacyId, "facets"], queryFn: () => catalogApi.facets(pharmacyId) });
  const { data: branches } = useQuery({ queryKey: ["branches", pharmacyId], queryFn: () => branchApi.list(pharmacyId) });
  const activeBranches = (branches ?? []).filter((b) => b.status === "Active");
  const branchId = branchChoice || (activeBranches.length === 1 ? activeBranches[0].id : "");

  const { data, isLoading } = useQuery({
    queryKey: [...newForMeKey(pharmacyId), search, category, page],
    queryFn: () => catalogApi.newForMe(pharmacyId, { search: search || undefined, category: category || undefined, page, size: 20 }),
    placeholderData: (prev) => prev,
  });

  const items = data?.content ?? [];
  const chosen = Object.values(selected);
  const allOnPage = items.length > 0 && items.every((i) => selected[i.id]);
  const priceNum = Number(price);
  const qtyNum = Number(quantity);
  const priceOk = price.trim() === "" || (Number.isFinite(priceNum) && priceNum > 0);
  const qtyOk = quantity.trim() === "" || (Number.isInteger(qtyNum) && qtyNum >= 0);
  const needsBranch = quantity.trim() !== "" && qtyNum > 0 && !branchId;

  function toggle(item: CatalogItem) {
    setSelected((cur) => {
      const next = { ...cur };
      if (next[item.id]) delete next[item.id];
      else next[item.id] = item;
      return next;
    });
  }
  function togglePage() {
    setSelected((cur) => {
      const next = { ...cur };
      for (const i of items) {
        if (allOnPage) delete next[i.id];
        else next[i.id] = i;
      }
      return next;
    });
  }

  const add = useMutation({
    mutationFn: () =>
      drugApi.fromCatalog(pharmacyId, {
        catalogItemIds: chosen.map((c) => c.id),
        sellingPrice: price.trim() === "" ? undefined : priceNum,
        initial: quantity.trim() !== "" && qtyNum > 0 && branchId ? { branchId, quantity: qtyNum } : undefined,
      }),
    onSuccess: (res) => {
      setResult(res);
      setSelected({});
      qc.invalidateQueries({ queryKey: ["drugs", pharmacyId] });
      qc.invalidateQueries({ queryKey: ["inventory", pharmacyId] });
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Could not add these medicines")),
  });

  if (result) {
    const noPrice = price.trim() === "" && result.created.length > 0;
    return (
      <div className="px-6 pb-6 space-y-3 overflow-y-auto">
        <p className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5" /> Added {result.created.length} medicine{result.created.length === 1 ? "" : "s"}.
        </p>
        {noPrice && (
          <p className="rounded-md border border-amber-400/50 bg-amber-500/10 p-3 text-sm">
            They were added <strong>switched off with no price</strong>, so they don&apos;t show at the till yet. Give them a
            selling price to switch them on.
          </p>
        )}
        {result.skipped > 0 && (
          <div className="text-sm">
            <p className="text-muted-foreground">Skipped {result.skipped}:</p>
            <ul className="mt-1 max-h-40 overflow-y-auto space-y-0.5">
              {result.skippedItems.map((s) => (
                <li key={s.catalogItemId}>{s.name ?? "One item"}: {s.message || skipReasonLabel(s.reason)}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => setResult(null)}>Add more</Button>
          {noPrice ? <Button onClick={onFillPrices}>Set their prices now</Button> : <Button onClick={onClose}>Done</Button>}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="px-6 pb-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, brand or barcode"
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setPage(0); }}
          />
        </div>
        <select
          aria-label="Catalog category"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(0); }}
        >
          <option value="">All categories</option>
          {facets?.categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto border-y px-6 py-2 min-h-[200px]">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nothing new to add here. You already have these.</p>
        ) : (
          <>
            <label className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
              <input type="checkbox" className="h-4 w-4" checked={allOnPage} onChange={togglePage} />
              Tick all on this page
            </label>
            <ul className="divide-y">
              {items.map((i) => (
                <li key={i.id}>
                  <label className="flex cursor-pointer items-start gap-3 py-2">
                    <input type="checkbox" className="mt-1 h-4 w-4" checked={!!selected[i.id]} onChange={() => toggle(i)} />
                    <span className="min-w-0">
                      <span className="font-medium">{i.brand || i.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {[i.brand ? i.name : null, i.genericName, i.strength, i.form, i.category].filter(Boolean).join(" · ")}
                        {i.requiresPrescription ? " · prescription" : ""}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-2 text-xs text-muted-foreground">
          <span>Page {page + 1} of {data.totalPages} · {data.total.toLocaleString()} new</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={data.first} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={data.last} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      <div className="px-6 py-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="fc-price">Selling price (optional)</Label>
          <Input id="fc-price" type="number" min={0} step="any" inputMode="decimal" placeholder="TZS" value={price} onChange={(e) => setPrice(e.target.value)} />
          <p className="text-[11px] text-muted-foreground">One price for all ticked. Empty = added switched off until priced.</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="fc-qty">Opening stock (optional)</Label>
          <Input id="fc-qty" type="number" min={0} step={1} placeholder="units each" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <p className="text-[11px] text-muted-foreground">Units of each medicine you have now.</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="fc-branch">Branch for the stock</Label>
          <select id="fc-branch" className={selectClass} value={branchId} onChange={(e) => setBranchChoice(e.target.value)}>
            <option value="">Choose…</option>
            {activeBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      <DialogFooter className="items-center gap-2 border-t">
        <button type="button" className="text-xs text-primary underline-offset-2 hover:underline sm:mr-auto" onClick={onPickPerItem}>
          Set a different price for each item instead
        </button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          disabled={chosen.length === 0 || chosen.length > MAX_ITEMS || !priceOk || !qtyOk || needsBranch || add.isPending}
          onClick={() => add.mutate()}
        >
          {add.isPending ? "Adding…" : `Add ${chosen.length} medicine${chosen.length === 1 ? "" : "s"}`}
        </Button>
      </DialogFooter>
      {(chosen.length > MAX_ITEMS || !priceOk || !qtyOk || needsBranch) && (
        <p className="px-6 pb-3 -mt-2 text-xs text-red-600 text-right">
          {chosen.length > MAX_ITEMS
            ? `Add at most ${MAX_ITEMS} at a time.`
            : !priceOk
              ? "The price must be above 0, or empty."
              : !qtyOk
                ? "Opening stock must be a whole number."
                : "Choose the branch for the opening stock."}
        </p>
      )}
    </>
  );
}
