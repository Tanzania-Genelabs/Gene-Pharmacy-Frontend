"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { pharmacyApi } from "@/api/pharmacy.api";
import { branchApi } from "@/api/branch.api";
import { userApi } from "@/api/user.api";
import { adminUserApi } from "@/api/admin.api";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import type { UserResponse } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  Building2,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  Gift,
  Heart,
  Loader2,
  Package,
  Pill,
  ScanBarcode,
  Shield,
  ShoppingCart,
  Tag,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

/** Every module of a pharmacy. The admin opens them in the pharmacy's own workspace, with full rights. */
const MODULES = [
  { label: "Dashboard", path: "", icon: BarChart3 },
  { label: "Quick POS", path: "pos", icon: ScanBarcode },
  { label: "Sales", path: "sales", icon: ShoppingCart },
  { label: "Drugs", path: "drugs", icon: Pill },
  { label: "Drug Categories", path: "drug-categories", icon: Tag },
  { label: "Inventory", path: "inventory", icon: Package },
  { label: "Expiry & Stock", path: "expiry", icon: AlertTriangle },
  { label: "Shifts", path: "shifts", icon: Clock },
  { label: "Customers", path: "customers", icon: Heart },
  { label: "Loyalty", path: "loyalty", icon: Gift },
  { label: "Suppliers", path: "suppliers", icon: Truck },
  { label: "Purchase Orders", path: "purchase-orders", icon: FileText },
  { label: "Expenses", path: "expenses", icon: Wallet },
  { label: "Analytics", path: "analytics", icon: TrendingUp },
  { label: "Reports", path: "reports", icon: BarChart3 },
  { label: "Notifications", path: "notifications", icon: Bell },
  { label: "Branches", path: "branches", icon: Building2 },
  { label: "Users", path: "users", icon: Users },
  { label: "Billing", path: "billing", icon: CreditCard },
  { label: "Audit Logs", path: "audit-logs", icon: Shield },
];

