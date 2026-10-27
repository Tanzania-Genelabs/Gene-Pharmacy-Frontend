"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { pharmacyApi } from "@/api/pharmacy.api";
import { apiErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PharmacyLimits } from "@/types";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

type Key = "maxUsers" | "maxBranches";
type Mode = "plan" | "custom" | "unlimited";

const show = (limit: number | null) => (limit === null ? "unlimited" : String(limit));

interface PharmacyLimitsDialogProps {
  pharmacyId: string | null;
  pharmacyName?: string;
  onOpenChange: (open: boolean) => void;
}

/**
 * For the platform owner: give one pharmacy its own account / branch limits (e.g. a chain with five branches)
 * without changing the plan for everyone.
 */
export function PharmacyLimitsDialog({ pharmacyId, pharmacyName, onOpenChange }: PharmacyLimitsDialogProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "pharmacy-limits", pharmacyId],
    queryFn: () => pharmacyApi.getLimits(pharmacyId!),
    enabled: !!pharmacyId,
    // Always show current usage, never a stale copy from the last time the dialog was open.
    gcTime: 0,
  });

  return (
    <Dialog open={!!pharmacyId} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Plan limits{pharmacyName ? ` · ${pharmacyName}` : ""}</DialogTitle>
          <DialogDescription>
            Override what this pharmacy&apos;s plan allows. It only affects accounts and branches added afterwards; nothing
            existing is switched off.
          </DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <LimitsForm pharmacyId={pharmacyId!} limits={data} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function LimitsForm({ pharmacyId, limits, onDone }: { pharmacyId: string; limits: PharmacyLimits; onDone: () => void }) {
  const qc = useQueryClient();

  const initial = (key: Key): { mode: Mode; value: string } => {
    if (!limits.overrides[key]) return { mode: "plan", value: "" };
    const current = limits.effective[key];
    return current === null ? { mode: "unlimited", value: "" } : { mode: "custom", value: String(current) };
  };

  const [users, setUsers] = useState(() => initial("maxUsers"));
  const [branches, setBranches] = useState(() => initial("maxBranches"));

  const valid = (v: { mode: Mode; value: string }) => v.mode !== "custom" || (Number.isInteger(Number(v.value)) && Number(v.value) >= 1 && v.value.trim() !== "");
  const dirty =
    JSON.stringify([users, branches]) !== JSON.stringify([initial("maxUsers"), initial("maxBranches")]);

  const save = useMutation({
    mutationFn: () => {
      const body: { maxUsers?: number | null; maxBranches?: number | null; useDefault: Key[] } = { useDefault: [] };
      for (const [key, v] of [["maxUsers", users], ["maxBranches", branches]] as const) {
        if (v.mode === "plan") body.useDefault.push(key);
        else body[key] = v.mode === "unlimited" ? null : Number(v.value);
      }
      return pharmacyApi.updateLimits(pharmacyId, body);
    },
    onSuccess: (saved) => {
      toast.success(`Limits saved: ${show(saved.effective.maxUsers)} accounts, ${show(saved.effective.maxBranches)} branches`);
      qc.invalidateQueries({ queryKey: ["admin", "pharmacy-limits", pharmacyId] });
      onDone();
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Could not save the limits")),
  });

  const row = (
    key: Key,
    label: string,
    inUse: number,
    state: { mode: Mode; value: string },
    set: (v: { mode: Mode; value: string }) => void,
  ) => (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-muted-foreground">{inUse} in use</span>
      </div>
      <div className="flex gap-2">
        <select className={selectClass} aria-label={`${label} setting`} value={state.mode} onChange={(e) => set({ ...state, mode: e.target.value as Mode })}>
          <option value="plan">
            Follow the plan{limits.planType ? ` (${limits.planType}: ${show(limits.plan[key])})` : ` (${show(limits.plan[key])})`}
          </option>
          <option value="custom">A number just for this pharmacy</option>
          <option value="unlimited">Unlimited</option>
        </select>
        {state.mode === "custom" && (
          <Input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            aria-label={`${label} limit`}
            className={`w-24 ${valid(state) ? "" : "border-destructive"}`}
            value={state.value}
            onChange={(e) => set({ ...state, value: e.target.value })}
          />
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="space-y-4">
        {!limits.planType && (
          <p className="text-sm text-muted-foreground">This pharmacy has no subscription yet, so no plan limits apply to it.</p>
        )}
        {row("maxUsers", "Accounts (owner included)", limits.usage.users, users, setUsers)}
        {row("maxBranches", "Active branches", limits.usage.branches, branches, setBranches)}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button disabled={!dirty || !valid(users) || !valid(branches) || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save limits"}
        </Button>
      </DialogFooter>
    </>
  );
}
