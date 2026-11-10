"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Copy } from "lucide-react";
import { drugApi } from "@/api/drug.api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiErrorMessage } from "@/lib/errors";
import { UNIT_OPTIONS } from "@/lib/drug-units";
import { useDebounced } from "@/lib/use-debounced";
import { money } from "@/components/expenses/format";
import { DUPLICATE_REASONS, selectClass } from "./format";
import type { CategoryResponse, CreateDrugRequest, DrugResponse, PriceMode, UpdateDrugRequest } from "@/types";

/** Form fields are text so they can be emptied while typing; they are converted on submit. */
interface DrugForm {
  /** A service (injection, wound dressing...) has no stock, packs or doses. */
  isService: boolean;
  /** Services only: the saved price is filled in at the till, or the seller types it when selling. */
  priceMode: PriceMode;
  name: string;
  brand: string;
  genericName: string;
  barcode: string;
  categoryId: string;
  unit: string;
  unitsPerPack: string;
  packUnit: string;
  sellingPrice: string;
  allowsHalfDose: boolean;
  /** Empty means half of the selling price; type a higher number to add something on top. */
  halfDosePrice: string;
  buyingPrice: string;
  reorderLevel: string;
  requiresPrescription: boolean;
}

const emptyForm = (): DrugForm => ({
  isService: false, priceMode: "Fixed",
  name: "", brand: "", genericName: "", barcode: "", categoryId: "", unit: "tablet",
  unitsPerPack: "1", packUnit: "",
  sellingPrice: "", allowsHalfDose: false, halfDosePrice: "", buyingPrice: "", reorderLevel: "10", requiresPrescription: false,
});

const formFromDrug = (drug: DrugResponse): DrugForm => ({
  isService: drug.isService ?? false,
  priceMode: drug.priceMode ?? "Fixed",
  name: drug.name,
  brand: drug.brand ?? "",
  genericName: drug.genericName ?? "",
  barcode: drug.barcode ?? "",
  categoryId: drug.categoryId ?? "",
  unit: drug.unit,
  unitsPerPack: String(drug.unitsPerPack ?? 1),
  packUnit: drug.packUnit ?? "",
  sellingPrice: String(drug.sellingPrice),
  allowsHalfDose: drug.allowsHalfDose ?? false,
  halfDosePrice: drug.halfDosePrice == null ? "" : String(drug.halfDosePrice),
  buyingPrice: drug.buyingPrice === null ? "" : String(drug.buyingPrice),
  reorderLevel: String(drug.reorderLevel),
  requiresPrescription: drug.requiresPrescription,
});

interface DrugFormDialogProps {
  pharmacyId: string;
  open: boolean;
  /** The drug being changed, or null when adding a new one. */
  editing: DrugResponse | null;
  categories: CategoryResponse[];
  onClose: () => void;
  /** "This looks like one you already have": open that drug instead. */
  onOpenExisting: (drugId: string) => void;
}

