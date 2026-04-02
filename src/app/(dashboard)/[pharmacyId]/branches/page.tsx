"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { branchApi } from "@/api/branch.api";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Building2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { BranchResponse, CreateBranchRequest, UpdateBranchRequest } from "@/types";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

const EMPTY_CREATE: CreateBranchRequest = { name: "", address: "", phone: "", isMain: false };
const EMPTY_UPDATE: UpdateBranchRequest = { name: "", address: "", phone: "", email: "", city: "", region: "" };

export default function BranchesPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const qc = useQueryClient();

  // ── Add dialog state ────────────────────────────────────────────────────────
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<CreateBranchRequest>(EMPTY_CREATE);

  // ── Edit dialog state ───────────────────────────────────────────────────────
  const [editBranch, setEditBranch] = useState<BranchResponse | null>(null);
  const [editForm, setEditForm] = useState<UpdateBranchRequest>(EMPTY_UPDATE);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["branches", pharmacyId],
    queryFn: () => branchApi.list(pharmacyId),
  });

  // ── Mutations ───────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: CreateBranchRequest) => branchApi.create(pharmacyId, data),
    onSuccess: () => {
      toast.success("Branch created successfully");
      qc.invalidateQueries({ queryKey: ["branches", pharmacyId] });
      setShowAdd(false);
      setAddForm(EMPTY_CREATE);
    },
    onError: () => toast.error("Failed to create branch"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBranchRequest }) =>
      branchApi.update(pharmacyId, id, data),
    onSuccess: () => {
      toast.success("Branch updated successfully");
      qc.invalidateQueries({ queryKey: ["branches", pharmacyId] });
      setEditBranch(null);
    },
    onError: () => toast.error("Failed to update branch"),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => branchApi.delete(pharmacyId, id),
    onSuccess: () => {
      toast.success("Branch deactivated");
      qc.invalidateQueries({ queryKey: ["branches", pharmacyId] });
    },
    onError: () => toast.error("Failed to deactivate branch"),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => branchApi.activate(pharmacyId, id),
    onSuccess: () => {
      toast.success("Branch activated");
      qc.invalidateQueries({ queryKey: ["branches", pharmacyId] });
    },
    onError: () => toast.error("Failed to activate branch"),
  });

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.name.trim()) { toast.error("Branch name is required"); return; }
    createMutation.mutate(addForm);
  }

  function openEdit(branch: BranchResponse) {
    setEditBranch(branch);
    setEditForm({
      name: branch.name,
      address: branch.address ?? "",
      phone: branch.phone ?? "",
      email: branch.email ?? "",
      city: branch.city ?? "",
      region: branch.region ?? "",
    });
  }

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editForm.name?.trim()) { toast.error("Branch name is required"); return; }
    updateMutation.mutate({ id: editBranch!.id, data: editForm });
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Branches</h2>
          <p className="text-muted-foreground text-sm mt-1">{data?.length ?? 0} branches</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Branch
        </Button>
      </div>

      {/* ── Add Branch Dialog ────────────────────────────────────────────────── */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Add Branch</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 px-6 py-4">
            <div className="space-y-1">
              <Label htmlFor="add-name">Branch Name *</Label>
              <Input id="add-name" placeholder="e.g. Downtown Branch"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="add-city">City</Label>
                <Input id="add-city" placeholder="Dodoma"
                  value={(addForm as any).city ?? ""}
                  onChange={(e) => setAddForm((f) => ({ ...f, city: e.target.value } as any))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="add-phone">Phone</Label>
                <Input id="add-phone" placeholder="+255 712 345 678"
                  value={addForm.phone ?? ""}
                  onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-address">Address</Label>
              <Input id="add-address" placeholder="Street / area"
                value={addForm.address ?? ""}
                onChange={(e) => setAddForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="add-main" checked={addForm.isMain ?? false}
                onChange={(e) => setAddForm((f) => ({ ...f, isMain: e.target.checked }))}
                className="h-4 w-4" />
              <Label htmlFor="add-main" className="font-normal cursor-pointer">Main branch</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating…" : "Create Branch"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Branch Dialog ───────────────────────────────────────────────── */}
      <Dialog open={!!editBranch} onOpenChange={(open) => { if (!open) setEditBranch(null); }}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Edit Branch — {editBranch?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 px-6 py-4">
            <div className="space-y-1">
              <Label htmlFor="edit-name">Branch Name *</Label>
              <Input id="edit-name" placeholder="Branch name"
                value={editForm.name ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="edit-city">City</Label>
                <Input id="edit-city" placeholder="Dodoma"
                  value={editForm.city ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-region">Region</Label>
                <Input id="edit-region" placeholder="Dodoma Region"
                  value={editForm.region ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, region: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-address">Address</Label>
              <Input id="edit-address" placeholder="Street / area"
                value={editForm.address ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input id="edit-phone" placeholder="+255 712 345 678"
                  value={editForm.phone ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" type="email" placeholder="branch@pharmacy.co.tz"
                  value={editForm.email ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditBranch(null)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>City / Address</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 w-full bg-muted animate-pulse rounded" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !data || data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No branches found
                  </TableCell>
                </TableRow>
              ) : (
                data.map((branch) => (
                  <TableRow key={branch.id} className="hover:bg-accent/50">
                    <TableCell className="font-medium">{branch.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {[branch.city, branch.address].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{branch.phone ?? "—"}</TableCell>
                    <TableCell>
                      {branch.isMain ? (
                        <Badge variant="outline" className="text-xs">Main</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Branch</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={branch.status === "Active" ? "default" : "secondary"}>
                        {branch.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(branch)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {branch.status === "Inactive" ? (
                            <DropdownMenuItem onClick={() => activateMutation.mutate(branch.id)}>
                              Activate
                            </DropdownMenuItem>
                          ) : (
                            !branch.isMain && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => deactivateMutation.mutate(branch.id)}
                                >
                                  Deactivate
                                </DropdownMenuItem>
                              </>
                            )
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
    </div>
  );
}
