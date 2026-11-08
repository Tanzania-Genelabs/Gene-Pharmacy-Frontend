"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, X } from "lucide-react";
import { drugApi } from "@/api/drug.api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { money } from "@/components/expenses/format";
import { apiErrorMessage } from "@/lib/errors";
import { UNIT_OPTIONS } from "@/lib/drug-units";
import { bulkResultText, selectClass, skipReasonLabel } from "./format";
import type { CategoryResponse, DrugBulkChanges, DrugBulkResult, DrugResponse } from "@/types";

type Action = "category" | "price" | "unit";

const MAX_IDS = 200;

interface BulkActionBarProps {
  pharmacyId: string;
  selected: Record<string, DrugResponse>;
  categories: CategoryResponse[];
  onClear: () => void;
}

/** Sticky bar shown while drugs are ticked: one change for all of them. */
export function BulkActionBar({ pharmacyId, selected, categories, onClear }: BulkActionBarProps) {
  const qc = useQueryClient();
  const drugs = Object.values(selected);
  const ids = drugs.map((d) => d.id);
  const [action, setAction] = useState<Action | null>(null);
  const [result, setResult] = useState<DrugBulkResult | null>(null);

  const mutation = useMutation({
    mutationFn: (changes: DrugBulkChanges) => drugApi.bulkUpdate(pharmacyId, ids, changes),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["drugs", pharmacyId] });
      if (action) {
        setResult(res);
      } else if (res.skipped.length > 0) {
        toast.warning(bulkResultText(res), { duration: 10000 });
      } else {
        toast.success(bulkResultText(res));
      }
      if (res.skipped.length === 0 && !action) onClear();
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Could not change the selected drugs")),
  });

  function run(changes: DrugBulkChanges) {
    if (ids.length > MAX_IDS) {
      toast.error(`Select at most ${MAX_IDS} drugs at a time`);
      return;
    }
    mutation.mutate(changes);
  }

  function open(a: Action) {
    setResult(null);
    setAction(a);
  }

  function closeDialog() {
    const hadResult = result !== null && result.skipped.length === 0;
    setAction(null);
    setResult(null);
    if (hadResult) onClear();
  }

  if (drugs.length === 0) return null;

  return (
    <>
      <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2 pl-3 shadow-lg">
        <span className="text-sm font-medium">{drugs.length} selected</span>
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onClear}>
          <X className="h-3.5 w-3.5 mr-1" /> Clear
        </Button>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button size="sm" variant="outline" onClick={() => open("category")}>Change category</Button>
          <Button size="sm" variant="outline" onClick={() => open("price")}>Change price by %</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={mutation.isPending}>
                More <ChevronDown className="h-3.5 w-3.5 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => run({ active: true })}>Switch on (can be sold)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => run({ active: false })}>Switch off (hide from the till)</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => open("unit")}>Set unit…</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => run({ allowsHalfDose: true })}>Allow half doses</DropdownMenuItem>
              <DropdownMenuItem onClick={() => run({ allowsHalfDose: false })}>Stop half doses</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={action !== null} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          {result ? (
            <ResultView result={result} drugs={drugs} onClose={closeDialog} />
          ) : action === "category" ? (
            <CategoryForm count={drugs.length} categories={categories} pending={mutation.isPending} onCancel={closeDialog} onApply={run} />
          ) : action === "price" ? (
            <PriceForm drugs={drugs} pending={mutation.isPending} onCancel={closeDialog} onApply={run} />
          ) : action === "unit" ? (
            <UnitForm count={drugs.length} pending={mutation.isPending} onCancel={closeDialog} onApply={run} />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface FormProps {
  pending: boolean;
  onCancel: () => void;
  onApply: (changes: DrugBulkChanges) => void;
}

function CategoryForm({ count, categories, pending, onCancel, onApply }: FormProps & { count: number; categories: CategoryResponse[] }) {
  const [categoryId, setCategoryId] = useState("");
  return (
    <>
      <DialogHeader>
        <DialogTitle>Change category</DialogTitle>
        <DialogDescription>Move the {count} selected drugs to one category.</DialogDescription>
      </DialogHeader>
      <div className="px-6 py-2 space-y-1">
        <Label htmlFor="bulk-cat">New category</Label>
        <select id="bulk-cat" className={selectClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">No category</option>
          {categories.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button disabled={pending} onClick={() => onApply({ categoryId: categoryId || null })}>
          {pending ? "Saving…" : `Move ${count} drugs`}
        </Button>
      </DialogFooter>
    </>
  );
}

function UnitForm({ count, pending, onCancel, onApply }: FormProps & { count: number }) {
  const [unit, setUnit] = useState("tablet");
  return (
    <>
      <DialogHeader>
        <DialogTitle>Set unit</DialogTitle>
        <DialogDescription>
          The smallest piece you sell (tablet, bottle…). Prices and stock are counted in it. Existing stock numbers do not change.
        </DialogDescription>
      </DialogHeader>
      <div className="px-6 py-2 space-y-1">
        <Label htmlFor="bulk-unit">Unit</Label>
        <select id="bulk-unit" className={selectClass} value={unit} onChange={(e) => setUnit(e.target.value)}>
          {UNIT_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
        </select>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button disabled={pending} onClick={() => onApply({ unit })}>{pending ? "Saving…" : `Set for ${count} drugs`}</Button>
      </DialogFooter>
    </>
  );
}

function PriceForm({ drugs, pending, onCancel, onApply }: FormProps & { drugs: DrugResponse[] }) {
  const [percent, setPercent] = useState("10");
  const [confirming, setConfirming] = useState(false);
  const pct = Number(percent);
  const valid = percent.trim() !== "" && Number.isFinite(pct) && pct !== 0 && pct >= -90 && pct <= 1000;
  // Same rounding as the server: to the nearest whole shilling.
  const examples = drugs.filter((d) => d.sellingPrice > 0).slice(0, 2);
  const word = pct >= 0 ? "Raise" : "Lower";

  return (
    <>
      <DialogHeader>
        <DialogTitle>Change selling price by %</DialogTitle>
        <DialogDescription>
          Type 10 to raise prices by 10%, or -5 to lower them by 5%. New prices are rounded to whole shillings.
        </DialogDescription>
      </DialogHeader>
      <div className="px-6 py-2 space-y-3">
        <div className="space-y-1">
          <Label htmlFor="bulk-pct">Percent</Label>
          <Input id="bulk-pct" type="number" step="any" inputMode="decimal" value={percent}
            onChange={(e) => { setPercent(e.target.value); setConfirming(false); }} />
        </div>
        {valid && examples.length > 0 && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
            <p className="text-xs text-muted-foreground">For example:</p>
            {examples.map((d) => (
              <p key={d.id} className="flex flex-wrap justify-between gap-2">
                <span className="truncate">{d.name}</span>
                <span className="tabular-nums">
                  {money(d.sellingPrice)} → <strong>{money(Math.round(d.sellingPrice * (1 + pct / 100)))}</strong>
                </span>
              </p>
            ))}
          </div>
        )}
        {!valid && percent.trim() !== "" && <p className="text-xs text-red-600">Use a number between -90 and 1000 (not 0).</p>}
        {confirming && (
          <p className="rounded-md border border-amber-400/50 bg-amber-500/10 p-2 text-sm">
            {word} the selling price of {drugs.length} drugs by {Math.abs(pct)}%? New sales use the new price; old receipts keep theirs.
          </p>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        {confirming ? (
          <Button disabled={pending} onClick={() => onApply({ sellingPricePercent: pct })}>
            {pending ? "Saving…" : `Yes, ${word.toLowerCase()} prices`}
          </Button>
        ) : (
          <Button disabled={!valid} onClick={() => setConfirming(true)}>Continue</Button>
        )}
      </DialogFooter>
    </>
  );
}

function ResultView({ result, drugs, onClose }: { result: DrugBulkResult; drugs: DrugResponse[]; onClose: () => void }) {
  const nameOf = (id: string) => drugs.find((d) => d.id === id)?.name ?? id;
  return (
    <>
      <DialogHeader>
        <DialogTitle>Done</DialogTitle>
        <DialogDescription>{bulkResultText(result)}</DialogDescription>
      </DialogHeader>
      {result.skipped.length > 0 && (
        <ul className="px-6 max-h-60 overflow-y-auto text-sm space-y-1">
          {result.skipped.map((s) => (
            <li key={s.id} className="flex flex-wrap justify-between gap-2 border-b py-1">
              <span className="break-words">{nameOf(s.id)}</span>
              <span className="text-muted-foreground">{skipReasonLabel(s.reason)}</span>
            </li>
          ))}
        </ul>
      )}
      <DialogFooter>
        <Button onClick={onClose}>OK</Button>
      </DialogFooter>
    </>
  );
}