export function DrugFormDialog({ pharmacyId, open, editing, categories, onClose, onOpenExisting }: DrugFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.name}` : "Add Drug or Service"}</DialogTitle>
        </DialogHeader>
        {/* Mounted per drug, so each opening starts from that drug's values. */}
        {open && (
          <DrugFormBody
            key={editing?.id ?? "new"}
            pharmacyId={pharmacyId}
            editing={editing}
            categories={categories}
            onClose={onClose}
            onOpenExisting={onOpenExisting}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DrugFormBody({ pharmacyId, editing, categories, onClose, onOpenExisting }: Omit<DrugFormDialogProps, "open">) {
  const qc = useQueryClient();
  const [form, setForm] = useState<DrugForm>(() => (editing ? formFromDrug(editing) : emptyForm()));
  const activeCategories = categories.filter((c) => c.active || c.id === form.categoryId);

  // Warn (never block) when a new drug looks like one already in the list.
  const name = useDebounced(form.name.trim(), 400);
  const brand = useDebounced(form.brand.trim(), 400);
  const barcode = useDebounced(form.barcode.trim(), 400);
  const { data: similar } = useQuery({
    queryKey: ["drugs", pharmacyId, "similar", name, brand, barcode],
    queryFn: () => drugApi.similar(pharmacyId, { name: name || undefined, brand: brand || undefined, barcode: barcode || undefined }),
    enabled: !editing && (name.length >= 3 || brand.length >= 3 || barcode.length >= 3),
    staleTime: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: { create?: CreateDrugRequest; update?: UpdateDrugRequest }) =>
      editing && payload.update
        ? drugApi.update(pharmacyId, editing.id, payload.update)
        : drugApi.create(pharmacyId, payload.create!),
    onSuccess: (saved) => {
      toast.success(editing ? `${saved.name} updated` : saved.isService ? "Service added successfully" : "Drug added successfully");
      qc.invalidateQueries({ queryKey: ["drugs", pharmacyId] });
      onClose();
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, editing ? "Failed to update drug" : "Failed to add drug")),
  });

  const selling = Number(form.sellingPrice);
  const buying = form.buyingPrice.trim() === "" ? null : Number(form.buyingPrice);
  const unitsPerPack = Number(form.unitsPerPack);
  const sellsInPacks = Number.isInteger(unitsPerPack) && unitsPerPack > 1;
  const halfDosePrice = form.halfDosePrice.trim() === "" ? selling / 2 : Number(form.halfDosePrice);
  const sellsBelowCost = buying !== null && Number.isFinite(selling) && Number.isFinite(buying) && selling < buying;

  const typedAtTill = form.isService && form.priceMode === "Manual";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // A service is only a name, a price (fixed, or typed when selling) and an optional cost of its materials.
    if (form.isService) {
      if (!form.name.trim()) {
        toast.error("Service name is required");
        return;
      }
      const hasPrice = form.sellingPrice.trim() !== "";
      if (!typedAtTill && (!hasPrice || !Number.isFinite(selling) || selling < 0)) {
        toast.error("Enter the price of this service");
        return;
      }
      if (hasPrice && (!Number.isFinite(selling) || selling < 0)) {
        toast.error("The suggested price must be 0 or more");
        return;
      }
      if (buying !== null && (!Number.isFinite(buying) || buying < 0)) {
        toast.error("The cost must be 0 or more (or left empty)");
        return;
      }
      const price = hasPrice ? selling : 0;
      if (editing) {
        saveMutation.mutate({
          update: {
            name: form.name.trim(),
            priceMode: form.priceMode,
            sellingPrice: price,
            buyingPrice: buying,
            barcode: form.barcode.trim() || null,
            categoryId: form.categoryId || null,
          },
        });
      } else {
        saveMutation.mutate({
          create: {
            isService: true,
            priceMode: form.priceMode,
            name: form.name.trim(),
            sellingPrice: hasPrice ? selling : undefined,
            buyingPrice: buying ?? undefined,
            barcode: form.barcode.trim() || undefined,
            categoryId: form.categoryId || undefined,
          },
        });
      }
      return;
    }

    if (!form.name.trim() || !form.unit.trim()) {
      toast.error("Drug name and unit are required");
      return;
    }
    if (form.sellingPrice.trim() === "" || !Number.isFinite(selling) || selling < 0) {
      toast.error("Enter a selling price of 0 or more");
      return;
    }
    if (buying !== null && (!Number.isFinite(buying) || buying < 0)) {
      toast.error("The buying price must be 0 or more (or left empty)");
      return;
    }
    if (form.unitsPerPack.trim() === "" || !Number.isInteger(unitsPerPack) || unitsPerPack < 1) {
      toast.error("Units per pack must be a whole number, 1 or more");
      return;
    }
    if (form.allowsHalfDose && (!Number.isFinite(halfDosePrice) || halfDosePrice <= 0)) {
      toast.error("Enter a half-dose price above 0, or leave it empty for half of the selling price");
      return;
    }
    const reorder = Number(form.reorderLevel);
    if (form.reorderLevel.trim() === "" || !Number.isInteger(reorder) || reorder < 0) {
      toast.error("The reorder level must be a whole number, 0 or more");
      return;
    }

    const common = {
      name: form.name.trim(),
      unit: form.unit,
      unitsPerPack,
      sellingPrice: selling,
      allowsHalfDose: form.allowsHalfDose,
      halfDosePrice: form.allowsHalfDose ? halfDosePrice : null,
      reorderLevel: reorder,
      requiresPrescription: form.requiresPrescription,
    };

    if (editing) {
      // Optional details are sent as null when emptied, which clears them on the server.
      saveMutation.mutate({
        update: {
          ...common,
          brand: form.brand.trim() || null,
          genericName: form.genericName.trim() || null,
          barcode: form.barcode.trim() || null,
          categoryId: form.categoryId || null,
          packUnit: sellsInPacks ? form.packUnit.trim() || null : null,
          buyingPrice: buying,
        },
      });
    } else {
      saveMutation.mutate({
        create: {
          ...common,
          brand: form.brand.trim() || undefined,
          genericName: form.genericName.trim() || undefined,
          barcode: form.barcode.trim() || undefined,
          categoryId: form.categoryId || undefined,
          packUnit: sellsInPacks ? form.packUnit.trim() || undefined : undefined,
          buyingPrice: buying ?? undefined,
        } as CreateDrugRequest,
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
      {!editing && (
        <div role="radiogroup" aria-label="What are you adding?" className="grid grid-cols-2 gap-2">
          {([[false, "Medicine / product", "Counted in stock"], [true, "Service", "Injection, wound dressing… no stock"]] as const).map(([value, label, hint]) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={form.isService === value}
              onClick={() => setForm((f) => ({ ...f, isService: value }))}
              className={`rounded-md border p-3 text-left text-sm transition-colors ${form.isService === value ? "border-primary bg-primary/10" : "border-input hover:bg-accent"}`}
            >
              <span className="block font-medium">{label}</span>
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </button>
          ))}
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="d-name">{form.isService ? "Service Name *" : "Drug Name *"}</Label>
        <Input id="d-name" placeholder={form.isService ? "e.g. Injection, Wound dressing, Femi clean" : "e.g. Paracetamol 500mg"} value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </div>
      {!editing && !form.isService && similar && similar.length > 0 && (
        <div className="rounded-md border border-amber-400/50 bg-amber-500/10 p-3 text-sm space-y-2">
          <p className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
            <Copy className="h-4 w-4 shrink-0" />
            This looks like one you already have:
          </p>
          <ul className="space-y-1">
            {similar.slice(0, 3).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-words">
                  <strong>{s.name}</strong>
                  <span className="text-xs text-muted-foreground">
                    {" "}· {DUPLICATE_REASONS[s.reason] ?? s.reason} · {money(s.sellingPrice)}{s.active ? "" : " · switched off"}
                  </span>
                </span>
                <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => onOpenExisting(s.id)}>
                  Open it instead
                </Button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">If it really is a different product, just carry on and save.</p>
        </div>
      )}
      {form.isService && (
        <>
          <div className="space-y-1">
            <Label htmlFor="d-category">Category</Label>
            <select id="d-category" className={selectClass} value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}>
              <option value="">No category</option>
              {activeCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.active ? "" : " (inactive)"}</option>
              ))}
            </select>
          </div>
          <fieldset className="space-y-2 rounded-md border border-border p-3">
            <legend className="px-1 text-sm font-medium">How is the price set?</legend>
            {([
              ["Fixed", "Fixed price", "The price below is filled in at the till. Sellers cannot change it."],
              ["Manual", "Typed when selling", "The seller types the price each time (e.g. wound dressing depends on the wound)."],
            ] as const).map(([value, label, hint]) => (
              <label key={value} className="flex cursor-pointer items-start gap-2 text-sm">
                <input type="radio" name="d-price-mode" className="mt-1 h-4 w-4" checked={form.priceMode === value}
                  onChange={() => setForm((f) => ({ ...f, priceMode: value }))} />
                <span>
                  <span className="block font-medium">{label}</span>
                  <span className="block text-xs text-muted-foreground">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="d-sell">{typedAtTill ? "Suggested price (TZS)" : "Price (TZS) *"}</Label>
              <Input id="d-sell" type="number" min={0} step="any" inputMode="decimal" placeholder={typedAtTill ? "optional" : undefined}
                value={form.sellingPrice} onChange={(e) => setForm((f) => ({ ...f, sellingPrice: e.target.value }))} />
              {typedAtTill && <p className="text-xs text-muted-foreground">Shown as a hint at the till; the seller can type any price.</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="d-buy">Cost of materials (TZS)</Label>
              <Input id="d-buy" type="number" min={0} step="any" inputMode="decimal" placeholder="optional" value={form.buyingPrice}
                onChange={(e) => setForm((f) => ({ ...f, buyingPrice: e.target.value }))} />
              <p className="text-xs text-muted-foreground">e.g. the syringe and gloves. Leave empty to count the whole price as profit.</p>
            </div>
          </div>
          {sellsBelowCost && (
            <p className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              The price is lower than the cost of materials, so every time you give this service you lose money.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            A service has no stock: it is never counted, never runs out and never expires, but its price is added to the
            receipt and to your takings.
          </p>
        </>
      )}
      {!form.isService && (
        <>
      <div className="space-y-1">
        <Label htmlFor="d-brand">Brand</Label>
        <Input id="d-brand" placeholder="e.g. Panadol (the same medicine can be stocked under several brands)" value={form.brand}
          onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="d-generic">Generic Name</Label>
        <Input id="d-generic" placeholder="e.g. Acetaminophen" value={form.genericName}
          onChange={(e) => setForm((f) => ({ ...f, genericName: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="d-category">Category</Label>
          <select id="d-category" className={selectClass} value={form.categoryId}
            onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}>
            <option value="">No category</option>
            {activeCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.active ? "" : " (inactive)"}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="d-unit">Unit *</Label>
          <select id="d-unit" className={selectClass} value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}>
            {/* A drug saved with a unit that isn't in the standard list must still show it. */}
            {!UNIT_OPTIONS.some((u) => u.value === form.unit) && <option value={form.unit}>{form.unit}</option>}
            {UNIT_OPTIONS.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="d-upp">Units per pack *</Label>
          <Input id="d-upp" type="number" min={1} step={1} value={form.unitsPerPack}
            onChange={(e) => setForm((f) => ({ ...f, unitsPerPack: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="d-pack">Pack name</Label>
          <Input id="d-pack" placeholder="e.g. box, strip" disabled={!sellsInPacks} value={form.packUnit}
            onChange={(e) => setForm((f) => ({ ...f, packUnit: e.target.value }))} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Prices and stock are counted per {form.unit}. Put 1 if this drug is not split.
        {editing && " Changing this does not change existing stock counts."}
        {sellsInPacks && Number.isFinite(selling) && form.sellingPrice.trim() !== "" && (
          <> One {form.packUnit.trim() || "pack"} = {unitsPerPack} {form.unit} = TZS {(selling * unitsPerPack).toLocaleString()}
            {buying !== null && Number.isFinite(buying) && <> (cost TZS {(buying * unitsPerPack).toLocaleString()})</>}.</>
        )}
      </p>
      <div className="space-y-1">
        <Label htmlFor="d-barcode">Barcode</Label>
        <Input id="d-barcode" placeholder="optional" value={form.barcode}
          onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="d-sell">Selling Price per {form.unit} (TZS) *</Label>
          <Input id="d-sell" type="number" min={0} step="any" inputMode="decimal" value={form.sellingPrice}
            onChange={(e) => setForm((f) => ({ ...f, sellingPrice: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="d-buy">Buying Price per {form.unit} (TZS)</Label>
          <Input id="d-buy" type="number" min={0} step="any" inputMode="decimal" placeholder="optional" value={form.buyingPrice}
            onChange={(e) => setForm((f) => ({ ...f, buyingPrice: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="d-reorder">Reorder Level *</Label>
          <Input id="d-reorder" type="number" min={0} step={1} value={form.reorderLevel}
            onChange={(e) => setForm((f) => ({ ...f, reorderLevel: e.target.value }))} />
        </div>
      </div>
      <div className="rounded-md border border-border p-3 space-y-2">
        <div className="flex items-center gap-2">
          <input
            id="d-half"
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            checked={form.allowsHalfDose}
            onChange={(e) => setForm((f) => ({ ...f, allowsHalfDose: e.target.checked }))}
          />
          <Label htmlFor="d-half">Can be sold by the half dose</Label>
        </div>
        {form.allowsHalfDose && (
          <div className="space-y-1">
            <Label htmlFor="d-half-price">Half-dose price (TZS)</Label>
            <Input id="d-half-price" type="number" min={0} step="any" inputMode="decimal"
              placeholder={Number.isFinite(selling) && form.sellingPrice.trim() !== "" ? String(selling / 2) : "half of the selling price"}
              value={form.halfDosePrice}
              onChange={(e) => setForm((f) => ({ ...f, halfDosePrice: e.target.value }))} />
            <p className="text-xs text-muted-foreground">
              Leave empty for half of the selling price
              {Number.isFinite(selling) && form.sellingPrice.trim() !== "" && <> (TZS {(selling / 2).toLocaleString()})</>}
              , or type a higher price to add something on top. A half dose takes half a {form.unit} of stock.
            </p>
          </div>
        )}
      </div>
      {sellsBelowCost && (
        <p className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          The selling price is lower than the buying price, so every sale of this drug loses money.
        </p>
      )}
      {editing && (
        <p className="text-xs text-muted-foreground">
          Price changes apply to new sales only; past receipts keep the price they were sold at. Every change is
          recorded in the audit log.
        </p>
      )}
      <div className="flex items-center gap-2">
        <input
          id="d-prescription"
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          checked={form.requiresPrescription}
          onChange={(e) => setForm((f) => ({ ...f, requiresPrescription: e.target.checked }))}
        />
        <Label htmlFor="d-prescription">Requires Prescription</Label>
      </div>
        </>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving…" : editing ? "Save changes" : form.isService ? "Add Service" : "Add Drug"}
        </Button>
      </DialogFooter>
    </form>
  );
}
