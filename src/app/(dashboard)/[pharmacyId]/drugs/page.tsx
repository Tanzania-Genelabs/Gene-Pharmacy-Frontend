"use client";

import { use, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Copy, Download, Library, PencilLine, Plus, Search, Upload } from "lucide-react";
import { drugApi, drugCategoryApi } from "@/api/drug.api";
import { catalogApi } from "@/api/catalog.api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CatalogPickerDialog } from "@/components/catalog/catalog-picker-dialog";
import { downloadBlob } from "@/components/expenses/format";
import { DrugFormDialog } from "@/components/drugs/drug-form-dialog";
import { DrugTable, type PriceField } from "@/components/drugs/drug-table";
import { DrugFilterBar, NO_FILTERS, filterParams, type DrugFilters } from "@/components/drugs/drug-filters";
import { BulkActionBar } from "@/components/drugs/bulk-action-bar";
import { FillPricesPanel } from "@/components/drugs/fill-prices-panel";
import { DuplicatesDialog, duplicatesKey } from "@/components/drugs/duplicates-dialog";
import { CatalogAddDialog, newForMeKey } from "@/components/drugs/catalog-add-dialog";
import { skipReasonLabel } from "@/components/drugs/format";
import { apiErrorMessage } from "@/lib/errors";
import { ymd } from "@/lib/periods";
import { useDebounced } from "@/lib/use-debounced";
import { useAuthStore } from "@/store/auth.store";
import type { DrugResponse, DrugSort, Page } from "@/types";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

const PAGE_SIZE = 50;

