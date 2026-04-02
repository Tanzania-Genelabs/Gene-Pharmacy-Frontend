"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminUserApi } from "@/api/admin.api";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Users, Search, Loader2, UserCheck, UserX, ShieldCheck,
  Crown, Briefcase, Store, Plus, Pencil, Trash2, KeyRound, X,
} from "lucide-react";
import type { UserResponse, Role, AdminCreateUserRequest, AdminUpdateUserRequest } from "@/types";

const ROLE_ICON: Record<Role, React.ComponentType<{ className?: string }>> = {
  SuperAdmin: ShieldCheck, Owner: Crown, Manager: Briefcase, Seller: Store,
};
const ROLE_CREATE_OPTIONS: Role[] = ["Owner", "Manager", "Seller", "SuperAdmin"];

// ─── Modal shell ──────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-md border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Create user ──────────────────────────────────────────────────────────────
function CreateUserModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AdminCreateUserRequest>({ email: "", password: "", role: "Owner" });
  const set = (field: keyof AdminCreateUserRequest, value: string) =>
    setForm((p) => ({ ...p, [field]: value || undefined }));

  const mutation = useMutation({
    mutationFn: () => adminUserApi.create(form),
    onSuccess: (user) => {
      toast.success(`User ${user.email} created`);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to create user";
      toast.error(msg);
    },
  });

  return (
    <Modal title="Create New User" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>First name</Label>
            <Input value={form.firstName ?? ""} onChange={(e) => set("firstName", e.target.value)} placeholder="Jane" />
          </div>
          <div className="space-y-1.5">
            <Label>Last name</Label>
            <Input value={form.lastName ?? ""} onChange={(e) => set("lastName", e.target.value)} placeholder="Doe" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Email <span className="text-destructive">*</span></Label>
          <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="user@example.com" />
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="+255 7XX XXX XXX" />
        </div>
        <div className="space-y-1.5">
          <Label>Role <span className="text-destructive">*</span></Label>
          <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as Role }))}
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {ROLE_CREATE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Password <span className="text-destructive">*</span></Label>
          <Input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="Min 8 characters" />
        </div>
        {(form.role === "Owner" || form.role === "Manager" || form.role === "Seller") && (
          <div className="space-y-1.5">
            <Label>Pharmacy ID <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input value={form.pharmacyId ?? ""} onChange={(e) => set("pharmacyId", e.target.value)} placeholder="UUID of the pharmacy" />
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <Button className="flex-1" onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.email || !form.password}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create User
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Edit user ────────────────────────────────────────────────────────────────
function EditUserModal({ user, onClose }: { user: UserResponse; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AdminUpdateUserRequest>({
    firstName: user.firstName ?? "", lastName: user.lastName ?? "",
    phone: user.phone ?? "", role: user.role,
    pharmacyId: user.pharmacyId ?? undefined, enabled: user.enabled,
  });

  const mutation = useMutation({
    mutationFn: () => adminUserApi.update(user.id, form),
    onSuccess: (u) => { toast.success(`${u.email} updated`); queryClient.invalidateQueries({ queryKey: ["admin", "users"] }); onClose(); },
    onError: () => toast.error("Failed to update user"),
  });

  return (
    <Modal title={`Edit: ${user.fullName || user.email}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>First name</Label>
            <Input value={form.firstName ?? ""} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Last name</Label>
            <Input value={form.lastName ?? ""} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input value={form.phone ?? ""} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Role</Label>
          <select value={form.role ?? user.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as Role }))} disabled={user.role === "SuperAdmin"}
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {ROLE_CREATE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Pharmacy ID</Label>
          <Input value={form.pharmacyId ?? ""} onChange={(e) => setForm((p) => ({ ...p, pharmacyId: e.target.value || undefined }))} placeholder="UUID or leave blank" />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="edit-enabled" checked={form.enabled ?? user.enabled} onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))} className="h-4 w-4" />
          <Label htmlFor="edit-enabled">Account enabled</Label>
        </div>
        <div className="flex gap-2 pt-2">
          <Button className="flex-1" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Reset password ───────────────────────────────────────────────────────────
function ResetPasswordModal({ user, onClose }: { user: UserResponse; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const mutation = useMutation({
    mutationFn: () => adminUserApi.resetPassword(user.id, password),
    onSuccess: () => { toast.success(`Password reset for ${user.email}`); onClose(); },
    onError: () => toast.error("Failed to reset password"),
  });
  return (
    <Modal title={`Reset password: ${user.email}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Enter a new password for this user. They will use it on their next login.</p>
        <div className="space-y-1.5">
          <Label>New Password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" />
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => mutation.mutate()} disabled={mutation.isPending || password.length < 8}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Reset Password
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Delete confirm ───────────────────────────────────────────────────────────
function DeleteUserModal({ user, onClose }: { user: UserResponse; onClose: () => void }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => adminUserApi.deleteUser(user.id),
    onSuccess: () => { toast.success(`${user.email} deleted`); queryClient.invalidateQueries({ queryKey: ["admin", "users"] }); onClose(); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to delete user";
      toast.error(msg);
    },
  });
  return (
    <Modal title="Delete User" onClose={onClose}>
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Permanently delete <span className="font-semibold text-foreground">{user.fullName || user.email}</span>? This cannot be undone.
        </p>
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          <strong>Warning:</strong> All user data removed. Associated pharmacy records are preserved.
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" className="flex-1" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete Permanently
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
type ModalState =
  | { type: "create" }
  | { type: "edit"; user: UserResponse }
  | { type: "reset"; user: UserResponse }
  | { type: "delete"; user: UserResponse }
  | null;

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [enabledFilter, setEnabledFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState<ModalState>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", roleFilter, enabledFilter, search, page],
    queryFn: () => adminUserApi.list({
      role: roleFilter === "all" ? undefined : (roleFilter as Role),
      enabled: enabledFilter === "all" ? undefined : enabledFilter === "true",
      search: search || undefined,
      page, size: 20,
    }),
  });

  const { data: stats } = useQuery({
    queryKey: ["admin", "users", "stats"],
    queryFn: () => adminUserApi.stats(),
  });

  const toggleMutation = useMutation({
    mutationFn: adminUserApi.toggleEnabled,
    onSuccess: (user) => { toast.success(`${user.email} ${user.enabled ? "enabled" : "disabled"}`); queryClient.invalidateQueries({ queryKey: ["admin", "users"] }); },
    onError: () => toast.error("Failed to update user status"),
  });

  const users: UserResponse[] = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Users</h1>
          <p className="text-muted-foreground">Create and manage all user accounts across the platform</p>
        </div>
        <Button onClick={() => setModal({ type: "create" })}>
          <Plus className="mr-2 h-4 w-4" /> Create User
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {([
            { label: "Total", value: stats.total, icon: Users },
            { label: "Owners", value: stats.owners, icon: Crown },
            { label: "Managers", value: stats.managers, icon: Briefcase },
            { label: "Sellers", value: stats.sellers, icon: Store },
            { label: "Enabled", value: stats.enabled, icon: UserCheck },
            { label: "Disabled", value: stats.disabled, icon: UserX },
          ] as const).map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-4 pb-4"><div className="text-2xl font-bold">{value}</div></CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by email or name…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
        </div>
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 w-40">
          {["all", "SuperAdmin", "Owner", "Manager", "Seller"].map((v) => <option key={v} value={v}>{v === "all" ? "All Roles" : v}</option>)}
        </select>
        <select value={enabledFilter} onChange={(e) => { setEnabledFilter(e.target.value); setPage(0); }}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 w-40">
          <option value="all">All Statuses</option>
          <option value="true">Enabled</option>
          <option value="false">Disabled</option>
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>User List</CardTitle>
          <CardDescription>{data?.totalElements ?? 0} total users</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No users found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {search ? "Try a different search term." : "Click 'Create User' to add the first user."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium">Pharmacy</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Joined</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((u) => {
                    const RoleIcon = ROLE_ICON[u.role] ?? Users;
                    return (
                      <tr key={u.id} className="hover:bg-muted/50 transition-colors">
                        <td className="py-3 font-medium">{u.fullName || `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "—"}</td>
                        <td className="py-3 text-muted-foreground">{u.email}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <RoleIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{u.role}</span>
                          </div>
                        </td>
                        <td className="py-3 font-mono text-xs text-muted-foreground">{u.pharmacyId ? u.pharmacyId.substring(0, 8) + "…" : "—"}</td>
                        <td className="py-3"><Badge variant={u.enabled ? "default" : "destructive"}>{u.enabled ? "Enabled" : "Disabled"}</Badge></td>
                        <td className="py-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td className="py-3">
                          <div className="flex items-center justify-end gap-1">
                            {u.role !== "SuperAdmin" && (
                              <Button variant="ghost" size="sm" onClick={() => toggleMutation.mutate(u.id)} disabled={toggleMutation.isPending}
                                title={u.enabled ? "Disable" : "Enable"}>
                                {u.enabled ? <UserX className="h-4 w-4 text-orange-500" /> : <UserCheck className="h-4 w-4 text-green-500" />}
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setModal({ type: "edit", user: u })} title="Edit user">
                              <Pencil className="h-4 w-4 text-blue-500" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setModal({ type: "reset", user: u })} title="Reset password">
                              <KeyRound className="h-4 w-4 text-yellow-500" />
                            </Button>
                            {u.role !== "SuperAdmin" && (
                              <Button variant="ghost" size="sm" onClick={() => setModal({ type: "delete", user: u })} title="Delete user">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <p className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {modal?.type === "create" && <CreateUserModal onClose={() => setModal(null)} />}
      {modal?.type === "edit" && <EditUserModal user={modal.user} onClose={() => setModal(null)} />}
      {modal?.type === "reset" && <ResetPasswordModal user={modal.user} onClose={() => setModal(null)} />}
      {modal?.type === "delete" && <DeleteUserModal user={modal.user} onClose={() => setModal(null)} />}
    </div>
  );
}
