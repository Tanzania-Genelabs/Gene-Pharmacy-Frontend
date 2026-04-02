"use client";

import { use, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shiftApi } from "@/api/shift.api";
import { branchApi } from "@/api/branch.api";
import { useAuthStore } from "@/store/auth.store";
import { toast } from "sonner";
import { Clock, Play, Square, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import type { ShiftStatus, OpenShiftRequest, CloseShiftRequest, ShiftResponse } from "@/types";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

const STATUS_VARIANT: Record<ShiftStatus, "default" | "secondary" | "destructive" | "outline"> = {
  Open: "default",
  Closed: "secondary",
  Suspended: "destructive",
};

function fmt(n: number | null | undefined) {
  return n != null ? n.toLocaleString("en-TZ") : "—";
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-TZ", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const SELECT_CLS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

export default function ShiftsPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isSeller = user?.role === "Seller";

  const [page, setPage] = useState(0);

  // Dialogs
  const [showOpen, setShowOpen] = useState(false);
  const [openForm, setOpenForm] = useState({ branchId: user?.branchId ?? "", openingCash: "", notes: "" });
  const [showClose, setShowClose] = useState(false);
  const [closeTarget, setCloseTarget] = useState<ShiftResponse | null>(null);
  const [closeForm, setCloseForm] = useState({ closingCash: "", notes: "" });

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ["shifts", pharmacyId, page, user?.branchId],
    queryFn: () =>
      shiftApi.list(pharmacyId, {
        page,
        size: 20,
        ...(isSeller && user?.branchId ? { branchId: user.branchId } : {}),
      }),
    placeholderData: (prev) => prev,
  });

  const { data: branches } = useQuery({
    queryKey: ["branches", pharmacyId],
    queryFn: () => branchApi.list(pharmacyId),
  });

  const branchMap = useMemo(() => {
    const m: Record<string, string> = {};
    branches?.forEach((b) => { m[b.id] = b.name; });
    return m;
  }, [branches]);

  const activeBranches = useMemo(
    () => branches?.filter((b) => b.status === "Active") ?? [],
    [branches],
  );

  // Mutations
  const openMutation = useMutation({
    mutationFn: (data: OpenShiftRequest) => shiftApi.open(pharmacyId, data),
    onSuccess: () => {
      toast.success("Shift opened successfully");
      qc.invalidateQueries({ queryKey: ["shifts", pharmacyId] });
      setShowOpen(false);
      setOpenForm({ branchId: user?.branchId ?? "", openingCash: "", notes: "" });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to open shift";
      toast.error(msg);
    },
  });

  const closeMutation = useMutation({
    mutationFn: ({ shiftId, data }: { shiftId: string; data: CloseShiftRequest }) =>
      shiftApi.close(pharmacyId, shiftId, data),
    onSuccess: () => {
      toast.success("Shift closed successfully");
      qc.invalidateQueries({ queryKey: ["shifts", pharmacyId] });
      setShowClose(false);
      setCloseTarget(null);
      setCloseForm({ closingCash: "", notes: "" });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to close shift";
      toast.error(msg);
    },
  });

  function handleOpenShift(e: React.FormEvent) {
    e.preventDefault();
    if (!openForm.branchId) { toast.error("Select a branch"); return; }
    const cash = parseFloat(openForm.openingCash);
    if (isNaN(cash) || cash < 0) { toast.error("Enter a valid opening cash amount"); return; }
    openMutation.mutate({
      branchId: openForm.branchId,
      openingCash: cash,
      notes: openForm.notes.trim() || undefined,
    });
  }

  function handleCloseShift(e: React.FormEvent) {
    e.preventDefault();
    if (!closeTarget) return;
    const cash = parseFloat(closeForm.closingCash);
    if (isNaN(cash) || cash < 0) { toast.error("Enter a valid closing cash amount"); return; }
    closeMutation.mutate({
      shiftId: closeTarget.id,
      data: { closingCash: cash, notes: closeForm.notes.trim() || undefined },
    });
  }

  function openCloseDialog(shift: ShiftResponse) {
    setCloseTarget(shift);
    setCloseForm({ closingCash: "", notes: "" });
    setShowClose(true);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Shifts</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {data?.totalElements ?? 0} shift records
          </p>
        </div>
        <Button size="sm" onClick={() => setShowOpen(true)}>
          <Play className="h-4 w-4 mr-2" />
          Open Shift
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Branch</TableHead>
                <TableHead>Opening Cash</TableHead>
                <TableHead>Closing Cash</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Discrepancy</TableHead>
                <TableHead>Sales</TableHead>
                <TableHead>Total Sales</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Opened At</TableHead>
                <TableHead>Closed At</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 11 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 w-full bg-muted animate-pulse rounded" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !data?.content.length ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-14">
                    <Clock className="h-9 w-9 mx-auto mb-2 opacity-25" />
                    <p className="text-sm">No shifts recorded yet</p>
                    <p className="text-xs mt-1 opacity-70">Click &ldquo;Open Shift&rdquo; to start a cashier session</p>
                  </TableCell>
                </TableRow>
              ) : (
                data.content.map((shift) => {
                  const disc = shift.cashDiscrepancy;
                  const discColor = disc == null ? "" : disc < 0 ? "text-destructive" : disc > 0 ? "text-emerald-600" : "";
                  return (
                    <TableRow key={shift.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium">
                        {branchMap[shift.branchId] ?? shift.branchId.slice(0, 8) + "…"}
                      </TableCell>
                      <TableCell className="tabular-nums">TZS {fmt(shift.openingCash)}</TableCell>
                      <TableCell className="tabular-nums">
                        {shift.closingCash != null ? `TZS ${fmt(shift.closingCash)}` : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {shift.expectedCash != null ? `TZS ${fmt(shift.expectedCash)}` : "—"}
                      </TableCell>
                      <TableCell className={`tabular-nums font-medium ${discColor}`}>
                        {disc != null ? `${disc >= 0 ? "+" : ""}TZS ${fmt(Math.abs(disc))}` : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">{shift.totalSalesCount ?? 0}</TableCell>
                      <TableCell className="tabular-nums font-medium">TZS {fmt(shift.totalSalesAmount)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[shift.status] ?? "secondary"}>
                          {shift.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground text-xs whitespace-nowrap">
                        {fmtDate(shift.openedAt)}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground text-xs whitespace-nowrap">
                        {fmtDate(shift.closedAt)}
                      </TableCell>
                      <TableCell>
                        {shift.status === "Open" && (
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => openCloseDialog(shift)}
                            title="Close shift"
                          >
                            <Square className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground">Page {page + 1} of {data.totalPages}</span>
          <Button variant="outline" size="sm" disabled={data.first} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" disabled={data.last} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Open Shift Dialog */}
      <Dialog open={showOpen} onOpenChange={setShowOpen}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" />
              Open New Shift
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleOpenShift} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="open-branch">Branch *</Label>
              {isSeller ? (
                <div className="h-9 flex items-center rounded-md border border-input bg-muted px-3 text-sm">
                  {branchMap[openForm.branchId] ?? "Your Branch"}
                </div>
              ) : (
                <select
                  id="open-branch"
                  className={SELECT_CLS}
                  value={openForm.branchId}
                  onChange={(e) => setOpenForm((f) => ({ ...f, branchId: e.target.value }))}
                  required
                >
                  <option value="">— Select branch —</option>
                  {activeBranches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="open-cash">Opening Cash (TZS) *</Label>
              <Input
                id="open-cash" type="number" min="0" step="0.01"
                placeholder="e.g. 50000"
                value={openForm.openingCash}
                onChange={(e) => setOpenForm((f) => ({ ...f, openingCash: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="open-notes">Notes (optional)</Label>
              <Input
                id="open-notes" placeholder="Any notes for this shift…"
                value={openForm.notes}
                onChange={(e) => setOpenForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={openMutation.isPending}>
                {openMutation.isPending ? "Opening…" : "Open Shift"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Close Shift Dialog */}
      <Dialog open={showClose} onOpenChange={setShowClose}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Square className="h-4 w-4 text-destructive" />
              Close Shift
            </DialogTitle>
          </DialogHeader>

          {closeTarget && (
            <Card className="bg-muted/50 border-dashed">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Current Shift</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1 text-sm">
                {[
                  ["Branch", branchMap[closeTarget.branchId] ?? closeTarget.branchId.slice(0, 8)],
                  ["Opened At", fmtDate(closeTarget.openedAt)],
                  ["Opening Cash", `TZS ${fmt(closeTarget.openingCash)}`],
                  ["Sales", `${closeTarget.totalSalesCount ?? 0} sales — TZS ${fmt(closeTarget.totalSalesAmount)}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-medium text-right">{v}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <form onSubmit={handleCloseShift} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="close-cash">Physical Cash Count (TZS) *</Label>
              <Input
                id="close-cash" type="number" min="0" step="0.01"
                placeholder="Count cash in drawer…"
                value={closeForm.closingCash}
                onChange={(e) => setCloseForm((f) => ({ ...f, closingCash: e.target.value }))}
                required
              />
              {closeForm.closingCash && closeTarget && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  Expected: TZS {fmt(closeTarget.openingCash + (closeTarget.totalSalesAmount ?? 0))}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="close-notes">Notes (optional)</Label>
              <Input
                id="close-notes" placeholder="Notes about discrepancies…"
                value={closeForm.notes}
                onChange={(e) => setCloseForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowClose(false)}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={closeMutation.isPending}>
                {closeMutation.isPending ? "Closing…" : "Close Shift"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
