"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, Loader2 } from "lucide-react";
import { adminBillingPlanApi } from "@/api/admin.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminBillingPlan, BillingPlan } from "@/types";

const money = (value: string | number) => `TZS ${Number(value).toLocaleString()}`;

/** One editable row: keeps its own draft so typing doesn't refetch the whole table. */
function PlanRow({ plan }: { plan: AdminBillingPlan }) {
  const qc = useQueryClient();
  const [price, setPrice] = useState(plan.monthlyPrice);
  const [active, setActive] = useState(plan.active);

  const priceNumber = Number(price);
  const priceValid = Number.isInteger(priceNumber) && priceNumber >= 1;
  const dirty = price !== plan.monthlyPrice || active !== plan.active;

  const save = useMutation({
    mutationFn: () =>
      adminBillingPlanApi.update(plan.planType as BillingPlan, { monthlyPrice: priceNumber, active }),
    onSuccess: (saved) => {
      toast.success(`${saved.planType}: ${money(saved.monthlyPrice)} per month, ${saved.active ? "on sale" : "switched off"}`);
      qc.invalidateQueries({ queryKey: ["admin", "billing-plans"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string; violations?: { message: string }[] } } })?.response?.data;
      toast.error(msg?.violations?.[0]?.message ?? msg?.message ?? "Could not save the plan");
    },
  });

  return (
    <TableRow>
      <TableCell className="font-semibold">{plan.planType}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2 max-w-56">
          <span className="text-sm text-muted-foreground">TZS</span>
          <Input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            aria-label={`${plan.planType} monthly price`}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={priceValid ? "" : "border-destructive"}
          />
        </div>
        {!priceValid && <p className="text-xs text-destructive mt-1">Whole shillings, at least 1</p>}
      </TableCell>
      <TableCell>
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          {active ? <Badge>On sale</Badge> : <Badge variant="outline">Switched off</Badge>}
        </label>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {plan.updatedBy ? (
          <>
            {plan.updatedBy}
            <br />
            {plan.updatedAt ? new Date(plan.updatedAt).toLocaleString() : ""}
          </>
        ) : (
          "Starting price"
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" disabled={!dirty || !priceValid || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function AdminBillingPlansPage() {
  const { data: plans, isLoading } = useQuery({
    queryKey: ["admin", "billing-plans"],
    queryFn: () => adminBillingPlanApi.list(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Plans &amp; Pricing</h1>
        <p className="text-muted-foreground">What pharmacies pay for their Gene Pharmacy subscription</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Banknote className="h-4 w-4" /> Monthly price per plan
          </CardTitle>
          <CardDescription>
            A change applies to payments started afterwards; a payment already waiting for approval keeps the price it
            was created with. Switching a plan off hides it from pharmacies but does not affect those already on it.
            Pharmacies choose 1, 3, 6 or 12 months and pay the monthly price times the number of months.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Monthly price</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead>Last changed by</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {/* key includes the saved values so a row resets its draft after a successful save */}
              {plans?.map((plan) => (
                <PlanRow key={`${plan.planType}-${plan.monthlyPrice}-${plan.active}`} plan={plan} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
