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
import { apiErrorMessage } from "@/lib/errors";
import type { AdminBillingPlan, BillingPlan } from "@/types";

const money = (value: string | number) => `TZS ${Number(value).toLocaleString()}`;

/** One editable row: keeps its own draft so typing doesn't refetch the whole table. */
function PlanRow({ plan }: { plan: AdminBillingPlan }) {
  const qc = useQueryClient();
  const [monthly, setMonthly] = useState(plan.monthlyPrice);
  const [weekly, setWeekly] = useState(plan.weeklyPrice ?? "");
  const [maxUsers, setMaxUsers] = useState(plan.maxUsers?.toString() ?? "");
  const [maxBranches, setMaxBranches] = useState(plan.maxBranches?.toString() ?? "");
  const [active, setActive] = useState(plan.active);

  const monthlyNumber = Number(monthly);
  const monthlyValid = Number.isInteger(monthlyNumber) && monthlyNumber >= 1;
  // Weekly is optional: empty means "not sold weekly".
  const weeklyNumber = Number(weekly);
  const weeklyValid = weekly.trim() === "" || (Number.isInteger(weeklyNumber) && weeklyNumber >= 1);
  // Limits are optional too: empty means unlimited.
  const limitValid = (value: string) => value.trim() === "" || (Number.isInteger(Number(value)) && Number(value) >= 1);
  const usersValid = limitValid(maxUsers);
  const branchesValid = limitValid(maxBranches);
  const dirty =
    monthly !== plan.monthlyPrice ||
    weekly !== (plan.weeklyPrice ?? "") ||
    maxUsers !== (plan.maxUsers?.toString() ?? "") ||
    maxBranches !== (plan.maxBranches?.toString() ?? "") ||
    active !== plan.active;

  // What 4 weeks costs compared with a month: shown so you can see the premium paid for flexibility.
  const fourWeeks = weekly.trim() !== "" && weeklyValid ? weeklyNumber * 4 : null;
  const premiumPct = fourWeeks !== null && monthlyValid ? Math.round(((fourWeeks - monthlyNumber) / monthlyNumber) * 100) : null;

  const save = useMutation({
    mutationFn: () =>
      adminBillingPlanApi.update(plan.planType as BillingPlan, {
        monthlyPrice: monthlyNumber,
        weeklyPrice: weekly.trim() === "" ? null : weeklyNumber,
        maxUsers: maxUsers.trim() === "" ? null : Number(maxUsers),
        maxBranches: maxBranches.trim() === "" ? null : Number(maxBranches),
        active,
      }),
    onSuccess: (saved) => {
      toast.success(
        `${saved.planType}: ${money(saved.monthlyPrice)} per month, ${saved.weeklyPrice ? `${money(saved.weeklyPrice)} per week` : "not sold weekly"}, ${saved.active ? "on sale" : "switched off"}`,
      );
      qc.invalidateQueries({ queryKey: ["admin", "billing-plans"] });
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Could not save the plan")),
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
            aria-label={`${plan.planType} weekly price`}
            placeholder="not sold weekly"
            value={weekly}
            onChange={(e) => setWeekly(e.target.value)}
            className={weeklyValid ? "" : "border-destructive"}
          />
        </div>
        {!weeklyValid && <p className="text-xs text-destructive mt-1">Whole shillings, at least 1 (or empty)</p>}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 max-w-56">
          <span className="text-sm text-muted-foreground">TZS</span>
          <Input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            aria-label={`${plan.planType} monthly price`}
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            className={monthlyValid ? "" : "border-destructive"}
          />
        </div>
        {!monthlyValid && <p className="text-xs text-destructive mt-1">Whole shillings, at least 1</p>}
        {premiumPct !== null && (
          <p className="text-xs text-muted-foreground mt-1">
            4 weeks = {money(fourWeeks!)} ({premiumPct > 0 ? `${premiumPct}% more than a month` : premiumPct < 0 ? `${-premiumPct}% LESS than a month` : "same as a month"})
          </p>
        )}
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          aria-label={`${plan.planType} user limit`}
          placeholder="unlimited"
          value={maxUsers}
          onChange={(e) => setMaxUsers(e.target.value)}
          className={`max-w-28 ${usersValid ? "" : "border-destructive"}`}
        />
        {!usersValid && <p className="text-xs text-destructive mt-1">Whole number, at least 1 (or empty)</p>}
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          aria-label={`${plan.planType} branch limit`}
          placeholder="unlimited"
          value={maxBranches}
          onChange={(e) => setMaxBranches(e.target.value)}
          className={`max-w-28 ${branchesValid ? "" : "border-destructive"}`}
        />
        {!branchesValid && <p className="text-xs text-destructive mt-1">Whole number, at least 1 (or empty)</p>}
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
        <Button size="sm" disabled={!dirty || !monthlyValid || !weeklyValid || !usersValid || !branchesValid || save.isPending} onClick={() => save.mutate()}>
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
            <Banknote className="h-4 w-4" /> Price per plan
          </CardTitle>
          <CardDescription>
            Pharmacies can pay <strong>weekly</strong> (1 to 4 weeks at a time) or <strong>monthly</strong> (1 to 12 months at a time).
            They pay the weekly price times the number of weeks, or the monthly price times the number of months. Price a week a
            little higher than a quarter of the month, so weekly is a convenience and monthly stays the better deal. Leave the
            weekly price empty to sell a plan only monthly. A change applies to payments started afterwards; a payment already
            waiting for approval keeps the price it was created with. Switching a plan off hides it from pharmacies but does not
            affect those already on it. <strong>Max accounts</strong> counts the owner and every active staff account;{" "}
            <strong>Max branches</strong> counts active branches. Leave a limit empty for unlimited. When a pharmacy reaches its
            limit it cannot add another until it deactivates one or upgrades; nothing it already has is switched off.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Weekly price</TableHead>
                <TableHead>Monthly price</TableHead>
                <TableHead>Max accounts</TableHead>
                <TableHead>Max branches</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead>Last changed by</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {/* key includes the saved values so a row resets its draft after a successful save */}
              {plans?.map((plan) => (
                <PlanRow key={`${plan.planType}-${plan.monthlyPrice}-${plan.weeklyPrice}-${plan.maxUsers}-${plan.maxBranches}-${plan.active}`} plan={plan} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
