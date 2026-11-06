"use client";

import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DrugResponse } from "@/types";

const MAX_SHOWN = 40;

type PickableDrug = Pick<DrugResponse, "id" | "name" | "brand" | "genericName" | "barcode" | "unit">;

interface DrugPickerProps {
  id?: string;
  drugs: PickableDrug[] | undefined;
  value: string;
  onChange: (drugId: string) => void;
}

/**
 * A drug list that can be searched by name, brand, generic name or barcode. It sits inside the dialog
 * (not in a pop-up layer) and uses the theme colours, so it stays readable in dark mode, unlike the
 * browser's own drop-down.
 */
export function DrugPicker({ id, drugs, value, onChange }: DrugPickerProps) {
  const [query, setQuery] = useState("");
  const selected = drugs?.find((d) => d.id === value);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = drugs ?? [];
    if (!q) return all;
    return all.filter((d) =>
      [d.name, d.brand, d.genericName, d.barcode].some((field) => field?.toLowerCase().includes(q)),
    );
  }, [drugs, query]);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
        <div className="min-w-0">
          <p className="truncate font-medium">{selected.name}</p>
          {(selected.brand || selected.genericName) && (
            <p className="truncate text-xs text-muted-foreground">{selected.brand ?? selected.genericName}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => { onChange(""); setQuery(""); }}
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-3 w-3" /> Change
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          id={id}
          autoComplete="off"
          placeholder={drugs ? `Search ${drugs.length} drugs by name, brand or barcode…` : "Loading drugs…"}
          className="pl-8"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <ul
        role="listbox"
        aria-label="Drugs"
        className="max-h-48 overflow-y-auto rounded-md border border-input bg-popover text-popover-foreground"
      >
        {matches.length === 0 ? (
          <li className="px-3 py-4 text-center text-sm text-muted-foreground">
            {drugs ? (query ? `No drug matches “${query}”` : "No drugs yet") : "Loading…"}
          </li>
        ) : (
          matches.slice(0, MAX_SHOWN).map((d) => (
            <li key={d.id} role="option" aria-selected={d.id === value}>
              <button
                type="button"
                onClick={() => onChange(d.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:outline-none",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate">{d.name}</span>
                  {(d.brand || d.genericName) && (
                    <span className="block truncate text-xs text-muted-foreground">{d.brand ?? d.genericName}</span>
                  )}
                </span>
                {d.id === value && <Check className="h-4 w-4 shrink-0" />}
              </button>
            </li>
          ))
        )}
        {matches.length > MAX_SHOWN && (
          <li className="border-t border-input px-3 py-1.5 text-center text-xs text-muted-foreground">
            Showing {MAX_SHOWN} of {matches.length}. Keep typing to narrow it down.
          </li>
        )}
      </ul>
    </div>
  );
}
