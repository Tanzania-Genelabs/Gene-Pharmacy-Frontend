"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pharmacyApi } from "@/api/pharmacy.api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Building2,
  Search,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Loader2,
} from "lucide-react";
import type { PharmacyResponse, PharmacyStatus } from "@/types";

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

export default function AdminPharmaciesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

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
    mutationFn: pharmacyApi.approve,
    onSuccess: () => { toast.success("Pharmacy approved"); invalidate(); },
    onError: () => toast.error("Failed to approve"),
  });
  const rejectMutation = useMutation({
    mutationFn: pharmacyApi.reject,
    onSuccess: () => { toast.success("Pharmacy rejected"); invalidate(); },
    onError: () => toast.error("Failed to reject"),
  });
  const suspendMutation = useMutation({
    mutationFn: pharmacyApi.suspend,
    onSuccess: () => { toast.success("Pharmacy suspended"); invalidate(); },
    onError: () => toast.error("Failed to suspend"),
  });
  const reactivateMutation = useMutation({
    mutationFn: pharmacyApi.reactivate,
    onSuccess: () => { toast.success("Pharmacy reactivated"); invalidate(); },
    onError: () => toast.error("Failed to reactivate"),
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
                      <td className="py-3 font-medium">{p.name}</td>
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
                            {p.status === "PendingApproval" && (
                              <>
                                <DropdownMenuItem onClick={() => approveMutation.mutate(p.id)}>
                                  <CheckCircle className="mr-2 h-4 w-4 text-green-600" /> Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => rejectMutation.mutate(p.id)}>
                                  <XCircle className="mr-2 h-4 w-4 text-red-600" /> Reject
                                </DropdownMenuItem>
                              </>
                            )}
                            {p.status === "Active" && (
                              <DropdownMenuItem onClick={() => suspendMutation.mutate(p.id)}>
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
    </div>
  );
}
