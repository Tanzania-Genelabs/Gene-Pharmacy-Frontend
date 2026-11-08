"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { drugApi } from "@/api/drug.api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { money } from "@/components/expenses/format";
import { apiErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { DUPLICATE_REASONS, fmtUnits } from "./format";
import type { DuplicateDrug, DuplicateGroup } from "@/types";

export const duplicatesKey = (pharmacyId: string) => ["drugs", pharmacyId, "duplicates"] as const;

/** The one to keep by default: most sales, then most stock, then switched on. */
function bestOf(drugs: DuplicateDrug[]): string {
  return [...drugs].sort(
    (a, b) => b.salesCount - a.salesCount || b.stockTotal - a.stockTotal || Number(b.active) - Number(a.active),
  )[0]?.id;
}

interface DuplicatesDialogProps {
  pharmacyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DuplicatesDialog({ pharmacyId, open, onOpenChange }: DuplicatesDialogProps) {
  const { data, isLoading } = useQuery({
    queryKey: duplicatesKey(pharmacyId),
    queryFn: () => drugApi.duplicates(pharmacyId),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Possible duplicates</DialogTitle>
          <DialogDescription>
            The same medicine entered more than once splits its stock and sales. For each group, pick the one to keep and
            join the others into it.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6 space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Looking for duplicates…</p>
          ) : !data || data.groups.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 py-6 justify-center">
              <CheckCircle2 className="h-5 w-5" /> No duplicates found.
            </p>
          ) : (
            <>
              {data.truncated && (
                <p className="text-xs text-muted-foreground">Showing the first {data.groups.length} groups. Fix these and more will appear.</p>
              )}
              {data.groups.map((g) => <GroupCard key={g.key} pharmacyId={pharmacyId} group={g} />)}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GroupCard({ pharmacyId, group }: { pharmacyId: string; group: DuplicateGroup }) {
  const qc = useQueryClient();
  const [keepChoice, setKeepChoice] = useState<string | null>(null);
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});
  const [confirming, setConfirming] = useState(false);
  const keepId = keepChoice ?? bestOf(group.drugs);
  const mergeIds = group.drugs.filter((d) => d.id !== keepId && !excluded[d.id]).map((d) => d.id);
  const kept = group.drugs.find((d) => d.id === keepId);

  const merge = useMutation({
    mutationFn: () => drugApi.merge(pharmacyId, keepId, mergeIds),
    onSuccess: (res) => {
      toast.success(
        `Joined ${res.mergedIds.length} into ${res.drug.name}. Moved ${fmtUnits(res.movedStock)} in stock and ${res.movedSaleItems} sale line${res.movedSaleItems === 1 ? "" : "s"}.`,
      );
      qc.invalidateQueries({ queryKey: ["drugs", pharmacyId] });
      qc.invalidateQueries({ queryKey: ["inventory", pharmacyId] });
    },
    onError: (err: unknown) => {
      setConfirming(false);
      toast.error(apiErrorMessage(err, "Could not join these drugs"));
    },
  });

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{DUPLICATE_REASONS[group.reason] ?? group.reason}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 pr-2 font-medium">Keep</th>
              <th className="py-1 pr-2 font-medium">Join in</th>
              <th className="py-1 pr-2 font-medium">Drug</th>
              <th className="py-1 pr-2 font-medium">Category</th>
              <th className="py-1 pr-2 font-medium text-right">Stock</th>
              <th className="py-1 pr-2 font-medium text-right">Sales</th>
              <th className="py-1 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {group.drugs.map((d) => {
              const isKeep = d.id === keepId;
              return (
                <tr key={d.id} className={cn("border-t", isKeep && "bg-emerald-500/10")}>
                  <td className="py-1.5 pr-2">
                    <input
                      type="radio"
                      name={`keep-${group.key}`}
                      aria-label={`Keep ${d.name}`}
                      checked={isKeep}
                      onChange={() => { setKeepChoice(d.id); setConfirming(false); }}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="checkbox"
                      aria-label={`Join ${d.name} into the kept one`}
                      disabled={isKeep}
                      checked={!isKeep && !excluded[d.id]}
                      onChange={(e) => { setExcluded((cur) => ({ ...cur, [d.id]: !e.target.checked })); setConfirming(false); }}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <span className="font-medium">{d.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[d.genericName, d.strength, d.barcode && `barcode ${d.barcode}`, money(d.sellingPrice)].filter(Boolean).join(" · ")}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2">{d.categoryName ?? "—"}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{fmtUnits(d.stockTotal)} {d.unit}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{d.salesCount}</td>
                  <td className="py-1.5">{d.active ? "On" : "Off"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {merge.isSuccess ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">Joined.</p>
      ) : confirming ? (
        <div className="rounded-md border border-amber-400/50 bg-amber-500/10 p-3 space-y-2 text-sm">
          <p className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <span>
              Keep <strong>{kept?.name}</strong> and join {mergeIds.length} other{mergeIds.length === 1 ? "" : "s"} into it?
              Stock and sales history of the others will move to the one you keep; the others are switched off.
              <strong> This cannot be undone.</strong>
            </span>
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button size="sm" variant="destructive" disabled={merge.isPending} onClick={() => merge.mutate()}>
              {merge.isPending ? "Joining…" : "Yes, join them"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button size="sm" disabled={mergeIds.length === 0} onClick={() => setConfirming(true)}>
            Keep selected, join {mergeIds.length} into it
          </Button>
        </div>
      )}
    </div>
  );
}
