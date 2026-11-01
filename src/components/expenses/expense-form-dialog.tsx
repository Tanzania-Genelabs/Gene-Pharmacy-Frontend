"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { expenseApi } from "@/api/expense.api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiErrorMessage } from "@/lib/errors";
import type { BranchResponse, ExpenseCategory, ExpensePaymentMethod, ExpenseResponse } from "@/types";
import { isoToday, PAYMENT_METHODS } from "./format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pharmacyId: string;
  categories: ExpenseCategory[];
  branches: BranchResponse[];
  /** Owners (and managers without a branch) choose the branch; everyone else records for their own. */
  canPickBranch: boolean;
  expense?: ExpenseResponse | null;
}

/** Mounted fresh each time it opens (the page gives it a key), so the draft always starts from the right expense. */
export function ExpenseFormDialog({ open, onOpenChange, pharmacyId, categories, branches, canPickBranch, expense }: Props) {
  const qc = useQueryClient();
  const isEdit = !!expense;
  const activeBranches = branches.filter((b) => b.status === "Active");

  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? "");
  const [amount, setAmount] = useState(expense ? String(Number(expense.amount)) : "");
  const [expenseDate, setExpenseDate] = useState(expense?.expenseDate ?? isoToday());
  const [branchId, setBranchId] = useState(expense?.branchId ?? (activeBranches.length === 1 ? activeBranches[0].id : ""));
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>(expense?.paymentMethod ?? "Cash");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [reference, setReference] = useState(expense?.reference ?? "");

  const amountNumber = Number(amount);
  const valid = !!categoryId && amount.trim() !== "" && amountNumber > 0 && (!canPickBranch || !!branchId) && !!expenseDate;

  const save = useMutation({
    mutationFn: () => {
      const body = {
        categoryId,
        amount: amountNumber,
        expenseDate,
        paymentMethod,
        description: description.trim() || undefined,
        reference: reference.trim() || undefined,
        ...(canPickBranch ? { branchId } : {}),
      };
      return isEdit ? expenseApi.update(pharmacyId, expense!.id, { ...body, description: description.trim(), reference: reference.trim() }) : expenseApi.create(pharmacyId, body);
    },
    onSuccess: () => {
      toast.success(isEdit ? "Expense updated" : "Expense recorded");
      qc.invalidateQueries({ queryKey: ["expenses", pharmacyId] });
      onOpenChange(false);
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Could not save the expense")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit expense" : "Record an expense"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) save.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category <span className="text-destructive">*</span></Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  {categories.filter((c) => c.active || c.id === expense?.categoryId).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-amount">Amount (TZS) <span className="text-destructive">*</span></Label>
              <Input id="exp-amount" type="number" min={1} step="any" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25000" autoFocus />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="exp-date">Date</Label>
              <Input id="exp-date" type="date" value={expenseDate} max={isoToday()} onChange={(e) => setExpenseDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Paid by</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as ExpensePaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {canPickBranch && (
            <div className="space-y-1.5">
              <Label>Branch <span className="text-destructive">*</span></Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger><SelectValue placeholder="Choose a branch…" /></SelectTrigger>
                <SelectContent>
                  {activeBranches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="exp-desc">What was it for?</Label>
            <Input id="exp-desc" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. October office rent" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exp-ref">Receipt / reference no. (optional)</Label>
            <Input id="exp-ref" value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!valid || save.isPending}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? "Save changes" : "Record expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
