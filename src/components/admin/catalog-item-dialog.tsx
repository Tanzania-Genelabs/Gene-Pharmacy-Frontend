"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { adminCatalogApi } from "@/api/admin.api";
import { apiErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CatalogItem, CatalogItemInput, CatalogKind } from "@/types";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

const UNITS = ["tablet", "capsule", "syrup", "injection", "cream", "piece", "strip"];

/** Add a product to the shared catalog, or correct one that is already there. */
export function CatalogItemDialog({ item, open, onOpenChange }: { item: CatalogItem | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit catalog item" : "Add to the catalog"}</DialogTitle>
        </DialogHeader>
        {/* Mounted only while open, so the form always starts from the item being edited. */}
        <ItemForm item={item} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ItemForm({ item, onClose }: { item: CatalogItem | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: item?.name ?? "",
    kind: (item?.kind ?? "Medicine") as CatalogKind,
    genericName: item?.genericName ?? "",
    strength: item?.strength ?? "",
    form: item?.form ?? "",
    unit: item?.unit ?? "piece",
    category: item?.category ?? "",
    manufacturer: item?.manufacturer ?? "",
    barcode: item?.barcode ?? "",
    requiresPrescription: item?.requiresPrescription ?? false,
    verified: item?.verified ?? true,
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = useMutation({
    mutationFn: () => {
      // Emptied optional fields are sent as null so they are cleared.
      const data: CatalogItemInput = {
        name: form.name.trim(),
        kind: form.kind,
        genericName: form.genericName.trim() || null,
        strength: form.strength.trim() || null,
        form: form.form.trim() || null,
        unit: form.unit,
        category: form.category.trim() || null,
        manufacturer: form.manufacturer.trim() || null,
        barcode: form.barcode.trim() || null,
        requiresPrescription: form.requiresPrescription,
        verified: form.verified,
      };
      return item ? adminCatalogApi.update(item.id, data) : adminCatalogApi.create(data);
    },
    onSuccess: (saved) => {
      toast.success(item ? `${saved.name} updated` : `${saved.name} added`);
      qc.invalidateQueries({ queryKey: ["admin", "catalog"] });
      onClose();
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Could not save")),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.name.trim().length < 2) return toast.error("Enter the product name");
    save.mutate();
  }

  return (
    <form onSubmit={submit} className="space-y-4 px-6 py-4">
      <div className="space-y-1">
        <Label htmlFor="ci-name">Product name *</Label>
        <Input id="ci-name" placeholder="e.g. Paracetamol 500mg tablet" value={form.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="ci-kind2">Type</Label>
          <select id="ci-kind2" className={selectClass} value={form.kind} onChange={(e) => set("kind", e.target.value as CatalogKind)}>
            {(["Medicine", "Supplement", "Cosmetic", "Device", "Other"] as const).map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ci-category">Category</Label>
          <Input id="ci-category" placeholder="e.g. Pain Relief" value={form.category} onChange={(e) => set("category", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor="ci-generic">Generic name</Label>
          <Input id="ci-generic" value={form.genericName} onChange={(e) => set("genericName", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ci-strength">Strength</Label>
          <Input id="ci-strength" placeholder="500mg" value={form.strength} onChange={(e) => set("strength", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ci-form">Form</Label>
          <Input id="ci-form" placeholder="tablet" value={form.form} onChange={(e) => set("form", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor="ci-unit">Sold by *</Label>
          <select id="ci-unit" className={selectClass} value={form.unit} onChange={(e) => set("unit", e.target.value)}>
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ci-maker">Manufacturer</Label>
          <Input id="ci-maker" value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ci-barcode">Barcode</Label>
          <Input id="ci-barcode" inputMode="numeric" placeholder="optional" value={form.barcode} onChange={(e) => set("barcode", e.target.value)} />
        </div>
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4" checked={form.requiresPrescription} onChange={(e) => set("requiresPrescription", e.target.checked)} />
          Requires a prescription
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4" checked={form.verified} onChange={(e) => set("verified", e.target.checked)} />
          Checked by a pharmacist
        </label>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : item ? "Save changes" : "Add to catalog"}
        </Button>
      </DialogFooter>
    </form>
  );
}
