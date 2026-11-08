"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { drugApi } from "@/api/drug.api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { money } from "@/components/expenses/format";
import { apiErrorMessage } from "@/lib/errors";
import { bulkResultText, splitDrugName } from "./format";
import type { DrugPriceRow, DrugResponse } from "@/types";

interface FillPricesPanelProps {
  pharmacyId: string;
  /** The rows on screen (the list is already filtered to drugs missing this price). */
  drugs: DrugResponse[];
  isLoading: boolean;
  field: "buyingPrice" | "sellingPrice";
  onClose: () => void;
}

/**
 * Fast entry: one price box per drug, Tab from one to the next, then save them all in one go.
 * Empty boxes are left alone.
 */
export function FillPricesPanel({ pharmacyId, drugs, isLoading, field, onClose }: FillPricesPanelProps) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [switchOn, setSwitchOn] = useState(true);
  const buying = field === "buyingPrice";

  const rows: DrugPriceRow[] = Object.entries(drafts)
    .filter(([, v]) => v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) >= 0)
    .map(([id, v]) => ({ id, [field]: Number(v) }));
  const offIds = new Set(drugs.filter((d) => !d.active).map((d) => d.id));

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await drugApi.bulkPrices(pharmacyId, rows);
      // New catalog drugs come in switched off with price 0: switch on the ones that now have a price.
      if (!buying && switchOn) {
        const skipped = new Set(res.skipped.map((s) => s.id));
        const toSwitch = rows.map((r) => r.id).filter((id) => offIds.has(id) && !skipped.has(id) && Number(drafts[id]) > 0);
        if (toSwitch.length > 0) await drugApi.bulkUpdate(pharmacyId, toSwitch, { active: true });
      }
      return res;
    },
    onSuccess: (res) => {
      if (res.skipped.length > 0) toast.warning(bulkResultText(res), { duration: 10000 });
      else toast.success(`Saved ${res.updated} price${res.updated === 1 ? "" : "s"}`);
      setDrafts({});
      qc.invalidateQueries({ queryKey: ["drugs", pharmacyId] });
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Could not save the prices")),
  });

  return (
    <Card className="border-primary/40">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold">Fill {buying ? "buying" : "selling"} prices</h3>
            <p className="text-xs text-muted-foreground">
              Type the {buying ? "price you pay" : "price you sell at"} per unit, press Tab to go to the next one, then Save all.
              Leave a box empty to skip it. Saved drugs drop off this list.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Done</Button>
            <Button size="sm" disabled={rows.length === 0 || mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? "Saving…" : `Save all (${rows.length})`}
            </Button>
          </div>
        </div>
        {!buying && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 rounded border-input" checked={switchOn} onChange={(e) => setSwitchOn(e.target.checked)} />
            Also switch on switched-off drugs once they have a price, so they can be sold
          </label>
        )}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : drugs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nothing left to fill on this page. Well done.</p>
        ) : (
          <ul className="divide-y">
            {drugs.map((d) => {
              const { main, detail } = splitDrugName(d);
              return (
                <li key={d.id} className="flex flex-wrap items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{main}</span>
                    {!d.active && <span className="ml-2 text-xs text-muted-foreground">(off)</span>}
                    <span className="block text-xs text-muted-foreground truncate">
                      {detail ? `${detail} · ` : ""}
                      {buying ? `sells at ${money(d.sellingPrice)}` : d.buyingPrice != null ? `costs ${money(d.buyingPrice)}` : ""} / {d.unit}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    aria-label={`${buying ? "Buying" : "Selling"} price of ${d.name}`}
                    placeholder="TZS"
                    className="h-9 w-32 rounded-md border border-input bg-background px-2 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                    value={drafts[d.id] ?? ""}
                    onChange={(e) => setDrafts((cur) => ({ ...cur, [d.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && rows.length > 0) {
                        e.preventDefault();
                        mutation.mutate();
                      }
                    }}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