export default function AdminPharmacyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [resetFor, setResetFor] = useState<UserResponse | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "pharmacy", id] });
  const errorOf = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Something went wrong";

  const [disableFor, setDisableFor] = useState<UserResponse | null>(null);
  const [resetReason, setResetReason] = useState("");
  const toggleUser = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) => adminUserApi.toggleEnabled(userId, reason),
    onSuccess: (u) => { toast.success(`${u.email} ${u.enabled ? "enabled" : "disabled"}`); setDisableFor(null); void refresh(); },
    onError: (e) => toast.error(errorOf(e)),
  });
  const resetPassword = useMutation({
    mutationFn: () => adminUserApi.resetPassword(resetFor!.id, newPassword, resetReason.trim()),
    onSuccess: () => { toast.success(`Password reset for ${resetFor?.email}`); setResetFor(null); setNewPassword(""); setResetReason(""); },
    onError: (e) => toast.error(errorOf(e)),
  });
  const toggleBranch = useMutation({
    mutationFn: ({ branchId, active }: { branchId: string; active: boolean }) =>
      active ? branchApi.delete(id, branchId) : branchApi.activate(id, branchId),
    onSuccess: () => { toast.success("Branch updated"); void refresh(); },
    onError: (e) => toast.error(errorOf(e)),
  });

  const pharmacy = useQuery({ queryKey: ["admin", "pharmacy", id], queryFn: () => pharmacyApi.getById(id) });
  const limits = useQuery({ queryKey: ["admin", "pharmacy", id, "limits"], queryFn: () => pharmacyApi.getLimits(id) });
  const branches = useQuery({ queryKey: ["admin", "pharmacy", id, "branches"], queryFn: () => branchApi.list(id) });
  const staff = useQuery({ queryKey: ["admin", "pharmacy", id, "staff"], queryFn: () => userApi.list(id, { page: 0, size: 100 }) });

  if (pharmacy.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!pharmacy.data) {
    return <p className="py-24 text-center text-muted-foreground">Pharmacy not found.</p>;
  }

  const p = pharmacy.data;
  const branchName = (branchId: string | null) => branches.data?.find((b) => b.id === branchId)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/pharmacies" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> All pharmacies
          </Link>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            {p.name} <Badge variant={p.status === "Active" ? "default" : "secondary"}>{p.status}</Badge>
          </h1>
          <p className="text-muted-foreground">
            {p.address}, {p.city} · {p.phone} · {p.email} · Reg. {p.registrationNumber}
          </p>
        </div>
        <Button asChild>
          <Link href={`/${p.id}`}>
            <ExternalLink className="h-4 w-4" /> Open workspace
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Staff accounts" value={limits.data ? `${limits.data.usage.users} / ${limits.data.effective.maxUsers ?? "∞"}` : "…"} />
        <Stat label="Branches" value={limits.data ? `${limits.data.usage.branches} / ${limits.data.effective.maxBranches ?? "∞"}` : "…"} />
        <Stat label="Plan" value={limits.data?.planType ?? "None"} />
        <Stat label="Registered" value={new Date(p.createdAt).toLocaleDateString()} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manage modules</CardTitle>
          <CardDescription>You have full rights in every module of this pharmacy. Each opens in the pharmacy&apos;s workspace.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m) => (
            <Link
              key={m.label}
              href={`/${p.id}${m.path ? `/${m.path}` : ""}`}
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:border-primary hover:bg-muted/50"
            >
              <m.icon className="h-4 w-4 text-muted-foreground" />
              {m.label}
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branches</CardTitle>
          <CardDescription>{branches.data?.length ?? 0} branches</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">City</th>
                  <th className="pb-3 font-medium">Phone</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(branches.data ?? []).map((b) => (
                  <tr key={b.id}>
                    <td className="py-2.5 font-medium">
                      {b.name} {b.isMain && <Badge variant="outline" className="ml-1">Main</Badge>}
                    </td>
                    <td className="py-2.5">{b.city ?? "—"}</td>
                    <td className="py-2.5">{b.phone ?? "—"}</td>
                    <td className="py-2.5"><Badge variant={b.status === "Active" ? "default" : "outline"}>{b.status}</Badge></td>
                    <td className="py-2.5 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={toggleBranch.isPending}
                        onClick={() => toggleBranch.mutate({ branchId: b.id, active: b.status === "Active" })}
                      >
                        {b.status === "Active" ? "Deactivate" : "Activate"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>People in this pharmacy</CardTitle>
          <CardDescription>{staff.data?.totalElements ?? 0} accounts · add or edit staff in the Users module</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Email</th>
                  <th className="pb-3 font-medium">Role</th>
                  <th className="pb-3 font-medium">Branch</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(staff.data?.content ?? []).map((u) => (
                  <tr key={u.id}>
                    <td className="py-2.5 font-medium">{u.fullName}</td>
                    <td className="py-2.5">{u.email}</td>
                    <td className="py-2.5"><Badge variant="secondary">{u.role}</Badge></td>
                    <td className="py-2.5">{branchName(u.branchId)}</td>
                    <td className="py-2.5"><Badge variant={u.enabled ? "default" : "outline"}>{u.enabled ? "Active" : "Disabled"}</Badge></td>
                    <td className="py-2.5 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setResetFor(u); setNewPassword(""); }}>
                          Reset password
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={toggleUser.isPending}
                          onClick={() => (u.enabled ? setDisableFor(u) : toggleUser.mutate({ userId: u.id }))}
                        >
                          {u.enabled ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!resetFor} onOpenChange={(o) => !o && setResetFor(null)}>
        <DialogContent className="max-w-sm p-6" aria-describedby="reset-desc">
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription id="reset-desc" className="mt-1">
            New password for {resetFor?.email}. All their sessions are signed out.
          </DialogDescription>
          <Input type="password" className="mt-4" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 8 characters" />
          <Input className="mt-2" value={resetReason} onChange={(e) => setResetReason(e.target.value)} placeholder="Reason (min 5 characters)" maxLength={500} />
          <div className="mt-4 flex gap-2">
            <Button className="flex-1" disabled={resetPassword.isPending || newPassword.length < 8 || resetReason.trim().length < 5} onClick={() => resetPassword.mutate()}>
              {resetPassword.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Reset password
            </Button>
            <Button variant="outline" onClick={() => setResetFor(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ReasonDialog
        open={!!disableFor}
        title={`Disable ${disableFor?.email ?? "this account"}`}
        description="They are signed out and cannot sign in until you enable the account again."
        confirmLabel="Disable account"
        destructive
        pending={toggleUser.isPending}
        onConfirm={(reason) => disableFor && toggleUser.mutate({ userId: disableFor.id, reason })}
        onClose={() => setDisableFor(null)}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
