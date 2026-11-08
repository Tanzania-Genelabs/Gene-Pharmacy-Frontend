"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { money } from "@/components/expenses/format";
import { cn } from "@/lib/utils";

interface EditablePriceProps {
  value: number | null;
  /** Called with the new price when it was changed (Enter or leaving the box). */
  onSave: (value: number) => void;
  /** Read-only view (e.g. a seller). */
  readOnly?: boolean;
  /** Shown instead of a price when there is none. */
  emptyLabel?: string;
  label: string;
}

/** A price you can click to change in place: Enter saves, Esc cancels. */
export function EditablePrice({ value, onSave, readOnly, emptyLabel = "—", label }: EditablePriceProps) {
  const [draft, setDraft] = useState<string | null>(null);

  if (readOnly) {
    return <span className="tabular-nums">{value === null ? <span className="text-muted-foreground">{emptyLabel}</span> : money(value)}</span>;
  }

  function commit() {
    if (draft === null) return;
    const text = draft.trim();
    setDraft(null);
    if (text === "") return;
    const n = Number(text);
    if (!Number.isFinite(n) || n < 0) return;
    if (value !== null && n === value) return;
    onSave(n);
  }

  if (draft !== null) {
    return (
      <input
        autoFocus
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        aria-label={label}
        className="h-8 w-28 rounded-md border border-primary bg-background px-2 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setDraft(null);
          }
        }}
        onBlur={commit}
      />
    );
  }

  return (
    <button
      type="button"
      title={`Click to change the ${label.toLowerCase()} (Enter saves, Esc cancels)`}
      onClick={() => setDraft(value === null ? "" : String(value))}
      className={cn(
        "group inline-flex items-center gap-1 rounded px-1 -mx-1 tabular-nums hover:bg-accent text-left",
        value === null && "text-muted-foreground italic",
      )}
    >
      {value === null ? emptyLabel : money(value)}
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60" />
    </button>
  );
}
