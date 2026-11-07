"use client";

import { AlertTriangle } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UNIT_OPTIONS } from "@/lib/drug-units";
import { detailsNumbers, type DrugDetailsForm } from "@/lib/drug-details";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

interface Props {
  value: DrugDetailsForm;
  onChange: (next: DrugDetailsForm) => void;
  /** True when the values differ from what is saved on the drug. */
  changed: boolean;
}

/**
 * How a drug is counted (tablet, blister, …), its prices and whether it can be sold by the half dose,
 * shown while stock is being added so none of it needs a trip to the Drugs page.
 */
export function DrugDetailsFields({ value, onChange, changed }: Props) {
  const { selling, buying, unitsPerPack, sellsInPacks } = detailsNumbers(value);
  const set = (patch: Partial<DrugDetailsForm>) => onChange({ ...value, ...patch });
  const sellsBelowCost = buying !== null && Number.isFinite(selling) && Number.isFinite(buying) && selling < buying;

  return (
    <div className="space-y-3 rounded-md border border-dashed p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Dosage &amp; price</p>
        {changed && <span className="text-xs text-amber-600 dark:text-amber-400">Changed. Saved with this entry</span>}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor="det-unit">Counted as</Label>
          <select id="det-unit" className={selectClass} value={value.unit} onChange={(e) => set({ unit: e.target.value })}>
            {!UNIT_OPTIONS.some((u) => u.value === value.unit) && <option value={value.unit}>{value.unit}</option>}
            {UNIT_OPTIONS.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="det-upp">Units per pack</Label>
          <Input id="det-upp" type="number" min={1} step={1} value={value.unitsPerPack}
            onChange={(e) => set({ unitsPerPack: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="det-pack">Pack name</Label>
          <Input id="det-pack" placeholder="e.g. box" disabled={!sellsInPacks} value={value.packUnit}
            onChange={(e) => set({ packUnit: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="det-sell">Selling price per {value.unit} (TZS)</Label>
          <Input id="det-sell" type="number" min={0} step="any" inputMode="decimal" value={value.sellingPrice}
            onChange={(e) => set({ sellingPrice: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="det-buy">Buying price per {value.unit} (TZS)</Label>
          <Input id="det-buy" type="number" min={0} step="any" inputMode="decimal" placeholder="optional" value={value.buyingPrice}
            onChange={(e) => set({ buyingPrice: e.target.value })} />
        </div>
      </div>

      {sellsInPacks && Number.isFinite(selling) && (
        <p className="text-xs text-muted-foreground">
          One {value.packUnit.trim() || "pack"} = {unitsPerPack} {value.unit} = TZS {(selling * unitsPerPack).toLocaleString()}
          {buying !== null && Number.isFinite(buying) && <> (cost TZS {(buying * unitsPerPack).toLocaleString()})</>}.
        </p>
      )}

      <div className="space-y-2 rounded-md border border-border p-2">
        <div className="flex items-center gap-2">
          <input
            id="det-half"
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            checked={value.allowsHalfDose}
            onChange={(e) => set({ allowsHalfDose: e.target.checked })}
          />
          <Label htmlFor="det-half">Can be sold by the half dose</Label>
        </div>
        {value.allowsHalfDose && (
          <div className="space-y-1">
            <Label htmlFor="det-half-price">Half-dose price (TZS)</Label>
            <Input id="det-half-price" type="number" min={0} step="any" inputMode="decimal"
              placeholder={Number.isFinite(selling) ? String(selling / 2) : "half of the selling price"}
              value={value.halfDosePrice}
              onChange={(e) => set({ halfDosePrice: e.target.value })} />
            <p className="text-xs text-muted-foreground">
              Empty = half of the selling price{Number.isFinite(selling) && <> (TZS {(selling / 2).toLocaleString()})</>}.
              A half dose takes half a {value.unit} of stock.
            </p>
          </div>
        )}
      </div>

      {sellsBelowCost && (
        <p className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          The selling price is lower than the buying price, so every sale loses money.
        </p>
      )}
    </div>
  );
}
