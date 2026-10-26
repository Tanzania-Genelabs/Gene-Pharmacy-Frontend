"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { adminCatalogApi } from "@/api/admin.api";
import { apiErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CatalogImportResult, CatalogKind } from "@/types";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

/**
 * Load products into the shared catalog from an Excel or CSV file. The file is checked first (nothing
 * is saved) so problems can be fixed before anything changes.
 */
export function CatalogImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import products from a file</DialogTitle>
          <DialogDescription>
            Excel (.xlsx) or CSV with a header row. Column names are matched loosely: Product / Name, Generic, Strength, Form,
            Category, Manufacturer, Barcode, Rx, Reg No. Only a name is required.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every opening starts clean. */}
        <ImportForm onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ImportForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState("");
  const [kind, setKind] = useState<CatalogKind>("Medicine");
  const [verified, setVerified] = useState(false);
  const [checked, setChecked] = useState<CatalogImportResult | null>(null);
  const [done, setDone] = useState<CatalogImportResult | null>(null);

  const run = useMutation({
    mutationFn: (dryRun: boolean) => adminCatalogApi.import(file!, { dryRun, source: source.trim() || file!.name, kind, verified }),
    onSuccess: (result) => {
      if (result.dryRun) {
        setChecked(result);
        return;
      }
      setDone(result);
      qc.invalidateQueries({ queryKey: ["admin", "catalog"] });
      toast.success(`${result.created} new, ${result.updated} updated`);
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Could not read that file")),
  });

  function choose(next: File | null) {
    setFile(next);
    setChecked(null);
  }

  const summary = done ?? checked;

  return (
    <>
      <div className="space-y-4 px-6 py-4">
        {!done && (
          <>
            <div className="space-y-1">
              <Label htmlFor="ci-file">File *</Label>
              <Input id="ci-file" type="file" accept=".xlsx,.csv,.txt" onChange={(e) => choose(e.target.files?.[0] ?? null)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ci-kind">Type, when a row doesn&apos;t say</Label>
                <select id="ci-kind" className={selectClass} value={kind} onChange={(e) => { setKind(e.target.value as CatalogKind); setChecked(null); }}>
                  {(["Medicine", "Supplement", "Cosmetic", "Device", "Other"] as const).map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ci-source">Where this list came from</Label>
                <Input id="ci-source" placeholder="e.g. TMDA register 2026" value={source} onChange={(e) => setSource(e.target.value)} />
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
              <span>
                Mark these as <strong>checked by a pharmacist</strong>
                <span className="block text-xs text-muted-foreground">Leave unticked unless someone has reviewed the list.</span>
              </span>
            </label>
          </>
        )}

        {summary && (
          <div className="rounded-md border p-3 text-sm space-y-2">
            <p className="flex items-center gap-2 font-medium">
              {done ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : null}
              {done ? "Imported" : "File checked: nothing has been saved yet"}
            </p>
            <p className="text-muted-foreground">
              {summary.totalRows} rows · <strong className="text-foreground">{summary.created}</strong> new ·{" "}
              {summary.updated} would fill in missing details · {summary.unchanged} already there ·{" "}
              <span className={summary.failed ? "text-destructive font-medium" : ""}>{summary.failed} problem rows</span>
            </p>
            {summary.errors.length > 0 && (
              <ul className="max-h-40 overflow-y-auto space-y-1 text-xs text-muted-foreground border-t pt-2">
                {summary.errors.map((e) => (
                  <li key={e.row}>Row {e.row}: {e.reason}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <DialogFooter className="px-6 pb-6">
        {done ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="outline" disabled={!file || run.isPending} onClick={() => run.mutate(true)}>
              {run.isPending && !checked ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check file"}
            </Button>
            <Button disabled={!file || !checked || checked.created + checked.updated === 0 || run.isPending} onClick={() => run.mutate(false)}>
              {run.isPending && checked ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Upload className="h-4 w-4 mr-2" />Import</>)}
            </Button>
          </>
        )}
      </DialogFooter>
    </>
  );
}
