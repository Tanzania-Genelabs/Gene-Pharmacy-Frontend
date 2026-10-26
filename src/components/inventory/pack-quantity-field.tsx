"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatQuantity, hasPacks, packLabel, type PackInfo } from "@/lib/packs";

interface Props {
  id?: string;
  /** Quantity in the drug's smallest unit. */
  value: number;
  onChange: (units: number) => void;
  info: PackInfo;
  allowNegative?: boolean;
  placeholder?: string;
}

/**
 * Lets staff type a quantity either in single units (6 tablets) or whole packs (2 boxes);
 * the parent always receives single units. Give it `key={drugId}` so it resets per drug.
 */
export function PackQuantityField({ id, value, onChange, info, allowNegative = false, placeholder }: Props) {
  const packed = hasPacks(info);
  const [mode, setMode] = useState<"units" | "packs">("units");
  const [raw, setRaw] = useState(value ? String(value) : "");
  const multiplier = mode === "packs" && packed ? info.unitsPerPack : 1;

  // The parent clearing the field (after a save) should clear what is typed.
  useEffect(() => {
    if (Number(raw || 0) * multiplier !== value) {
      setRaw(value === 0 ? "" : String(value / multiplier));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function update(nextRaw: string, nextMode = mode) {
    setRaw(nextRaw);
    const m = nextMode === "packs" && packed ? info.unitsPerPack : 1;
    const parsed = Number(nextRaw);
    onChange(Number.isFinite(parsed) ? Math.trunc(parsed) * m : 0);
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Input
          id={id}
          type="number"
          step={1}
          min={allowNegative ? undefined : 1}
          placeholder={placeholder}
          value={raw}
          onChange={(e) => update(e.target.value)}
        />
        {packed && (
          <select
            aria-label="Quantity in"
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={mode}
            onChange={(e) => {
              const next = e.target.value as "units" | "packs";
              setMode(next);
              update(raw, next);
            }}
          >
            <option value="units">{info.unit}</option>
            <option value="packs">{packLabel(info)} (×{info.unitsPerPack})</option>
          </select>
        )}
      </div>
      {packed && value !== 0 && (
        <p className="text-xs text-muted-foreground">= {formatQuantity(value, info)}</p>
      )}
    </div>
  );
}