export default function DrugsPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  // Sellers get a read-only list without buying prices or profit.
  const canManage = role === "Owner" || role === "Manager" || role === "SuperAdmin";

  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim(), 300);
  const searchParams = useSearchParams();
  // A quick filter can be opened from a link, e.g. ?quick=noBuying from the dashboard.
  const [filters, setFilters] = useState<DrugFilters>(() => {
    const quick = searchParams.get("quick");
    return quick === "noBuying" || quick === "noSelling" || quick === "belowCost" || quick === "neverSold" || quick === "attention"
      ? { ...NO_FILTERS, quick, showInactive: quick === "noSelling" }
      : NO_FILTERS;
  });
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<DrugSort>("name");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<Record<string, DrugResponse>>({});
  const [fillMode, setFillMode] = useState<PriceField | null>(null);

  // One dialog serves both: `editing` is the drug being changed, or null when adding a new one.
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DrugResponse | null>(null);
  // The per-item catalog picker can be opened straight away with a barcode (?catalog=...) when the
  // till scanned a product this pharmacy doesn't have yet.
  const catalogParam = searchParams.get("catalog");
  const [showCatalogPicker, setShowCatalogPicker] = useState(!!catalogParam);
  const [showCatalogAdd, setShowCatalogAdd] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);

  const listParams = { ...filterParams(filters, search), page, size: PAGE_SIZE, sort, direction };
  const listKey: QueryKey = ["drugs", pharmacyId, "list", listParams];

  const { data, isLoading, isFetching } = useQuery({
    queryKey: listKey,
    queryFn: () => drugApi.list(pharmacyId, listParams),
    placeholderData: (prev) => prev,
  });
  const drugs = data?.content ?? [];

  const { data: categories } = useQuery({
    queryKey: ["drug-categories", pharmacyId],
    queryFn: () => drugCategoryApi.list(pharmacyId),
  });

  const { data: attention } = useQuery({
    queryKey: ["drugs", pharmacyId, "attention-count"],
    queryFn: () => drugApi.list(pharmacyId, { status: "active", needsAttention: 1, size: 1 }),
    enabled: canManage,
  });
  const { data: duplicates } = useQuery({
    queryKey: duplicatesKey(pharmacyId),
    queryFn: () => drugApi.duplicates(pharmacyId),
    enabled: canManage,
    staleTime: 5 * 60_000,
  });
  const { data: newForMe } = useQuery({
    queryKey: [...newForMeKey(pharmacyId), "count"],
    queryFn: () => catalogApi.newForMe(pharmacyId, { size: 1 }),
    enabled: canManage,
    staleTime: 5 * 60_000,
  });

  // ── Filters, sorting, paging: every change goes back to the first page ──
  function changeFilters(next: DrugFilters) {
    setFilters(next);
    setPage(0);
    if (fillMode === "buyingPrice" && next.quick !== "noBuying") setFillMode(null);
    if (fillMode === "sellingPrice" && next.quick !== "noSelling") setFillMode(null);
  }
  function clearFilters() {
    setSearchInput("");
    changeFilters(NO_FILTERS);
  }
  function changeSort(column: DrugSort) {
    if (sort === column) {
      setDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(column);
      // Names A→Z; numbers biggest first.
      setDirection(column === "name" ? "asc" : "desc");
    }
    setPage(0);
  }
  function startFill(field: PriceField) {
    setFillMode(field);
    setFilters((f) => (field === "buyingPrice" ? { ...f, quick: "noBuying" } : { ...f, quick: "noSelling", showInactive: true }));
    setPage(0);
  }

  // ── Selection ──
  function toggleRow(drug: DrugResponse) {
    setSelected((cur) => {
      const next = { ...cur };
      if (next[drug.id]) delete next[drug.id];
      else next[drug.id] = drug;
      return next;
    });
  }
  function togglePage() {
    const all = drugs.length > 0 && drugs.every((d) => selected[d.id]);
    setSelected((cur) => {
      const next = { ...cur };
      for (const d of drugs) {
        if (all) delete next[d.id];
        else next[d.id] = d;
      }
      return next;
    });
  }

  // ── Dialog ──
  function openAdd() {
    setEditing(null);
    setShowForm(true);
  }
  function openEdit(drug: DrugResponse) {
    setEditing(drug);
    setShowForm(true);
  }
  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }
  async function openExisting(drugId: string) {
    try {
      openEdit(await drugApi.getById(pharmacyId, drugId));
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not open that drug"));
    }
  }

  // ── Mutations ──
  const priceMutation = useMutation({
    mutationFn: ({ drug, field, value }: { drug: DrugResponse; field: PriceField; value: number; key: QueryKey }) =>
      drugApi.bulkPrices(pharmacyId, [{ id: drug.id, [field]: value }]),
    // Show the new price straight away; put the old one back if the server refuses.
    onMutate: async ({ drug, field, value, key }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Page<DrugResponse>>(key);
      qc.setQueryData<Page<DrugResponse>>(key, (old) =>
        old ? { ...old, content: old.content.map((d) => (d.id === drug.id ? { ...d, [field]: value } : d)) } : old,
      );
      return { previous };
    },
    onSuccess: (res, { drug, field, key }, ctx) => {
      if (res.skipped.length > 0) {
        if (ctx?.previous) qc.setQueryData(key, ctx.previous);
        toast.error(`Price not saved: ${skipReasonLabel(res.skipped[0].reason)}`);
      } else {
        toast.success(`${field === "sellingPrice" ? "Selling" : "Buying"} price of ${drug.name} saved`);
      }
    },
    onError: (err: unknown, { key }, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      toast.error(apiErrorMessage(err, "Could not save the price"));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["drugs", pharmacyId] }),
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

  // ── Files ──
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
    downloadBlob(new Blob([csv], { type: "text/csv" }), "drugs-template.csv");
  }

  async function exportList(type: "full" | "prices") {
    try {
      const blob = await drugApi.exportCsv(pharmacyId, type, { ...filterParams(filters, search), sort, direction });
      downloadBlob(blob, `${type === "prices" ? "price-list" : "drugs"}-${ymd(new Date())}.csv`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not download the list"));
    }
  }

  const total = data?.totalElements;
  const from = total ? page * PAGE_SIZE + 1 : 0;
  const to = total ? Math.min(total, page * PAGE_SIZE + drugs.length) : 0;
  const duplicateCount = duplicates?.totalGroups ?? 0;
  const newCount = newForMe?.total ?? 0;

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Drug Catalog</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Every medicine you sell, with its price, stock and profit.
            {canManage && " Click a price to change it."}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                  <ChevronDown className="h-3.5 w-3.5 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportList("full")}>Download list (CSV)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportList("prices")}>Download price list (CSV)</DropdownMenuItem>
                <p className="px-2 pb-1 text-[11px] text-muted-foreground max-w-56">Uses the filters you have on now.</p>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" data-guide="add-drug" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add Drug
            </Button>
            <Button size="sm" data-guide="add-from-catalog" onClick={() => setShowCatalogAdd(true)}>
              <Library className="h-4 w-4 mr-2" />
              Add from catalog
              {newCount > 0 && (
                <span className="ml-2 rounded-full bg-primary-foreground/20 px-1.5 text-[11px] tabular-nums">{newCount}</span>
              )}
            </Button>
          </div>
        )}
      </div>

      {canManage && (duplicateCount > 0 || newCount > 0) && (
        <div className="flex flex-wrap gap-2">
          {duplicateCount > 0 && (
            <button
              type="button"
              onClick={() => setShowDuplicates(true)}
              className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-500/10 px-3 py-2 text-left text-sm hover:border-amber-500 dark:border-amber-800"
            >
              <Copy className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                <strong>Possible duplicates ({duplicateCount})</strong>
                <span className="block text-xs text-muted-foreground">The same medicine entered twice splits its stock. Tap to check.</span>
              </span>
            </button>
          )}
          {newCount > 0 && (
            <button
              type="button"
              onClick={() => setShowCatalogAdd(true)}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm hover:border-primary"
            >
              <Library className="h-4 w-4 shrink-0 text-primary" />
              <span>
                <strong>{newCount.toLocaleString()} new medicines can be added</strong>
                <span className="block text-xs text-muted-foreground">From the shared catalog, no typing needed.</span>
              </span>
            </button>
          )}
        </div>
      )}

      <CatalogPickerDialog
        pharmacyId={pharmacyId}
        open={showCatalogPicker}
        onOpenChange={setShowCatalogPicker}
        initialSearch={catalogParam ?? undefined}
      />
      <CatalogAddDialog
        pharmacyId={pharmacyId}
        open={showCatalogAdd}
        onOpenChange={setShowCatalogAdd}
        onPickPerItem={() => setShowCatalogPicker(true)}
        onFillPrices={() => startFill("sellingPrice")}
      />
      <DuplicatesDialog pharmacyId={pharmacyId} open={showDuplicates} onOpenChange={setShowDuplicates} />
      <DrugFormDialog
        pharmacyId={pharmacyId}
        open={showForm}
        editing={editing}
        categories={categories ?? []}
        onClose={closeForm}
        onOpenExisting={openExisting}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, brand, generic or barcode…"
            className="pl-9"
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setPage(0); }}
          />
        </div>
        {canManage && !fillMode && (
          <Button variant="outline" size="sm" onClick={() => startFill("buyingPrice")} title="Type in the missing buying prices one after another">
            <PencilLine className="h-4 w-4 mr-2" />
            Fill buying prices
          </Button>
        )}
      </div>

      <DrugFilterBar
        filters={filters}
        onChange={changeFilters}
        onClear={clearFilters}
        categories={categories ?? []}
        search={search}
        matches={total}
        attentionCount={attention?.totalElements}
        canManage={canManage}
      />

      {fillMode ? (
        <FillPricesPanel
          key={fillMode}
          pharmacyId={pharmacyId}
          drugs={drugs}
          isLoading={isLoading}
          field={fillMode}
          onClose={() => setFillMode(null)}
        />
      ) : (
        <Card className="min-w-0">
          <CardContent className="p-0">
            <DrugTable
              drugs={drugs}
              isLoading={isLoading}
              canManage={canManage}
              sort={sort}
              direction={direction}
              onSort={changeSort}
              selected={selected}
              onToggle={toggleRow}
              onTogglePage={togglePage}
              onSavePrice={(drug, field, value) => priceMutation.mutate({ drug, field, value, key: listKey })}
              onEdit={openEdit}
              onDeactivate={(d) => deleteMutation.mutate(d.id)}
              onReactivate={(d) => reactivateMutation.mutate(d.id)}
            />
          </CardContent>
        </Card>
      )}

      {data && total !== undefined && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
            {isFetching && !isLoading ? " · updating…" : ""}
          </span>
          {data.totalPages > 1 && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={data.first} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={data.last} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {canManage && !fillMode && (
        <BulkActionBar pharmacyId={pharmacyId} selected={selected} categories={categories ?? []} onClear={() => setSelected({})} />
      )}
    </div>
  );
}
