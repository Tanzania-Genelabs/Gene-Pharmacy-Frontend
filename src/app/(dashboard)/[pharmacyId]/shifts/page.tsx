"use client";

import { use, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shiftApi } from "@/api/shift.api";
import { branchApi } from "@/api/branch.api";
import { useAuthStore } from "@/store/auth.store";
import { toast } from "sonner";
import { Clock, Play, Square, ChevronLeft, ChevronRight, AlertCircle, MoreHorizontal, FileText, Banknote, RotateCcw, LifeBuoy } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ShiftReportDialog } from "@/components/shifts/shift-report-dialog";
import { RequestHelpDialog, type HelpContext } from "@/components/support/request-help-dialog";
import { apiErrorMessage } from "@/lib/errors";
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
import { BusinessDaySettings } from "@/components/shifts/business-day-settings";
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
function fmtDay(s: string | null | undefined) {
  if (!s) return "—";
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("en-TZ", { weekday: "short", day: "2-digit", month: "short" });
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
  const isOwner = user?.role === "Owner";
  const isSupport = user?.role === "SuperAdmin";
  const canFix = !isSeller;

  // End-of-day report, counting cash afterwards, support reopening a shift, asking Gene Pharmacy for help.
  const [reportShiftId, setReportShiftId] = useState<string | null>(null);
  const [countTarget, setCountTarget] = useState<ShiftResponse | null>(null);
  const [countForm, setCountForm] = useState({ cash: "", reason: "" });
  const [reopenTarget, setReopenTarget] = useState<ShiftResponse | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [help, setHelp] = useState<HelpContext | null>(null);

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
    queryFn: async () => {
      if (isSeller) {
        // A seller sees the open shift of their own branch; the history of past shifts is for managers and owners.
        const open = user?.branchId ? await shiftApi.getActive(pharmacyId, user.branchId).catch(() => null) : null;
        const content = open ? [open] : [];
        return { content, totalElements: content.length, totalPages: 1, size: 20, number: 0, first: true, last: true };
      }
      return shiftApi.list(pharmacyId, { page, size: 20 });
    },
    placeholderData: (prev) => prev,
  });

  const { data: branches } = useQuery({
    queryKey: ["branches", pharmacyId],
    queryFn: () => branchApi.list(pharmacyId),
  });

  // Shops that trade past midnight: say plainly that the day is still open and where its sales are going.
  const pastMidnight = useMemo(
    () => data?.content.filter((s) => s.status === "Open" && s.pastCalendarDay) ?? [],
    [data],
  );

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
      // Opening or closing the day changes what "today" is for the shop.
      qc.invalidateQueries({ queryKey: ["business-day", pharmacyId] });
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
    onSuccess: (closed) => {
      toast.success("Day closed — new sales now start the next day");
      // Straight to the end-of-day report, ready to send to the owner.
      setReportShiftId(closed.id);
      qc.invalidateQueries({ queryKey: ["shifts", pharmacyId] });
      // Opening or closing the day changes what "today" is for the shop.
      qc.invalidateQueries({ queryKey: ["business-day", pharmacyId] });
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

  const countMutation = useMutation({
    mutationFn: () => shiftApi.recordCount(pharmacyId, countTarget!.id, parseFloat(countForm.cash), countForm.reason.trim()),
    onSuccess: () => {
      toast.success("Cash count saved");
      qc.invalidateQueries({ queryKey: ["shifts", pharmacyId] });
      setCountTarget(null);
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not save the count")),
  });
  const reopenMutation = useMutation({
    mutationFn: () => shiftApi.reopen(pharmacyId, reopenTarget!.id, reopenReason.trim()),
    onSuccess: () => {
      toast.success("Shift opened again");
      qc.invalidateQueries({ queryKey: ["shifts", pharmacyId] });
      qc.invalidateQueries({ queryKey: ["business-day", pharmacyId] });
      setReopenTarget(null);
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not open the shift again")),
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

      {pastMidnight.map((shift) => (
        <div
          key={shift.id}
          role="status"
          className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
        >
          <Clock className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">
              {branchMap[shift.branchId] ?? "This branch"} is still trading on {fmtDay(shift.businessDate)}.
            </p>
            <p>
              Sales made after midnight stay on {fmtDay(shift.businessDate)} until you close the day.
              {shift.autoCloseAt ? ` If nobody closes it, the system will at ${fmtDate(shift.autoCloseAt)}.` : ""}
            </p>
          </div>
          <Button size="sm" variant="outline" className="ml-auto shrink-0" onClick={() => openCloseDialog(shift)}>
            Close day
          </Button>
        </div>
      ))}

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
                <TableHead>Business Day</TableHead>
                <TableHead>Opened At</TableHead>
                <TableHead>Closed At</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 12 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 w-full bg-muted animate-pulse rounded" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !data?.content.length ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-14">
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
                        {shift.autoClosed && (
                          <Badge variant="outline" className="ml-1.5" title="Nobody closed this day, so the system did. The cash was not counted.">
                            Auto-closed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{fmtDay(shift.businessDate)}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground text-xs whitespace-nowrap">
                        {fmtDate(shift.openedAt)}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground text-xs whitespace-nowrap">
                        {fmtDate(shift.closedAt)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Shift actions"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {shift.status === "Open" && (
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => openCloseDialog(shift)}>
                                <Square className="h-4 w-4 mr-2" />Close day
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setReportShiftId(shift.id)}>
                              <FileText className="h-4 w-4 mr-2" />Day report
                            </DropdownMenuItem>
                            {canFix && shift.status === "Closed" && shift.closingCash == null && (
                              <DropdownMenuItem onClick={() => { setCountTarget(shift); setCountForm({ cash: "", reason: "" }); }}>
                                <Banknote className="h-4 w-4 mr-2" />Enter counted cash
                              </DropdownMenuItem>
                            )}
                            {isSupport && shift.status === "Closed" && (
                              <DropdownMenuItem onClick={() => { setReopenTarget(shift); setReopenReason(""); }}>
                                <RotateCcw className="h-4 w-4 mr-2" />Open again (support)
                              </DropdownMenuItem>
                            )}
                            {canFix && !isSupport && (
                              <DropdownMenuItem onClick={() => setHelp({ kind: "ShiftCash", shiftId: shift.id, branchId: shift.branchId, businessDate: shift.businessDate ?? undefined, about: `Shift of ${fmtDay(shift.businessDate)}` })}>
                                <LifeBuoy className="h-4 w-4 mr-2" />Ask Gene Pharmacy to fix
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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

      {isOwner && <BusinessDaySettings pharmacyId={pharmacyId} />}

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

      <ShiftReportDialog pharmacyId={pharmacyId} shiftId={reportShiftId} onClose={() => setReportShiftId(null)} />
      <RequestHelpDialog pharmacyId={pharmacyId} context={help} onClose={() => setHelp(null)} />

      {/* Count the cash of a shift that was closed without a count */}
      <Dialog open={!!countTarget} onOpenChange={(o) => !o && setCountTarget(null)}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Enter counted cash</DialogTitle></DialogHeader>
          <div className="space-y-3 px-6 py-2">
            <p className="text-sm text-muted-foreground">
              {branchMap[countTarget?.branchId ?? ""] ?? "This branch"}, {fmtDay(countTarget?.businessDate)}: the day was closed without a cash count.
              Expected in the drawer: <strong>TZS {fmt(countTarget?.expectedCash)}</strong>. Once saved, the count cannot be changed.
            </p>
            <div className="space-y-1">
              <Label>Cash counted (TZS) *</Label>
              <Input type="number" min="0" step="0.01" value={countForm.cash} onChange={(e) => setCountForm((f) => ({ ...f, cash: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Why now? *</Label>
              <Input placeholder="e.g. Counted the next morning" maxLength={500} value={countForm.reason} onChange={(e) => setCountForm((f) => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCountTarget(null)}>Cancel</Button>
            <Button disabled={countForm.cash === "" || Number(countForm.cash) < 0 || countForm.reason.trim().length < 5 || countMutation.isPending} onClick={() => countMutation.mutate()}>
              {countMutation.isPending ? "Saving…" : "Save count"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gene Pharmacy support: open a shift closed by mistake again */}
      <Dialog open={!!reopenTarget} onOpenChange={(o) => !o && setReopenTarget(null)}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Open this shift again</DialogTitle></DialogHeader>
          <div className="space-y-3 px-6 py-2">
            <p className="text-sm text-muted-foreground">
              The day of {fmtDay(reopenTarget?.businessDate)} carries on: new sales count on it until it is closed again, and its cash count is cleared.
              Only the latest shift of a branch, closed in the last 48 hours, can be opened again.
            </p>
            <div className="space-y-1">
              <Label>Reason * (at least 10 characters)</Label>
              <Input placeholder="e.g. Closed by mistake at noon, shop still open" maxLength={500} value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenTarget(null)}>Cancel</Button>
            <Button disabled={reopenReason.trim().length < 10 || reopenMutation.isPending} onClick={() => reopenMutation.mutate()}>
              {reopenMutation.isPending ? "Opening…" : "Open again"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Shift Dialog */}
      <Dialog open={showClose} onOpenChange={setShowClose}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Square className="h-4 w-4 text-destructive" />
              Close Day
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
                  ["Business Day", fmtDay(closeTarget.businessDate)],
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
                {closeMutation.isPending ? "Closing…" : "Close Day"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
