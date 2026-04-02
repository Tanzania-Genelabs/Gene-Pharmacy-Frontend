"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { drugApi, drugCategoryApi } from "@/api/drug.api";
import { toast } from "sonner";
import { Plus, Search, Upload, RefreshCw, Pill, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { CreateDrugRequest } from "@/types";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

export default function DrugsPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const emptyDrug = (): CreateDrugRequest => ({
    name: "", genericName: "", barcode: "", unit: "tablet",
    sellingPrice: 0, buyingPrice: 0, reorderLevel: 10, requiresPrescription: false,
  });
  const [form, setForm] = useState<CreateDrugRequest>(emptyDrug());

  const { data, isLoading } = useQuery({
    queryKey: ["drugs", pharmacyId, page, search],
    queryFn: () => drugApi.list(pharmacyId, { page, size: 20, search: search || undefined }),
    placeholderData: (prev) => prev,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateDrugRequest) => drugApi.create(pharmacyId, data),
    onSuccess: () => {
      toast.success("Drug added successfully");
      qc.invalidateQueries({ queryKey: ["drugs", pharmacyId] });
      setShowAdd(false);
      setForm(emptyDrug());
    },
    onError: () => toast.error("Failed to add drug"),
  });

  const deleteMutation = useMutation({
    mutationFn: (drugId: string) => drugApi.delete(pharmacyId, drugId),
    onSuccess: () => {
      toast.success("Drug deleted successfully");
      qc.invalidateQueries({ queryKey: ["drugs", pharmacyId] });
    },
    onError: () => toast.error("Failed to delete drug"),
  });

  const reactivateMutation = useMutation({
    mutationFn: (drugId: string) => drugApi.reactivate(pharmacyId, drugId),
    onSuccess: () => {
      toast.success("Drug reactivated");
      qc.invalidateQueries({ queryKey: ["drugs", pharmacyId] });
    },
    onError: () => toast.error("Failed to reactivate drug"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.unit.trim()) {
      toast.error("Drug name and unit are required");
      return;
    }
    createMutation.mutate(form);
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const result = await drugApi.importExcel(pharmacyId, file);
      toast.success(`Imported ${result.successCount} drugs. ${result.failureCount} failed.`);
      qc.invalidateQueries({ queryKey: ["drugs", pharmacyId] });
    } catch {
      toast.error("Import failed. Please check your file format.");
    }
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Drug Catalog</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {data?.totalElements ?? 0} drugs registered
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
            <Button variant="outline" size="sm" asChild>
              <span className="cursor-pointer flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Import Excel
              </span>
            </Button>
          </label>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Drug
          </Button>
        </div>
      </div>

      {/* Add Drug Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Drug</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
            <div className="space-y-1">
              <Label htmlFor="d-name">Drug Name *</Label>
              <Input id="d-name" placeholder="e.g. Paracetamol 500mg" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="d-generic">Generic Name</Label>
              <Input id="d-generic" placeholder="e.g. Acetaminophen" value={form.genericName ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, genericName: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="d-unit">Unit *</Label>
                <select
                  id="d-unit"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                >
                  <option value="tablet">Tablet</option>
                  <option value="capsule">Capsule</option>
                  <option value="syrup">Syrup (ml)</option>
                  <option value="injection">Injection (vial)</option>
                  <option value="cream">Cream (g)</option>
                  <option value="piece">Piece</option>
                  <option value="strip">Strip</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-barcode">Barcode</Label>
                <Input id="d-barcode" placeholder="optional" value={form.barcode ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="d-sell">Selling Price (TZS) *</Label>
                <Input id="d-sell" type="number" min={0} step={1} value={form.sellingPrice}
                  onChange={(e) => setForm((f) => ({ ...f, sellingPrice: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-buy">Buying Price (TZS) *</Label>
                <Input id="d-buy" type="number" min={0} step={1} value={form.buyingPrice}
                  onChange={(e) => setForm((f) => ({ ...f, buyingPrice: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-reorder">Reorder Level</Label>
                <Input id="d-reorder" type="number" min={0} step={1} value={form.reorderLevel}
                  onChange={(e) => setForm((f) => ({ ...f, reorderLevel: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="d-prescription"
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={form.requiresPrescription}
                onChange={(e) => setForm((f) => ({ ...f, requiresPrescription: e.target.checked }))}
              />
              <Label htmlFor="d-prescription">Requires Prescription</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Adding…" : "Add Drug"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search drugs…"
          className="pl-9"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(0); }}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Generic Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 w-full bg-muted animate-pulse rounded" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data?.content.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    <Pill className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No drugs found
                  </TableCell>
                </TableRow>
              ) : (
                data?.content.map((drug) => (
                  <TableRow key={drug.id} className="hover:bg-accent/50">
                    <TableCell className="font-medium">{drug.name}</TableCell>
                    <TableCell className="text-muted-foreground">{drug.genericName}</TableCell>
                    <TableCell>{drug.categoryName ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">
                      TZS {drug.sellingPrice.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={drug.active ? "default" : "secondary"}>
                        {drug.active ? "Active" : "Inactive"}
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
                          <DropdownMenuItem>Edit</DropdownMenuItem>
                          {drug.active ? (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteMutation.mutate(drug.id)}
                            >
                              Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => reactivateMutation.mutate(drug.id)}>
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

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page + 1} of {data.totalPages} · {data.totalElements} total
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.first}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.last}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
