"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, Gift, Loader2 } from "lucide-react";
import { adminBillingPlanApi, adminSubscriptionApi } from "@/api/admin.api";
import { pharmacyApi } from "@/api/pharmacy.api";
import { apiErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BillingPlan } from "@/types";

const MONTH_CHOICES = [1, 2, 3, 4, 5, 6, 9, 12];
const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

const money = (value: number) => `TZS ${value.toLocaleString()}`;
const dateText = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** Adds calendar months the way the server does: 31 Jan + 1 month is 28/29 Feb, not 3 March. */
function addMonths(from: Date, months: number): Date {
  const result = new Date(from.getFullYear(), from.getMonth() + months, 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(from.getDate(), lastDay));
  return result;
}

interface GrantAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preselect a pharmacy (e.g. when opened from a row). */
  pharmacyId?: string;
}

/**
 * For the platform owner: give a pharmacy access without ClickPesa, either because cash was received
 * or as a free promotion. The subscription is extended and the entry lands in the payment ledger.
 */
export function GrantAccessDialog({ open, onOpenChange, pharmacyId }: GrantAccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Give a pharmacy access</DialogTitle>
        </DialogHeader>
        {/* Mounted only while open, so every opening starts from a clean form. */}
        <GrantAccessForm presetPharmacyId={pharmacyId} onDone={() => onOpenChange(false)} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function GrantAccessForm({
  presetPharmacyId,
  onDone,
  onCancel,
}: {
  presetPharmacyId?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const qc = useQueryClient();
  const [pharmacyId, setPharmacyId] = useState(presetPharmacyId ?? "");
  const [kind, setKind] = useState<"Cash" | "Promotion">("Cash");
  const [planType, setPlanType] = useState<BillingPlan>("Standard");
  const [months, setMonths] = useState(1);
  // null = "use the list price"; once the admin types, their figure wins.
  const [amountOverride, setAmountOverride] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const { data: pharmacies } = useQuery({
    queryKey: ["admin", "pharmacies", "for-grant"],
    queryFn: () => pharmacyApi.list({ size: 200 }),
  });

  const { data: plans } = useQuery({
    queryKey: ["admin", "billing-plans"],
    queryFn: () => adminBillingPlanApi.list(),
  });

  // The pharmacy's current subscription, to show when access will end.
  const { data: current } = useQuery({
    queryKey: ["admin", "subscriptions", "of-pharmacy", pharmacyId],
    queryFn: () => adminSubscriptionApi.list({ pharmacyId, size: 1 }),
    enabled: !!pharmacyId,
  });
  const subscription = pharmacyId ? current?.content[0] : undefined;

  const listPrice = useMemo(() => {
    const plan = plans?.find((p) => p.planType === planType);
    return plan ? Number(plan.monthlyPrice) * months : null;
  }, [plans, planType, months]);

  // Cash defaults to the list price until the admin types their own figure.
  const amount = amountOverride ?? (listPrice !== null ? String(listPrice) : "");

  const preview = useMemo(() => {
    if (!pharmacyId) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentEnd = subscription ? new Date(`${subscription.endDate}T00:00:00`) : null;
    const running =
      !!subscription && ["Active", "Trial", "GracePeriod"].includes(subscription.status) && !!currentEnd && currentEnd >= today;
    return {
      currentEnd: subscription ? dateText(currentEnd!) : null,
      running,
      newEnd: dateText(addMonths(running ? currentEnd! : today, months)),
    };
  }, [pharmacyId, subscription, months]);

  const grant = useMutation({
    mutationFn: () =>
      adminSubscriptionApi.grant({
        pharmacyId,
        kind,
        planType,
        months,
        amount: kind === "Cash" && amount.trim() !== "" ? Number(amount) : undefined,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
      }),
    onSuccess: ({ subscription: sub }) => {
      toast.success(`${sub.pharmacyName ?? "The pharmacy"} has access until ${dateText(new Date(`${sub.endDate}T00:00:00`))}`);
      qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      qc.invalidateQueries({ queryKey: ["admin", "payments"] });
      qc.invalidateQueries({ queryKey: ["admin", "system-status"] });
      onDone();
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Could not save this entry")),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();

    if (!pharmacyId) return toast.error("Choose a pharmacy");
    if (kind === "Cash" && (amount.trim() === "" || !Number.isInteger(Number(amount)) || Number(amount) < 1)) {
      return toast.error("Enter the cash amount received, in whole shillings");
    }
    if (kind === "Promotion" && note.trim().length < 3) return toast.error("Say why this promotion is being given");

    grant.mutate();
  }

  return (
    <>
        <form onSubmit={submit} className="space-y-4 px-6 py-4">
          <div className="space-y-1">
            <Label htmlFor="g-pharmacy">Pharmacy *</Label>
            <select id="g-pharmacy" className={selectClass} value={pharmacyId} onChange={(e) => setPharmacyId(e.target.value)}>
              <option value="">Choose a pharmacy…</option>
              {pharmacies?.content.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.status})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Type of entry">
            <button
              type="button"
              role="radio"
              aria-checked={kind === "Cash"}
              onClick={() => setKind("Cash")}
              className={`flex items-center gap-2 rounded-md border p-3 text-left text-sm transition-colors ${kind === "Cash" ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
            >
              <Banknote className="h-4 w-4 shrink-0" />
              <span>
                <span className="block font-medium">Cash received</span>
                <span className="block text-xs text-muted-foreground">They paid you outside the app</span>
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={kind === "Promotion"}
              onClick={() => setKind("Promotion")}
              className={`flex items-center gap-2 rounded-md border p-3 text-left text-sm transition-colors ${kind === "Promotion" ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
            >
              <Gift className="h-4 w-4 shrink-0" />
              <span>
                <span className="block font-medium">Free promotion</span>
                <span className="block text-xs text-muted-foreground">An offer, no payment</span>
              </span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="g-plan">Plan *</Label>
              <select id="g-plan" className={selectClass} value={planType} onChange={(e) => setPlanType(e.target.value as BillingPlan)}>
                {(plans ?? [{ planType: "Basic", monthlyPrice: "" }, { planType: "Standard", monthlyPrice: "" }, { planType: "Premium", monthlyPrice: "" }]).map((p) => (
                  <option key={p.planType} value={p.planType}>
                    {p.planType}
                    {p.monthlyPrice ? ` — ${money(Number(p.monthlyPrice))}/month` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="g-months">For *</Label>
              <select id="g-months" className={selectClass} value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                {MONTH_CHOICES.map((m) => (
                  <option key={m} value={m}>
                    {m} {m === 1 ? "month" : "months"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {kind === "Cash" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="g-amount">Amount received (TZS) *</Label>
                <Input
                  id="g-amount"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmountOverride(e.target.value)}
                />
                {listPrice !== null && Number(amount) !== listPrice && amount !== "" && (
                  <p className="text-xs text-muted-foreground">List price for this is {money(listPrice)}.</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="g-reference">Receipt number</Label>
                <Input id="g-reference" placeholder="optional" value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="g-note">{kind === "Promotion" ? "Why are you giving this? *" : "Note"}</Label>
            <Textarea
              id="g-note"
              rows={2}
              maxLength={500}
              placeholder={kind === "Promotion" ? "e.g. Launch offer for early customers" : "optional, e.g. paid at the office on Friday"}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Private: the pharmacy never sees this note.</p>
          </div>

          {preview && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              {preview.currentEnd ? (
                <p>
                  Currently {preview.running ? "valid until" : "ended on"} <strong>{preview.currentEnd}</strong>.
                </p>
              ) : (
                <p>This pharmacy has no subscription yet.</p>
              )}
              <p className="mt-1">
                After this: access until <strong>{preview.newEnd}</strong>
                {preview.running ? " (added after the current period)" : " (starting today)"}.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={grant.isPending}>
              {grant.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : kind === "Cash" ? "Record cash payment" : "Give promotion"}
            </Button>
          </DialogFooter>
        </form>
    </>
  );
}
