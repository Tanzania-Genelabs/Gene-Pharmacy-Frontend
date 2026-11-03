"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pharmacyApi } from "@/api/pharmacy.api";
import { adminBulkApi } from "@/api/admin.api";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { apiErrorMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { toast } from "sonner";
import { PharmacyLimitsDialog } from "@/components/admin/pharmacy-limits-dialog";
import {
  Building2,
  Search,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  SlidersHorizontal,
  ExternalLink,
  Eye,
  Loader2,
} from "lucide-react";
import type { BulkResult, PharmacyResponse, PharmacyStatus } from "@/types";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  Active: "default",
  PendingApproval: "secondary",
  Suspended: "destructive",
  Deactivated: "outline",
  Rejected: "destructive",
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "Active", label: "Active" },
  { value: "PendingApproval", label: "Pending Approval" },
  { value: "Suspended", label: "Suspended" },
  { value: "Deactivated", label: "Deactivated" },
  { value: "Rejected", label: "Rejected" },
];

type Pending =
  | { kind: "single"; action: "reject" | "suspend"; pharmacy: PharmacyResponse }
  | { kind: "bulk"; action: "approve" | "reject" | "suspend" | "reactivate" }
  | null;

const BULK_LABEL = { approve: "Approve", reject: "Reject", suspend: "Suspend", reactivate: "Reactivate" } as const;

export default function AdminPharmaciesPage() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <PharmaciesView />
    </Suspense>
  );
}

