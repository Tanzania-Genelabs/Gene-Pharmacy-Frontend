"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { drugCategoryApi } from "@/api/drug.api";
import { toast } from "sonner";
import { Plus, Tag, MoreHorizontal, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CategoryResponse, CreateCategoryRequest, UpdateCategoryRequest } from "@/types";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

export default function DrugCategoriesPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const qc = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [editCat, setEditCat] = useState<CategoryResponse | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });

  const { data: categories, isLoading } = useQuery({
    queryKey: ["drug-categories", pharmacyId],
    queryFn: () => drugCategoryApi.list(pharmacyId),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCategoryRequest) => drugCategoryApi.create(pharmacyId, data),
    onSuccess: () => {
      toast.success("Category created");
      qc.invalidateQueries({ queryKey: ["drug-categories", pharmacyId] });
      setShowAdd(false);
      setForm({ name: "", description: "" });
    },
    onError: () => toast.error("Failed to create category"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryRequest }) =>
      drugCategoryApi.update(pharmacyId, id, data),
    onSuccess: () => {
      toast.success("Category updated");
      qc.invalidateQueries({ queryKey: ["drug-categories", pharmacyId] });
      setEditCat(null);
    },
    onError: () => toast.error("Failed to update category"),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => drugCategoryApi.delete(pharmacyId, id),
    onSuccess: () => {
      toast.success("Category deactivated");
      qc.invalidateQueries({ queryKey: ["drug-categories", pharmacyId] });
    },
    onError: () => toast.error("Failed to deactivate category"),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => drugCategoryApi.reactivate(pharmacyId, id),
    onSuccess: () => {
      toast.success("Category reactivated");
      qc.invalidateQueries({ queryKey: ["drug-categories", pharmacyId] });
    },
    onError: () => toast.error("Failed to reactivate"),
  });

  function openAdd() {
    setForm({ name: "", description: "" });
    setShowAdd(true);
  }

  function openEdit(cat: CategoryResponse) {
    setEditCat(cat);
    setForm({ name: cat.name, description: cat.description ?? "" });
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    createMutation.mutate({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
    });
  }

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editCat) return;
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    updateMutation.mutate({
      id: editCat.id,
      data: { name: form.name.trim(), description: form.description.trim() || undefined },
    });
  }

  const active = categories?.filter((c) => c.active) ?? [];
  const inactive = categories?.filter((c) => !c.active) ?? [];

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Drug Categories</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {active.length} active · {inactive.length} inactive
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total", value: categories?.length ?? 0, color: "bg-primary/10 text-primary" },
          { label: "Active", value: active.length, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
          { label: "Inactive", value: inactive.length, color: "bg-muted text-muted-foreground" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${s.color}`}>
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label} categories</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Category Grid ───────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : !categories?.length ? (
        <Card>
          <CardContent className="py-20 flex flex-col items-center text-muted-foreground">
            <Tag className="h-12 w-12 mb-3 opacity-25" />
            <p className="font-medium text-base">No categories yet</p>
            <p className="text-sm mt-1">Create categories to organise your drug catalog</p>
            <Button size="sm" className="mt-4" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" /> Add First Category
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {categories.map((cat) => (
            <Card
              key={cat.id}
              className={`group relative overflow-hidden transition-all hover:shadow-md ${
                !cat.active ? "opacity-55" : ""
              }`}
            >
              <CardContent className="p-4 flex flex-col gap-3">
                {/* Icon + Menu */}
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Tag className="h-5 w-5 text-primary" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(cat)}>Edit</DropdownMenuItem>
                      {cat.active ? (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => deactivateMutation.mutate(cat.id)}
                        >
                          Deactivate
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => reactivateMutation.mutate(cat.id)}>
                          Reactivate
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Name + Description */}
                <div className="min-w-0">
                  <p className="font-semibold text-sm leading-tight truncate">{cat.name}</p>
                  {cat.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {cat.description}
                    </p>
                  )}
                </div>

                <Badge
                  variant={cat.active ? "default" : "secondary"}
                  className="w-fit text-xs"
                >
                  {cat.active ? "Active" : "Inactive"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Add Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4 px-6 py-2">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input
                placeholder="e.g. Antibiotics"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input
                placeholder="Optional description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Adding…" : "Add Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={!!editCat} onOpenChange={(o) => !o && setEditCat(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 px-6 py-2">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditCat(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
