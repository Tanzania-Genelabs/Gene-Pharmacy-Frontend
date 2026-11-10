"use client";

import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { money } from "@/components/expenses/format";
import { cn } from "@/lib/utils";
import { EditablePrice } from "./editable-price";
import { ISSUE_LABELS, fmtUnits, splitDrugName } from "./format";
import type { DrugResponse, DrugSort } from "@/types";

export type PriceField = "sellingPrice" | "buyingPrice";

function StockCell({ drug }: { drug: DrugResponse }) {
  // A service is never counted: it has no stock to show.
  if (drug.isService) return <span className="text-xs text-muted-foreground">No stock</span>;
  if (drug.stockTotal === undefined) return <span className="text-muted-foreground">—</span>;
  if (drug.everStocked === false) return <span className="text-xs text-muted-foreground">Never stocked</span>;
  const status = drug.stockStatus === "service" ? "ok" : (drug.stockStatus ?? "ok");
  const style = {
    out: "bg-red-600 text-white",
    low: "bg-amber-500 text-white",
    ok: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
  }[status];
  return (
    <div className="space-y-1">
      <div className="tabular-nums">
        {fmtUnits(drug.stockTotal)} <span className="text-xs text-muted-foreground">{drug.unit}</span>
      </div>
      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", style)}>
        {{ out: "Out", low: "Low", ok: "OK" }[status]}
      </span>
    </div>
  );
}

function MarginCell({ drug }: { drug: DrugResponse }) {
  if (drug.margin === null || drug.margin === undefined) {
    return <span className="text-xs text-muted-foreground italic">{drug.isService ? "all profit" : "no cost"}</span>;
  }
  const loss = Number(drug.margin) <= 0;
  return (
    <div className={cn("tabular-nums", loss ? "text-red-600 font-medium" : "")}>
      {money(drug.margin)}
      {drug.marginPct != null && <div className="text-xs opacity-80">{drug.marginPct}%</div>}
    </div>
  );
}

function SortHead({
  label, column, sort, direction, onSort, className,
}: {
  label: string; column: DrugSort; sort: DrugSort; direction: "asc" | "desc"; onSort: (c: DrugSort) => void; className?: string;
}) {
  const activeSort = sort === column;
  const Icon = !activeSort ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className} aria-sort={activeSort ? (direction === "asc" ? "ascending" : "descending") : undefined}>
      <button type="button" onClick={() => onSort(column)} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        <Icon className={cn("h-3.5 w-3.5", !activeSort && "opacity-40")} />
      </button>
    </TableHead>
  );
}

interface DrugTableProps {
  drugs: DrugResponse[];
  isLoading: boolean;
  canManage: boolean;
  sort: DrugSort;
  direction: "asc" | "desc";
  onSort: (column: DrugSort) => void;
  selected: Record<string, DrugResponse>;
  onToggle: (drug: DrugResponse) => void;
  onTogglePage: () => void;
  onSavePrice: (drug: DrugResponse, field: PriceField, value: number) => void;
  onEdit: (drug: DrugResponse) => void;
  onDeactivate: (drug: DrugResponse) => void;
  onReactivate: (drug: DrugResponse) => void;
}