function PharmaciesView() {
  const queryClient = useQueryClient();
  const initialStatus = useSearchParams().get("status");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus && STATUS_OPTIONS.some((o) => o.value === initialStatus) ? initialStatus : "all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending>(null);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [page, setPage] = useState(0);
  const [limitsFor, setLimitsFor] = useState<PharmacyResponse | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "pharmacies", statusFilter, page],
    queryFn: () =>
      pharmacyApi.list({
        status: statusFilter === "all" ? undefined : (statusFilter as PharmacyStatus),
        page,
        size: 20,
      }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "pharmacies"] });

  const approveMutation = useMutation({
    mutationFn: (id: string) => pharmacyApi.approve(id),
    onSuccess: () => { toast.success("Pharmacy approved"); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e, "Failed to approve")),
  });
  const reactivateMutation = useMutation({
    mutationFn: (id: string) => pharmacyApi.reactivate(id),
    onSuccess: () => { toast.success("Pharmacy reactivated"); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e, "Failed to reactivate")),
  });
  const reasonedMutation = useMutation({
    mutationFn: async ({ action, id, reason }: { action: "reject" | "suspend"; id: string; reason: string }) =>
      action === "reject" ? pharmacyApi.reject(id, reason) : pharmacyApi.suspend(id, reason),
    onSuccess: (_d, v) => { toast.success(v.action === "reject" ? "Pharmacy rejected" : "Pharmacy suspended"); setPending(null); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not complete that")),
  });
  const bulkMutation = useMutation({
    mutationFn: ({ action, reason }: { action: "approve" | "reject" | "suspend" | "reactivate"; reason?: string }) =>
      adminBulkApi.pharmacies(action, [...selected], reason),
    onSuccess: (result) => {
      setPending(null);
      setSelected(new Set());
      setBulkResult(result);
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e, "The bulk action failed")),
  });

  const pharmacies: PharmacyResponse[] = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;

  const filtered = search
    ? pharmacies.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.city.toLowerCase().includes(search.toLowerCase()) ||
          p.email.toLowerCase().includes(search.toLowerCase())
      )
    : pharmacies;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pharmacies</h1>
        <p className="text-muted-foreground">Manage all registered pharmacies on the platform</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search pharmacies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 w-48"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-4 py-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          {(["approve", "reject", "suspend", "reactivate"] as const).map((a) => (
            <Button key={a} size="sm" variant={a === "reject" || a === "suspend" ? "outline" : "default"} onClick={() => setPending({ kind: "bulk", action: a })}>
              {BULK_LABEL[a]}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          <span className="text-xs text-muted-foreground">Pharmacies the action does not fit are skipped, never changed.</span>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pharmacy List</CardTitle>
          <CardDescription>{data?.totalElements ?? 0} total pharmacies</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No pharmacies found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {search ? "Try a different search term." : "Pharmacies will appear once owners register."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 w-8">
                      <input
                        type="checkbox"
                        aria-label="Select all on this page"
                        checked={filtered.length > 0 && filtered.every((p) => selected.has(p.id))}
                        onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map((p) => p.id)) : new Set())}
                      />
                    </th>
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Registration #</th>
                    <th className="pb-3 font-medium">City</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Phone</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Created</th>
                    <th className="pb-3 font-medium sr-only">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/50 transition-colors">
                      <td className="py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${p.name}`}
                          checked={selected.has(p.id)}
                          onChange={(e) => setSelected((prev) => { const next = new Set(prev); if (e.target.checked) next.add(p.id); else next.delete(p.id); return next; })}
                        />
                      </td>
                      <td className="py-3 font-medium"><Link href={`/admin/pharmacies/${p.id}`} className="hover:underline">{p.name}</Link></td>
                      <td className="py-3 font-mono text-xs">{p.registrationNumber}</td>
                      <td className="py-3">{p.city}</td>
                      <td className="py-3">{p.email}</td>
                      <td className="py-3">{p.phone}</td>
                      <td className="py-3">
                        <Badge variant={STATUS_VARIANT[p.status] ?? "outline"}>{p.status}</Badge>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/${p.id}`}><ExternalLink className="mr-2 h-4 w-4" /> Open workspace</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/pharmacies/${p.id}`}><Eye className="mr-2 h-4 w-4" /> Details & people</Link>
                            </DropdownMenuItem>
                            {p.status === "PendingApproval" && (
                              <>
                                <DropdownMenuItem onClick={() => approveMutation.mutate(p.id)}>
                                  <CheckCircle className="mr-2 h-4 w-4 text-green-600" /> Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setPending({ kind: "single", action: "reject", pharmacy: p })}>
                                  <XCircle className="mr-2 h-4 w-4 text-red-600" /> Reject
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem onClick={() => setLimitsFor(p)}>
                              <SlidersHorizontal className="mr-2 h-4 w-4" /> Plan limits…
                            </DropdownMenuItem>
                            {p.status === "Active" && (
                              <DropdownMenuItem onClick={() => setPending({ kind: "single", action: "suspend", pharmacy: p })}>
                                <Pause className="mr-2 h-4 w-4 text-orange-500" /> Suspend
                              </DropdownMenuItem>
                            )}
                            {(p.status === "Suspended" || p.status === "Deactivated") && (
                              <DropdownMenuItem onClick={() => reactivateMutation.mutate(p.id)}>
                                <Play className="mr-2 h-4 w-4 text-green-600" /> Reactivate
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <p className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ReasonDialog
        open={pending !== null}
        title={
          pending?.kind === "single"
            ? `${pending.action === "reject" ? "Reject" : "Suspend"} ${pending.pharmacy.name}`
            : pending ? `${BULK_LABEL[pending.action]} ${selected.size} pharmacies` : ""
        }
        description={
          pending?.action === "approve" || pending?.action === "reactivate"
            ? "Optional note for the audit log."
            : "The owner is told this was done. Say why - it is saved in the audit log with your name."
        }
        confirmLabel={pending ? (pending.kind === "single" ? (pending.action === "reject" ? "Reject" : "Suspend") : BULK_LABEL[pending.action]) : "Confirm"}
        destructive={pending?.action === "reject" || pending?.action === "suspend"}
        required={pending?.action === "reject" || pending?.action === "suspend"}
        pending={reasonedMutation.isPending || bulkMutation.isPending}
        onConfirm={(reason) => {
          if (!pending) return;
          if (pending.kind === "single") reasonedMutation.mutate({ action: pending.action, id: pending.pharmacy.id, reason });
          else bulkMutation.mutate({ action: pending.action, reason: reason || undefined });
        }}
        onClose={() => setPending(null)}
      />

      <Dialog open={!!bulkResult} onOpenChange={(o) => !o && setBulkResult(null)}>
        <DialogContent className="max-w-md p-6" aria-describedby="bulk-desc">
          <DialogTitle>{bulkResult ? `${BULK_LABEL[bulkResult.action.split(".").pop() as keyof typeof BULK_LABEL] ?? "Bulk action"}: ${bulkResult.done} done, ${bulkResult.skipped} skipped` : ""}</DialogTitle>
          <DialogDescription id="bulk-desc" className="mt-1">Recorded in the audit log.</DialogDescription>
          <ul className="mt-3 max-h-64 divide-y overflow-y-auto text-sm">
            {bulkResult?.results.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-1.5">
                <span className="font-medium">{r.name ?? r.id}</span>
                <span className={r.ok ? "text-green-600" : "text-muted-foreground"}>{r.message}</span>
              </li>
            ))}
          </ul>
          <Button className="mt-4 w-full" onClick={() => setBulkResult(null)}>Close</Button>
        </DialogContent>
      </Dialog>

      <PharmacyLimitsDialog
        pharmacyId={limitsFor?.id ?? null}
        pharmacyName={limitsFor?.name}
        onOpenChange={(open) => { if (!open) setLimitsFor(null); }}
      />
    </div>
  );
}
