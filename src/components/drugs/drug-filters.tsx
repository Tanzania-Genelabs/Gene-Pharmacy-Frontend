"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CategoryResponse, DrugListParams } from "@/types";

export type QuickFilter = "" | "noBuying" | "noSelling" | "belowCost" | "neverSold" | "attention";

export interface DrugFilters {
  /** "" = all, "none" = no category, else a category id. */
  categoryId: string;
  stock: "" | "out" | "low" | "ok" | "none";
  /** "" = medicines and services, or only one of them. */
  kind: "" | "medicine" | "service";
  quick: QuickFilter;
  showInactive: boolean;
}

export const NO_FILTERS: DrugFilters = { categoryId: "", stock: "", kind: "", quick: "", showInactive: false };

/** The list/export query for these filters. */
export function filterParams(f: DrugFilters, search: string): DrugListParams {
  return {
    search: search || undefined,
    status: f.showInactive ? "all" : "active",
    categoryId: f.categoryId || undefined,
    stock: f.stock || undefined,
    kind: f.kind || undefined,
    missing: f.quick === "noBuying" ? "buyingPrice" : f.quick === "noSelling" ? "sellingPrice" : undefined,
    belowCost: f.quick === "belowCost" ? 1 : undefined,
    neverSold: f.quick === "neverSold" ? 1 : undefined,
    needsAttention: f.quick === "attention" ? 1 : undefined,
  };
}

export const hasFilters = (f: DrugFilters, search: string) =>
  search !== "" || f.categoryId !== "" || f.stock !== "" || f.kind !== "" || f.quick !== "" || f.showInactive;

const STOCK_OPTIONS: { value: DrugFilters["stock"]; label: string }[] = [
  { value: "", label: "All" },
  { value: "out", label: "Out" },
  { value: "low", label: "Low" },
  { value: "ok", label: "OK" },
  { value: "none", label: "Never stocked" },
];

function Chip({ active, onClick, children, tone }: { active: boolean; onClick: () => void; children: React.ReactNode; tone?: "warn" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-sm font-medium transition-colors whitespace-nowrap",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : tone === "warn"
            ? "border-amber-400 bg-amber-500/10 text-amber-800 hover:border-amber-500 dark:text-amber-300"
            : "border-input bg-background text-muted-foreground hover:border-primary hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

interface DrugFilterBarProps {
  filters: DrugFilters;
  onChange: (next: DrugFilters) => void;
  onClear: () => void;
  categories: CategoryResponse[];
  /** Search text, only to know whether "Clear" should show. */
  search: string;
  matches: number | undefined;
  attentionCount: number | undefined;
  /** Owner/Manager: price-related chips are shown. */
  canManage: boolean;
}

export function DrugFilterBar({ filters, onChange, onClear, categories, search, matches, attentionCount, canManage }: DrugFilterBarProps) {
  const set = (patch: Partial<DrugFilters>) => onChange({ ...filters, ...patch });
  const toggleQuick = (q: QuickFilter) => set({ quick: filters.quick === q ? "" : q });
  const active = hasFilters(filters, search);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-xs text-muted-foreground">
          <span className="block">Category</span>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={filters.categoryId}
            onChange={(e) => set({ categoryId: e.target.value })}
          >
            <option value="">All categories</option>
            <option value="none">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.active ? "" : " (inactive)"}</option>
            ))}
          </select>
        </label>
        <div className="space-y-1">
          <span className="block text-xs text-muted-foreground">Show</span>
          <div className="flex flex-wrap gap-1.5">
            {([["", "All"], ["medicine", "Medicines"], ["service", "Services"]] as const).map(([value, label]) => (
              <Chip key={value || "all"} active={filters.kind === value} onClick={() => set({ kind: value })}>{label}</Chip>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <span className="block text-xs text-muted-foreground">Stock</span>
          <div className="flex flex-wrap gap-1.5">
            {STOCK_OPTIONS.map((o) => (
              <Chip key={o.value || "all"} active={filters.stock === o.value} onClick={() => set({ stock: o.value })}>
                {o.label}
              </Chip>
            ))}
          </div>
        </div>
        <label className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            checked={filters.showInactive}
            onChange={(e) => set({ showInactive: e.target.checked })}
          />
          Show switched-off drugs
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground mr-1">Quick checks:</span>
        {canManage && (
          <Chip active={filters.quick === "noBuying"} onClick={() => toggleQuick("noBuying")}>No buying price</Chip>
        )}
        <Chip active={filters.quick === "noSelling"} onClick={() => toggleQuick("noSelling")}>No selling price</Chip>
        <Chip
          active={filters.categoryId === "none"}
          onClick={() => set({ categoryId: filters.categoryId === "none" ? "" : "none" })}
        >
          No category
        </Chip>
        {canManage && (
          <Chip active={filters.quick === "belowCost"} onClick={() => toggleQuick("belowCost")}>Sold below cost</Chip>
        )}
        <Chip active={filters.quick === "neverSold"} onClick={() => toggleQuick("neverSold")}>Never sold</Chip>
        {canManage && (
          <Chip active={filters.quick === "attention"} onClick={() => toggleQuick("attention")} tone={attentionCount ? "warn" : undefined}>
            Needs attention{attentionCount !== undefined ? ` (${attentionCount})` : ""}
          </Chip>
        )}
      </div>

      {active && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {matches === undefined ? "Searching…" : `${matches.toLocaleString()} drug${matches === 1 ? "" : "s"} match`}
          </span>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onClear}>
            <X className="h-3.5 w-3.5 mr-1" />
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