export function DrugTable({
  drugs, isLoading, canManage, sort, direction, onSort, selected, onToggle, onTogglePage, onSavePrice, onEdit, onDeactivate, onReactivate,
}: DrugTableProps) {
  const columns = canManage ? 9 : 5;
  const allOnPage = drugs.length > 0 && drugs.every((d) => selected[d.id]);
  const someOnPage = drugs.some((d) => selected[d.id]);

  return (
    <TooltipProvider delayDuration={150}>
      <Table className={cn("table-fixed", canManage ? "min-w-[1040px]" : "min-w-[640px]")}>
        <TableHeader>
          <TableRow>
            {canManage && (
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all on this page"
                  className="h-4 w-4 rounded border-input"
                  checked={allOnPage}
                  ref={(el) => {
                    if (el) el.indeterminate = someOnPage && !allOnPage;
                  }}
                  onChange={onTogglePage}
                />
              </TableHead>
            )}
            <SortHead label="Medicine" column="name" sort={sort} direction={direction} onSort={onSort} className="w-[28%]" />
            <TableHead className="w-[12%]">Category</TableHead>
            <SortHead label="Stock" column="stock" sort={sort} direction={direction} onSort={onSort} className="w-[10%]" />
            <SortHead label="Selling price" column="price" sort={sort} direction={direction} onSort={onSort} className="w-[14%]" />
            {canManage && <TableHead className="w-[12%]">Buying price</TableHead>}
            {canManage && <SortHead label="Profit" column="margin" sort={sort} direction={direction} onSort={onSort} className="w-[10%]" />}
            <TableHead className="w-[9%]">Status</TableHead>
            {canManage && <TableHead className="w-12 sticky right-0 bg-card" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: columns }).map((_, j) => (
                  <TableCell key={j}>
                    <div className="h-4 w-full bg-muted animate-pulse rounded" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : drugs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns} className="text-center text-muted-foreground py-12">
                <Pill className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No drugs match. Try clearing the filters.
              </TableCell>
            </TableRow>
          ) : (
            drugs.map((drug) => {
              const { main, detail } = splitDrugName(drug);
              const issues = drug.issues ?? [];
              return (
                <TableRow
                  key={drug.id}
                  data-state={selected[drug.id] ? "selected" : undefined}
                  className={cn("hover:bg-accent/50", !drug.active && "opacity-60")}
                >
                  {canManage && (
                    <TableCell className="align-top">
                      <input
                        type="checkbox"
                        aria-label={`Select ${drug.name}`}
                        className="h-4 w-4 rounded border-input"
                        checked={!!selected[drug.id]}
                        onChange={() => onToggle(drug)}
                      />
                    </TableCell>
                  )}
                  <TableCell className="whitespace-normal break-words align-top" title={drug.name}>
                    <div className="flex items-start gap-1.5">
                      <div className="min-w-0">
                        <span className="font-semibold">{main}</span>
                        {drug.isService && <Badge variant="outline" className="ml-1.5 align-middle text-[10px]">Service</Badge>}
                        {detail && <span className="block text-xs text-muted-foreground">{detail}</span>}
                        {drug.brand && !drug.name.toLowerCase().startsWith(drug.brand.toLowerCase()) && (
                          <span className="block text-xs text-muted-foreground">Brand: {drug.brand}</span>
                        )}
                      </div>
                      {canManage && issues.length > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="mt-0.5 shrink-0 text-amber-600" aria-label="Needs attention">
                              <AlertTriangle className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <p className="font-semibold mb-1">Needs attention</p>
                            <ul className="list-disc pl-4 space-y-0.5">
                              {issues.map((i) => <li key={i}>{ISSUE_LABELS[i] ?? i}</li>)}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-normal break-words align-top text-sm">
                    {drug.categoryName ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="align-top"><StockCell drug={drug} /></TableCell>
                  <TableCell className="whitespace-normal align-top">
                    {drug.isService && drug.priceMode === "Manual" ? (
                      <span className="text-sm">
                        Typed at the till
                        {drug.sellingPrice > 0 && <span className="block text-xs text-muted-foreground tabular-nums">suggested {money(drug.sellingPrice)}</span>}
                      </span>
                    ) : (
                      <>
                        <EditablePrice
                          label="Selling price"
                          value={drug.sellingPrice}
                          readOnly={!canManage}
                          onSave={(v) => onSavePrice(drug, "sellingPrice", v)}
                        />
                        {!drug.isService && <span className="text-xs text-muted-foreground"> / {drug.unit}</span>}
                      </>
                    )}
                    {drug.allowsHalfDose && drug.halfDosePrice != null && (
                      <div className="text-xs text-muted-foreground tabular-nums">½ dose: {money(drug.halfDosePrice)}</div>
                    )}
                    {drug.unitsPerPack > 1 && (
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {drug.packUnit ?? "pack"} of {drug.unitsPerPack}: {money(drug.sellingPrice * drug.unitsPerPack)}
                      </div>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell className="align-top">
                      <EditablePrice
                        label="Buying price"
                        value={drug.buyingPrice}
                        emptyLabel="add cost"
                        onSave={(v) => onSavePrice(drug, "buyingPrice", v)}
                      />
                    </TableCell>
                  )}
                  {canManage && <TableCell className="align-top"><MarginCell drug={drug} /></TableCell>}
                  <TableCell className="align-top">
                    <Badge variant={drug.active ? "default" : "secondary"}>{drug.active ? "Active" : "Off"}</Badge>
                    {drug.mergedIntoId && <div className="text-[11px] text-muted-foreground mt-1">Merged</div>}
                  </TableCell>
                  {canManage && (
                    // Always visible: pinned to the right edge even when the table scrolls sideways.
                    <TableCell className="sticky right-0 bg-card align-top shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)]">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(drug)}>Edit</DropdownMenuItem>
                          {drug.active ? (
                            <DropdownMenuItem className="text-destructive" onClick={() => onDeactivate(drug)}>
                              Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => onReactivate(drug)}>Reactivate</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
