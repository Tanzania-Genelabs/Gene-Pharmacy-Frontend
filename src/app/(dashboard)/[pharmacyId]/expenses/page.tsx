"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, Loader2, Lock, MoreHorizontal, Plus, Search, Wallet } from "lucide-react";
import { branchApi } from "@/api/branch.api";
import { expenseApi } from "@/api/expense.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ExpenseCategories } from "@/components/expenses/expense-categories";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { downloadBlob, firstOfMonth, isoToday, methodLabel, money } from "@/components/expenses/format";
import { ExpenseSummaryTab } from "@/components/expenses/expense-summary";
import { apiErrorMessage } from "@/lib/errors";
import { useAuthStore } from "@/store/auth.store";
import type { ExpenseResponse } from "@/types";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

const PAGE_SIZE = 20;

export default function ExpensesPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const role = user?.role ?? "";
  const isOwner = role === "Owner" || role === "SuperAdmin";
  const isManager = isOwner || role === "Manager";
  // Owners, and managers whose account is not tied to one branch, can work across branches.
  const canPickBranch = isOwner || (role === "Manager" && !user?.branchId);

  const features = useQuery({ queryKey: ["expenses", pharmacyId, "features"], queryFn: () => expenseApi.features(pharmacyId) });
  const enabled = features.data?.expenses === true;

  const categories = useQuery({
    queryKey: ["expenses", pharmacyId, "categories", "active"],
    queryFn: () => expenseApi.categories(pharmacyId),
    enabled,
  });
  const branches = useQuery({ queryKey: ["branches", pharmacyId], queryFn: () => branchApi.list(pharmacyId), enabled });

  // ─── Filters ───
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(isoToday());
  const [branchId, setBranchId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [status, setStatus] = useState("Recorded");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filters = {
    page,
    size: PAGE_SIZE,
    from,
    to,
    ...(branchId !== "all" ? { branchId } : {}),
    ...(categoryId !== "all" ? { categoryId } : {}),
    ...(status !== "all" ? { status: status as "Recorded" | "Voided" } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  };
  const list = useQuery({
    queryKey: ["expenses", pharmacyId, "list", filters],
    queryFn: () => expenseApi.list(pharmacyId, filters),
    enabled: enabled && !!from && !!to && from <= to,
  });

  const resetPage = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(0);
  };

  // ─── Dialogs ───
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseResponse | null>(null);
  const [voiding, setVoiding] = useState<ExpenseResponse | null>(null);
  const [reason, setReason] = useState("");

  const voidMutation = useMutation({
    mutationFn: () => expenseApi.void(pharmacyId, voiding!.id, reason.trim()),
    onSuccess: () => {
      toast.success("Expense voided");
      qc.invalidateQueries({ queryKey: ["expenses", pharmacyId] });
      setVoiding(null);
      setReason("");
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Could not void the expense")),
  });

  const exportFile = async (format: "csv" | "excel" | "pdf") => {
    try {
      const blob = await expenseApi.export(pharmacyId, format, { from, to, ...(branchId !== "all" ? { branchId } : {}) });
      downloadBlob(blob, `expenses-${from}-to-${to}.${format === "excel" ? "xlsx" : format}`);
    } catch {
      toast.error("Could not export the expenses");
    }
  };

  // ─── Plan gate ───
  if (features.isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!enabled) {
    return (
      <div className="max-w-xl mx-auto py-16">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted"><Lock className="h-6 w-6 text-muted-foreground" /></div>
            <h1 className="text-2xl font-bold">Expense management is not in your plan</h1>
            <p className="text-muted-foreground">
              Record rent, electricity, salaries and every other running cost for each branch, and see your real profit after expenses.
              Upgrade to a plan that includes it.
            </p>
            {isOwner ? (
              <Button asChild><Link href={`/${pharmacyId}/billing`}>See plans</Link></Button>
            ) : (
              <p className="text-sm text-muted-foreground">Ask the pharmacy owner to upgrade the plan.</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const rows = list.data?.content ?? [];
  const totalPages = list.data?.totalPages ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground">
            {isManager ? "Office and running costs for every branch" : "Record costs for your branch. You see the ones you added."}
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Record expense
        </Button>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Expenses</TabsTrigger>
          {isManager && <TabsTrigger value="summary">Summary &amp; profit</TabsTrigger>}
          {isManager && <TabsTrigger value="categories">Categories</TabsTrigger>}
        </TabsList>

        <TabsContent value="list" className="space-y-4 pt-2">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1"><span className="text-xs text-muted-foreground">From</span><Input type="date" value={from} max={to} onChange={(e) => resetPage(setFrom)(e.target.value)} className="w-40" /></div>
            <div className="space-y-1"><span className="text-xs text-muted-foreground">To</span><Input type="date" value={to} min={from} max={isoToday()} onChange={(e) => resetPage(setTo)(e.target.value)} className="w-40" /></div>
            {canPickBranch && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Branch</span>
                <Select value={branchId} onValueChange={resetPage(setBranchId)}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {(branches.data ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Category</span>
              <Select value={categoryId} onValueChange={resetPage(setCategoryId)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {(categories.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isManager && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Show</span>
                <Select value={status} onValueChange={resetPage(setStatus)}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Recorded">Counted</SelectItem>
                    <SelectItem value="Voided">Voided</SelectItem>
                    <SelectItem value="all">Everything</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search description / receipt" value={search} onChange={(e) => resetPage(setSearch)(e.target.value)} className="pl-8 w-60" />
            </div>
            {isManager && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline"><Download className="h-4 w-4 mr-1" />Export</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportFile("csv")}>CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportFile("excel")}>Excel</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportFile("pdf")}>PDF</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    {canPickBranch && <TableHead>Branch</TableHead>}
                    <TableHead>Category</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Paid by</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Recorded by</TableHead>
                    {isManager && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.isLoading && (
                    <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Loading…</TableCell></TableRow>
                  )}
                  {!list.isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        No expenses in this period.
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((e) => (
                    <TableRow key={e.id} className={e.status === "Voided" ? "opacity-60" : ""}>
                      <TableCell className="whitespace-nowrap">{e.expenseDate}</TableCell>
                      {canPickBranch && <TableCell>{e.branchName}</TableCell>}
                      <TableCell>{e.categoryName}</TableCell>
                      <TableCell className="max-w-64">
                        <div className="truncate">{e.description || "—"}</div>
                        {e.reference && <div className="text-xs text-muted-foreground">Ref {e.reference}</div>}
                        {e.status === "Voided" && <div className="text-xs text-destructive">Voided: {e.voidReason}</div>}
                      </TableCell>
                      <TableCell>{methodLabel(e.paymentMethod)}</TableCell>
                      <TableCell className={`text-right tabular-nums font-medium ${e.status === "Voided" ? "line-through" : ""}`}>{money(e.amount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.recordedBy}</TableCell>
                      {isManager && (
                        <TableCell>
                          {e.status === "Voided" ? <Badge variant="outline">Voided</Badge> : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setEditing(e); setFormOpen(true); }}>Edit</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => { setVoiding(e); setReason(""); }}>Void…</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 text-sm">
              <span className="text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </TabsContent>

        {isManager && (
          <TabsContent value="summary" className="pt-2">
            <ExpenseSummaryTab pharmacyId={pharmacyId} branches={(branches.data ?? []).filter((b) => b.status === "Active")} canPickBranch={canPickBranch} />
          </TabsContent>
        )}
        {isManager && (
          <TabsContent value="categories" className="pt-2">
            <ExpenseCategories pharmacyId={pharmacyId} />
          </TabsContent>
        )}
      </Tabs>

      {formOpen && (
        <ExpenseFormDialog
          key={editing?.id ?? "new"}
          open={formOpen}
          onOpenChange={setFormOpen}
          pharmacyId={pharmacyId}
          categories={categories.data ?? []}
          branches={branches.data ?? []}
          canPickBranch={canPickBranch}
          expense={editing}
        />
      )}

      <Dialog open={!!voiding} onOpenChange={(o) => !o && setVoiding(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Void this expense?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {voiding && `${voiding.categoryName} · ${money(voiding.amount)} on ${voiding.expenseDate}`}. It stays in the list but no longer counts in totals or profit. This cannot be undone.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="void-reason">Reason</Label>
            <Textarea id="void-reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Entered twice" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoiding(null)}>Keep it</Button>
            <Button variant="destructive" disabled={reason.trim().length < 3 || voidMutation.isPending} onClick={() => voidMutation.mutate()}>
              {voidMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Void expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
