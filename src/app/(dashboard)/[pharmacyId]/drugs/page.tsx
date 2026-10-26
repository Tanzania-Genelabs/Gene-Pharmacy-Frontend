"use client";

import { use, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { drugApi, drugCategoryApi } from "@/api/drug.api";
import { toast } from "sonner";
import { Plus, Search, Upload, Pill, MoreHorizontal, AlertTriangle, Library, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiErrorMessage } from "@/lib/errors";
import { CatalogPickerDialog } from "@/components/catalog/catalog-picker-dialog";
import type { CreateDrugRequest, DrugResponse, UpdateDrugRequest } from "@/types";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

const UNIT_OPTIONS = [
  { value: "tablet", label: "Tablet" },
  { value: "capsule", label: "Capsule" },
  { value: "syrup", label: "Syrup (ml)" },
  { value: "injection", label: "Injection (vial)" },
  { value: "cream", label: "Cream (g)" },
  { value: "piece", label: "Piece" },
  { value: "strip", label: "Strip" },
];

/** Form fields are text so they can be emptied while typing; they are converted on submit. */
interface DrugForm {
  name: string;
  genericName: string;
  barcode: string;
  categoryId: string;
  unit: string;
  sellingPrice: string;
  buyingPrice: string;
  reorderLevel: string;
  requiresPrescription: boolean;
}

const emptyForm = (): DrugForm => ({
  name: "", genericName: "", barcode: "", categoryId: "", unit: "tablet",
  sellingPrice: "", buyingPrice: "", reorderLevel: "10", requiresPrescription: false,
});

const formFromDrug = (drug: DrugResponse): DrugForm => ({
  name: drug.name,
  genericName: drug.genericName ?? "",
  barcode: drug.barcode ?? "",
  categoryId: drug.categoryId ?? "",
  unit: drug.unit,
  sellingPrice: String(drug.sellingPrice),
  buyingPrice: drug.buyingPrice === null ? "" : String(drug.buyingPrice),
  reorderLevel: String(drug.reorderLevel),
  requiresPrescription: drug.requiresPrescription,
});

export default function DrugsPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  // One dialog serves both: `editing` is the drug being changed, or null when adding a new one.
  // The catalog picker can be opened straight away with a barcode (?catalog=...) when the till
  // scanned a product this pharmacy doesn't have yet.
  const catalogParam = useSearchParams().get("catalog");
  const [showCatalog, setShowCatalog] = useState(!!catalogParam);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DrugResponse | null>(null);
  const [form, setForm] = useState<DrugForm>(emptyForm());

  const { data, isLoading } = useQuery({
    queryKey: ["drugs", pharmacyId, page, search],
    queryFn: () => drugApi.list(pharmacyId, { page, size: 20, search: search || undefined }),
    placeholderData: (prev) => prev,
  });

  const { data: categories } = useQuery({
    queryKey: ["drug-categories", pharmacyId],
    queryFn: () => drugCategoryApi.list(pharmacyId),
  });
  const activeCategories = (categories ?? []).filter((c) => c.active || c.id === form.categoryId);

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm());
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function openEdit(drug: DrugResponse) {
    setEditing(drug);
    setForm(formFromDrug(drug));
    setShowForm(true);
  }

  const saveMutation = useMutation({
    mutationFn: (payload: { create?: CreateDrugRequest; update?: UpdateDrugRequest }) =>
      editing && payload.update
        ? drugApi.update(pharmacyId, editing.id, payload.update)
        : drugApi.create(pharmacyId, payload.create!),
    onSuccess: (saved) => {
      toast.success(editing ? `${saved.name} updated` : "Drug added successfully");
      qc.invalidateQueries({ queryKey: ["drugs", pharmacyId] });
      closeForm();
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, editing ? "Failed to update drug" : "Failed to add drug")),
  });

  const deleteMutation = useMutation({
    mutationFn: (drugId: string) => drugApi.delete(pharmacyId, drugId),
    onSuccess: () => {
      toast.success("Drug deactivated");
      qc.invalidateQueries({ queryKey: ["drugs", pharmacyId] });
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to deactivate drug")),
  });

  const reactivateMutation = useMutation({
    mutationFn: (drugId: string) => drugApi.reactivate(pharmacyId, drugId),
    onSuccess: () => {
      toast.success("Drug reactivated");
      qc.invalidateQueries({ queryKey: ["drugs", pharmacyId] });
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to reactivate drug")),
  });

  const selling = Number(form.sellingPrice);
  const buying = form.buyingPrice.trim() === "" ? null : Number(form.buyingPrice);
  const sellsBelowCost = buying !== null && Number.isFinite(selling) && Number.isFinite(buying) && selling < buying;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

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
    const reorder = Number(form.reorderLevel);
    if (form.reorderLevel.trim() === "" || !Number.isInteger(reorder) || reorder < 0) {
      toast.error("The reorder level must be a whole number, 0 or more");
      return;
    }

    const common = {
      name: form.name.trim(),
      unit: form.unit,
      sellingPrice: selling,
      reorderLevel: reorder,
      requiresPrescription: form.requiresPrescription,
    };

    if (editing) {
      // Optional details are sent as null when emptied, which clears them on the server.
      saveMutation.mutate({
        update: {
          ...common,
          genericName: form.genericName.trim() || null,
          barcode: form.barcode.trim() || null,
          categoryId: form.categoryId || null,
          buyingPrice: buying,
        },
      });
    } else {
      saveMutation.mutate({
        create: {
          ...common,
          genericName: form.genericName.trim() || undefined,
          barcode: form.barcode.trim() || undefined,
          categoryId: form.categoryId || undefined,
          buyingPrice: buying ?? undefined,
        } as CreateDrugRequest,
      });
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const result = await drugApi.importExcel(pharmacyId, file);
      qc.invalidateQueries({ queryKey: ["drugs", pharmacyId] });
      qc.invalidateQueries({ queryKey: ["drug-categories", pharmacyId] });

      if (result.failureCount === 0) {
        toast.success(`Imported ${result.successCount} drug${result.successCount === 1 ? "" : "s"}.`);
      } else {
        // Say which rows failed and why, so the sheet can be fixed and the failed rows loaded again.
        const shown = result.errors.slice(0, 4).map((x) => `Row ${x.row}: ${x.reason}`).join("\n");
        const more = result.errors.length > 4 ? `\n…and ${result.failureCount - 4} more` : "";
        toast.warning(`Imported ${result.successCount}, skipped ${result.failureCount}.`, { description: shown + more, duration: 15000 });
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "Import failed. Use an Excel (.xlsx) or CSV file with a header row."));
    }
    e.target.value = "";
  };

  function downloadTemplate() {
    const csv =
      "Name,Generic Name,Category,Unit,Barcode,Selling Price,Buying Price,Reorder Level,Requires Prescription\n" +
      "Paracetamol 500mg tablet,Paracetamol,Pain Relief,tablet,,1000,600,50,no\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "drugs-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Drug Catalog</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {data?.totalElements ?? 0} drugs registered
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate} title="A sample file showing the columns to use">
            <Download className="h-4 w-4 mr-2" />
            Template
          </Button>
          <label>
            <input type="file" accept=".xlsx,.csv" className="hidden" onChange={handleImport} />
            <Button variant="outline" size="sm" asChild>
              <span className="cursor-pointer flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Import Excel
              </span>
            </Button>
          </label>
          <Button variant="outline" size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Drug
          </Button>
          <Button size="sm" onClick={() => setShowCatalog(true)}>
            <Library className="h-4 w-4 mr-2" />
            Add from catalog
          </Button>
        </div>
      </div>

      <CatalogPickerDialog pharmacyId={pharmacyId} open={showCatalog} onOpenChange={setShowCatalog} initialSearch={catalogParam ?? undefined} />

      {/* Add / Edit Drug Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => (open ? setShowForm(true) : closeForm())}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "Add Drug"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
            <div className="space-y-1">
              <Label htmlFor="d-name">Drug Name *</Label>
              <Input id="d-name" placeholder="e.g. Paracetamol 500mg" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
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
            <div className="space-y-1">
              <Label htmlFor="d-barcode">Barcode</Label>
              <Input id="d-barcode" placeholder="optional" value={form.barcode}
                onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="d-sell">Selling Price (TZS) *</Label>
                <Input id="d-sell" type="number" min={0} step="any" inputMode="decimal" value={form.sellingPrice}
                  onChange={(e) => setForm((f) => ({ ...f, sellingPrice: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-buy">Buying Price (TZS)</Label>
                <Input id="d-buy" type="number" min={0} step="any" inputMode="decimal" placeholder="optional" value={form.buyingPrice}
                  onChange={(e) => setForm((f) => ({ ...f, buyingPrice: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-reorder">Reorder Level *</Label>
                <Input id="d-reorder" type="number" min={0} step={1} value={form.reorderLevel}
                  onChange={(e) => setForm((f) => ({ ...f, reorderLevel: e.target.value }))} />
              </div>
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : editing ? "Save changes" : "Add Drug"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search drugs…"
          className="pl-9"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(0); }}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Generic Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
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
              ) : data?.content.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    <Pill className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No drugs found
                  </TableCell>
                </TableRow>
              ) : (
                data?.content.map((drug) => (
                  <TableRow key={drug.id} className="hover:bg-accent/50">
                    <TableCell className="font-medium">{drug.name}</TableCell>
                    <TableCell className="text-muted-foreground">{drug.genericName}</TableCell>
                    <TableCell>{drug.categoryName ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">
                      TZS {drug.sellingPrice.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={drug.active ? "default" : "secondary"}>
                        {drug.active ? "Active" : "Inactive"}
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
                          <DropdownMenuItem onClick={() => openEdit(drug)}>Edit</DropdownMenuItem>
                          {drug.active ? (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteMutation.mutate(drug.id)}
                            >
                              Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => reactivateMutation.mutate(drug.id)}>
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
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page + 1} of {data.totalPages} · {data.totalElements} total
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.first}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.last}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
