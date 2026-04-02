"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userApi } from "@/api/user.api";
import { branchApi } from "@/api/branch.api";
import { toast } from "sonner";
import { Plus, Search, MoreHorizontal, Users, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type {
  CreateStaffRequest,
  UpdateStaffRequest,
  UserResponse,
} from "@/types";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

const SELECT_CLS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

const EMPTY_CREATE: CreateStaffRequest = {
  email: "",
  password: "",
  role: "Seller",
  firstName: "",
  lastName: "",
  phone: "",
  branchId: "",
};

export default function UsersPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // ── Add dialog ──────────────────────────────────────────────────────────────
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<CreateStaffRequest>(EMPTY_CREATE);

  // ── Edit dialog ─────────────────────────────────────────────────────────────
  const [editUser, setEditUser] = useState<UserResponse | null>(null);
  const [editForm, setEditForm] = useState<UpdateStaffRequest>({
    firstName: "",
    lastName: "",
    phone: "",
    branchId: "",
  });

  // ── Reset password dialog ───────────────────────────────────────────────────
  const [resetUser, setResetUser] = useState<UserResponse | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["users", pharmacyId, page, search],
    queryFn: () => userApi.list(pharmacyId, { page, size: 20 }),
    placeholderData: (prev) => prev,
  });

  const { data: branches } = useQuery({
    queryKey: ["branches", pharmacyId],
    queryFn: () => branchApi.list(pharmacyId),
    enabled: showAdd || !!editUser,
  });

  // ── Branch lookup map for display ───────────────────────────────────────────
  const { data: allBranches } = useQuery({
    queryKey: ["branches", pharmacyId],
    queryFn: () => branchApi.list(pharmacyId),
  });
  const branchMap = Object.fromEntries(
    (allBranches ?? []).map((b) => [b.id, b.name])
  );

  // ── Mutations ───────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: CreateStaffRequest) => userApi.create(pharmacyId, data),
    onSuccess: () => {
      toast.success("User created successfully");
      qc.invalidateQueries({ queryKey: ["users", pharmacyId] });
      setShowAdd(false);
      setAddForm(EMPTY_CREATE);
    },
    onError: () => toast.error("Failed to create user"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStaffRequest }) =>
      userApi.update(pharmacyId, id, data),
    onSuccess: () => {
      toast.success("User updated successfully");
      qc.invalidateQueries({ queryKey: ["users", pharmacyId] });
      setEditUser(null);
    },
    onError: () => toast.error("Failed to update user"),
  });

  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => userApi.delete(pharmacyId, userId),
    onSuccess: () => {
      toast.success("User deactivated");
      qc.invalidateQueries({ queryKey: ["users", pharmacyId] });
    },
    onError: () => toast.error("Failed to deactivate user"),
  });

  const reactivateMutation = useMutation({
    mutationFn: (userId: string) => userApi.reactivate(pharmacyId, userId),
    onSuccess: () => {
      toast.success("User reactivated");
      qc.invalidateQueries({ queryKey: ["users", pharmacyId] });
    },
    onError: () => toast.error("Failed to reactivate user"),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      userApi.resetPassword(pharmacyId, id, { newPassword: password }),
    onSuccess: () => {
      toast.success("Password reset successfully");
      setResetUser(null);
      setNewPassword("");
    },
    onError: () => toast.error("Failed to reset password"),
  });

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.email.trim() || !addForm.password.trim()) {
      toast.error("Email and password are required");
      return;
    }
    createMutation.mutate(addForm);
  }

  function openEdit(user: UserResponse) {
    setEditUser(user);
    setEditForm({
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      phone: user.phone ?? "",
      branchId: user.branchId ?? "",
    });
  }

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    updateMutation.mutate({
      id: editUser.id,
      data: {
        ...editForm,
        branchId: editForm.branchId || undefined,
      },
    });
  }

  function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (!resetUser) return;
    resetPasswordMutation.mutate({ id: resetUser.id, password: newPassword });
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Users</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {data?.totalElements ?? 0} staff members
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* ── Add User Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 px-6 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="a-first">First Name</Label>
                <Input id="a-first" placeholder="John" value={addForm.firstName ?? ""}
                  onChange={(e) => setAddForm((f) => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="a-last">Last Name</Label>
                <Input id="a-last" placeholder="Doe" value={addForm.lastName ?? ""}
                  onChange={(e) => setAddForm((f) => ({ ...f, lastName: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="a-email">Email *</Label>
              <Input id="a-email" type="email" placeholder="john@pharmacy.co.tz" value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="a-phone">Phone</Label>
                <Input id="a-phone" placeholder="+255 712 345 678" value={addForm.phone ?? ""}
                  onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="a-role">Role *</Label>
                <select id="a-role" className={SELECT_CLS} value={addForm.role}
                  onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value as "Manager" | "Seller" }))}>
                  <option value="Seller">Seller</option>
                  <option value="Manager">Manager</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="a-branch">Assign to Branch</Label>
              <select id="a-branch" className={SELECT_CLS} value={addForm.branchId ?? ""}
                onChange={(e) => setAddForm((f) => ({ ...f, branchId: e.target.value }))}>
                <option value="">— No specific branch —</option>
                {(branches ?? []).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="a-pass">Password *</Label>
              <Input id="a-pass" type="password" placeholder="Min 8 characters" value={addForm.password}
                onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating…" : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit User Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Edit — {editUser?.fullName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 px-6 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="e-first">First Name</Label>
                <Input id="e-first" placeholder="First name" value={editForm.firstName ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="e-last">Last Name</Label>
                <Input id="e-last" placeholder="Last name" value={editForm.lastName ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="e-phone">Phone</Label>
              <Input id="e-phone" placeholder="+255 712 345 678" value={editForm.phone ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="e-branch">
                Assign to Branch{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  (role stays {editUser?.role})
                </span>
              </Label>
              <select id="e-branch" className={SELECT_CLS} value={editForm.branchId ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, branchId: e.target.value }))}>
                <option value="">— No specific branch —</option>
                {(branches ?? allBranches ?? []).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Reset Password Dialog ────────────────────────────────────────────── */}
      <Dialog open={!!resetUser} onOpenChange={(open) => { if (!open) { setResetUser(null); setNewPassword(""); } }}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Reset Password — {resetUser?.fullName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4 px-6 py-4">
            <div className="space-y-1">
              <Label htmlFor="r-pass">New Password *</Label>
              <Input id="r-pass" type="password" placeholder="Min 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setResetUser(null); setNewPassword(""); }}>Cancel</Button>
              <Button type="submit" disabled={resetPasswordMutation.isPending}>
                {resetPasswordMutation.isPending ? "Resetting…" : "Reset Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Search ──────────────────────────────────────────────────────────── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users…"
          className="pl-9"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 w-full bg-muted animate-pulse rounded" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data?.content.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                data?.content.map((user) => (
                  <TableRow key={user.id} className="hover:bg-accent/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(user.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{user.fullName}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.role}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {user.branchId ? (branchMap[user.branchId] ?? "Assigned") : "All"}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{user.phone ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={user.enabled ? "default" : "secondary"}>
                        {user.enabled ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground text-xs">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                            {user.role}
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openEdit(user)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setResetUser(user); setNewPassword(""); }}>
                            Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {user.enabled ? (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deactivateMutation.mutate(user.id)}
                            >
                              Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => reactivateMutation.mutate(user.id)}>
                              Reactivate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {data && data.totalPages > 1 && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" disabled={data.first} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={data.last} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
