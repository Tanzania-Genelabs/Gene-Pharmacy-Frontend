"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Search } from "lucide-react";
import { catalogApi } from "@/api/catalog.api";
import { apiErrorMessage } from "@/lib/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AddFromCatalogResult, CatalogItem, CatalogKind } from "@/types";

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

interface PriceDraft {
  selling: string;
  buying: string;
  reorder: string;
}

interface CatalogPickerDialogProps {
  pharmacyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Start with this text in the search box (e.g. a barcode that was just scanned). */
  initialSearch?: string;
}

/**
 * Add drugs to a pharmacy by picking them from the shared catalog instead of typing them in.
 * Step 1: search and tick items. Step 2: enter this pharmacy's own prices. Nothing is added without a price.
 */
export function CatalogPickerDialog({ pharmacyId, open, onOpenChange, initialSearch }: CatalogPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle>Add from the catalog</DialogTitle>
          <DialogDescription>
            Pick products that are already in the system instead of typing them in. You set your own prices; stock is
            recorded separately.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every opening starts clean. */}
        <PickerBody pharmacyId={pharmacyId} initialSearch={initialSearch} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function PickerBody({ pharmacyId, initialSearch, onClose }: { pharmacyId: string; initialSearch?: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState<"choose" | "prices" | "done">("choose");
  const [searchInput, setSearchInput] = useState(initialSearch ?? "");
  const [search, setSearch] = useState(initialSearch ?? "");
  const [kind, setKind] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(0);
  // Selections survive paging and searching, so a whole shopping list can be built up.
  const [selected, setSelected] = useState<Record<string, CatalogItem>>({});
  const [prices, setPrices] = useState<Record<string, PriceDraft>>({});
  const [result, setResult] = useState<AddFromCatalogResult | null>(null);

  // Wait for a pause in typing before asking the server.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: facets } = useQuery({ queryKey: ["catalog", pharmacyId, "facets"], queryFn: () => catalogApi.facets(pharmacyId) });

  const { data, isLoading } = useQuery({
    queryKey: ["catalog", pharmacyId, search, kind, category, page],
    queryFn: () =>
      catalogApi.list(pharmacyId, {
        search: search || undefined,
        kind: (kind || undefined) as CatalogKind | undefined,
        category: category || undefined,
        page,
        size: 15,
      }),
    placeholderData: (previous) => previous,
  });

  const items = data?.content ?? [];
  const selectable = items.filter((i) => !i.alreadyAdded);
  const chosen = Object.values(selected);
  const allOnPageChosen = selectable.length > 0 && selectable.every((i) => selected[i.id]);

  function toggle(item: CatalogItem) {
    setSelected((current) => {
      const next = { ...current };
      if (next[item.id]) delete next[item.id];
      else next[item.id] = item;
      return next;
    });
  }

  function togglePage() {
    setSelected((current) => {
      const next = { ...current };
      for (const item of selectable) {
        if (allOnPageChosen) delete next[item.id];
        else next[item.id] = item;
      }
      return next;
    });
  }

  const blankDraft: PriceDraft = { selling: "", buying: "", reorder: "10" };
  const draftFor = (id: string): PriceDraft => (prices[id] as PriceDraft | undefined) ?? blankDraft;

  function setPrice(id: string, field: keyof PriceDraft, value: string) {
    setPrices((current) => ({ ...current, [id]: { ...((current[id] as PriceDraft | undefined) ?? blankDraft), [field]: value } }));
  }
  const missingPrice = chosen.filter((item) => !(Number(draftFor(item.id).selling) > 0));

  const addMutation = useMutation({
    mutationFn: () =>
      catalogApi.add(
        pharmacyId,
        chosen.map((item) => {
          const d = draftFor(item.id);
          return {
            catalogItemId: item.id,
            sellingPrice: Number(d.selling),
            buyingPrice: d.buying.trim() === "" ? undefined : Number(d.buying),
            reorderLevel: d.reorder.trim() === "" ? undefined : Number(d.reorder),
          };
        }),
      ),
    onSuccess: (outcome) => {
      setResult(outcome);
      setStep("done");
      qc.invalidateQueries({ queryKey: ["drugs", pharmacyId] });
      qc.invalidateQueries({ queryKey: ["drug-categories", pharmacyId] });
      qc.invalidateQueries({ queryKey: ["catalog", pharmacyId] });
      if (outcome.added.length > 0) toast.success(`${outcome.added.length} drug${outcome.added.length === 1 ? "" : "s"} added`);
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Could not add these drugs")),
  });

  // ───────────── step 3: result ─────────────
  if (step === "done" && result) {
    return (
      <>
        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0" />
            <div>
              <p className="font-semibold">
                {result.added.length} drug{result.added.length === 1 ? "" : "s"} added to your pharmacy
              </p>
              <p className="text-sm text-muted-foreground">
                Next, record how many you have in stock (Inventory) so they can be sold.
              </p>
            </div>
          </div>
          {result.skipped.length > 0 && (
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium mb-2">{result.skipped.length} could not be added:</p>
              <ul className="space-y-1 text-muted-foreground">
                {result.skipped.map((s) => (
                  <li key={s.catalogItemId}>
                    <span className="text-foreground">{s.name ?? "Unknown item"}</span>: {s.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter className="px-6 py-4 border-t">
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </>
    );
  }

  // ───────────── step 2: prices ─────────────
  if (step === "prices") {
    return (
      <>
        <div className="px-6 py-2 overflow-y-auto">
          <p className="text-sm text-muted-foreground mb-3">
            Enter <strong>your</strong> selling price for each product (required). Buying price and reorder level are optional.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Product</th>
                  <th className="pb-2 font-medium w-36">Selling price (TZS) *</th>
                  <th className="pb-2 font-medium w-36">Buying price (TZS)</th>
                  <th className="pb-2 font-medium w-28">Reorder level</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {chosen.map((item) => {
                  const d = draftFor(item.id);
                  return (
                    <tr key={item.id}>
                      <td className="py-2 pr-3">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.category ?? item.kind}</p>
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          inputMode="decimal"
                          aria-label={`${item.name} selling price`}
                          value={d.selling}
                          onChange={(e) => setPrice(item.id, "selling", e.target.value)}
                          className={d.selling !== "" && !(Number(d.selling) > 0) ? "border-destructive" : ""}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input type="number" min={0} step="any" inputMode="decimal" aria-label={`${item.name} buying price`} value={d.buying} onChange={(e) => setPrice(item.id, "buying", e.target.value)} />
                      </td>
                      <td className="py-2">
                        <Input type="number" min={0} step={1} aria-label={`${item.name} reorder level`} value={d.reorder} onChange={(e) => setPrice(item.id, "reorder", e.target.value)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <DialogFooter className="px-6 py-4 border-t items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {missingPrice.length > 0 ? `${missingPrice.length} still need a selling price` : `${chosen.length} ready to add`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("choose")}>Back</Button>
            <Button disabled={missingPrice.length > 0 || addMutation.isPending} onClick={() => addMutation.mutate()}>
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Add ${chosen.length} drug${chosen.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </DialogFooter>
      </>
    );
  }

  // ───────────── step 1: choose ─────────────
  return (
    <>
      <div className="px-6 pb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input autoFocus placeholder="Search by name, generic name or barcode…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="pl-8" />
        </div>
        <select aria-label="Type" value={kind} onChange={(e) => { setKind(e.target.value); setPage(0); }} className={`${selectClass} sm:w-40`}>
          <option value="">All types</option>
          {facets?.kinds.map((k) => (
            <option key={k.name} value={k.name}>{k.name} ({k.count})</option>
          ))}
        </select>
        <select aria-label="Category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(0); }} className={`${selectClass} sm:w-52`}>
          <option value="">All categories</option>
          {facets?.categories.map((c) => (
            <option key={c.name} value={c.name}>{c.name} ({c.count})</option>
          ))}
        </select>
      </div>

      <div className="px-6 overflow-y-auto min-h-48">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nothing in the catalog matches. You can still add a drug by hand with <strong>Add Drug</strong>.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 w-8">
                  <input type="checkbox" aria-label="Select all on this page" checked={allOnPageChosen} disabled={selectable.length === 0} onChange={togglePage} className="h-4 w-4" />
                </th>
                <th className="pb-2 font-medium">Product</th>
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id} className={item.alreadyAdded ? "opacity-60" : "hover:bg-muted/40"}>
                  <td className="py-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${item.name}`}
                      className="h-4 w-4"
                      checked={!!selected[item.id]}
                      disabled={!!item.alreadyAdded}
                      onChange={() => toggle(item)}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <label className="cursor-pointer">
                      <span className="font-medium">{item.name}</span>
                      {(item.manufacturer || item.barcode) && (
                        <span className="block text-xs text-muted-foreground">
                          {[item.manufacturer, item.barcode].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </label>
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{item.category ?? item.kind}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {item.alreadyAdded ? (
                      <Badge variant="secondary">Already added</Badge>
                    ) : (
                      <>
                        {item.requiresPrescription && <Badge variant="outline">Rx</Badge>}{" "}
                        {!item.verified && <span className="text-xs text-muted-foreground" title="Not yet checked by a pharmacist at Gene Pharmacy">unverified</span>}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <DialogFooter className="px-6 py-4 border-t items-center sm:justify-between">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {data && data.totalPages > 1 && (
            <>
              <Button variant="outline" size="sm" disabled={data.first} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span>Page {data.number + 1} of {data.totalPages}</span>
              <Button variant="outline" size="sm" disabled={data.last} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </>
          )}
          {data && <span className="hidden sm:inline">{data.totalElements.toLocaleString()} products</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm">{chosen.length} selected</span>
          {chosen.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setSelected({})}>Clear</Button>
          )}
          <Button disabled={chosen.length === 0} onClick={() => setStep("prices")}>Next: set prices</Button>
        </div>
      </DialogFooter>
    </>
  );
}
