"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PERIOD_LABELS, isValidRange, type DateRange, type PeriodPreset } from "@/lib/periods";

interface PeriodPickerProps {
  presets: PeriodPreset[];
  preset: PeriodPreset;
  onPresetChange: (preset: PeriodPreset) => void;
  custom: DateRange;
  onCustomChange: (range: DateRange) => void;
  className?: string;
}

/** Quick period chips; "Pick dates" opens two date boxes (choose the same day twice for one day). */
export function PeriodPicker({ presets, preset, onPresetChange, custom, onCustomChange, className }: PeriodPickerProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPresetChange(p)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              preset === p
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background text-muted-foreground hover:border-primary hover:text-foreground",
            )}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            From
            <Input
              type="date"
              className="h-9 w-40"
              value={custom.from}
              max={custom.to || undefined}
              onChange={(e) => onCustomChange({ ...custom, from: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            To
            <Input
              type="date"
              className="h-9 w-40"
              value={custom.to}
              min={custom.from || undefined}
              onChange={(e) => onCustomChange({ ...custom, to: e.target.value })}
            />
          </label>
          {isValidRange(custom) ? (
            <span className="text-xs text-muted-foreground">For one day, pick the same date twice.</span>
          ) : (
            <span className="text-xs text-red-600">
              {custom.from && custom.to && custom.from <= custom.to
                ? "Pick at most one year at a time."
                : "The \u201cFrom\u201d date must be on or before the \u201cTo\u201d date."}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
