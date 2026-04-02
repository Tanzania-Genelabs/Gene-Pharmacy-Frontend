"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customerApi } from "@/api/customer.api";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Users,
  Phone,
  Heart,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { CreateCustomerRequest, CustomerFavoriteResponse, RefillHistoryResponse } from "@/types";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

export default function CustomersPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"favorites" | "refills">("favorites");

  const emptyForm = (): CreateCustomerRequest => ({
    name: "",
    phone: "",
    email: "",
    smsOptIn: true,
    whatsappOptIn: false,
    notes: "",
  });
  const [form, setForm] = useState<CreateCustomerRequest>(emptyForm());

  const { data, isLoading } = useQuery({
    queryKey: ["customers", pharmacyId, page, search],
    queryFn: () => customerApi.list(pharmacyId, { page, size: 20, search: search || undefined }),
    placeholderData: (prev) => prev,
  });

  const { data: favorites } = useQuery({
    queryKey: ["customers", "favorites", pharmacyId, selectedCustomerId],
    queryFn: () => customerApi.favorites(pharmacyId, selectedCustomerId!),
    enabled: !!selectedCustomerId && detailTab === "favorites",
  });

  const { data: refills } = useQuery({
    queryKey: ["customers", "refills", pharmacyId, selectedCustomerId],
    queryFn: () => customerApi.refills(pharmacyId, selectedCustomerId!),
    enabled: !!selectedCustomerId && detailTab === "refills",
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCustomerRequest) => customerApi.create(pharmacyId, data),
    onSuccess: () => {
      toast.success("Customer added");
      qc.invalidateQueries({ queryKey: ["customers", pharmacyId] });
      setShowAdd(false);
      setForm(emptyForm());
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to add customer");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Customer name is required");
      return;
    }
    createMutation.mutate(form);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Customers</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {data?.totalElements ?? 0} registered customers
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Add Customer Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
            <div className="space-y-1">
              <Label htmlFor="c-name">Full Name *</Label>
              <Input id="c-name" placeholder="e.g. Maria Joseph"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="c-phone">Phone</Label>
                <Input id="c-phone" placeholder="+255 7XX XXX XXX"
                  value={form.phone ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="c-email">Email</Label>
                <Input id="c-email" type="email" placeholder="optional"
                  value={form.email ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.smsOptIn}
                  onChange={(e) => setForm((f) => ({ ...f, smsOptIn: e.target.checked }))} />
                SMS Reminders
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.whatsappOptIn}
                  onChange={(e) => setForm((f) => ({ ...f, whatsappOptIn: e.target.checked }))} />
                WhatsApp
              </label>
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-notes">Notes</Label>
              <Input id="c-notes" placeholder="Allergies, preferences…"
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Saving…" : "Save Customer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Customer Details Dialog */}
      <Dialog open={!!selectedCustomerId} onOpenChange={() => setSelectedCustomerId(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Customer Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <div className="flex gap-2">
              <Button size="sm" variant={detailTab === "favorites" ? "default" : "outline"}
                onClick={() => setDetailTab("favorites")}>
                <Heart className="h-4 w-4 mr-1" /> Favorites
              </Button>
              <Button size="sm" variant={detailTab === "refills" ? "default" : "outline"}
                onClick={() => setDetailTab("refills")}>
                <RefreshCw className="h-4 w-4 mr-1" /> Refill History
              </Button>
            </div>

            {detailTab === "favorites" && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drug</TableHead>
                    <TableHead className="text-right">Purchases</TableHead>
                    <TableHead className="text-right">Usual Qty</TableHead>
                    <TableHead>Last Purchased</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {favorites && favorites.length > 0 ? favorites.map((f) => (
                    <TableRow key={f.drugId}>
                      <TableCell className="font-medium">{f.drugName}</TableCell>
                      <TableCell className="text-right">{f.purchaseCount}</TableCell>
                      <TableCell className="text-right">{f.usualQuantity}</TableCell>
                      <TableCell>{new Date(f.lastPurchasedAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-6">No favorites yet</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}

            {detailTab === "refills" && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drug</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Purchased</TableHead>
                    <TableHead>Next Refill</TableHead>
                    <TableHead>Reminder</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refills && refills.length > 0 ? refills.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.drugName}</TableCell>
                      <TableCell className="text-right">{r.quantity}</TableCell>
                      <TableCell>{new Date(r.purchasedAt).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(r.nextRefillDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={r.reminderSent ? "secondary" : "outline"}>
                          {r.reminderSent ? "Sent" : "Pending"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6">No refill history</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name or phone…"
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
      </div>

      {/* Customer Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Channels</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.content?.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedCustomerId(c.id)}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {c.smsOptIn && <Badge variant="secondary" className="text-xs">SMS</Badge>}
                      {c.whatsappOptIn && <Badge variant="secondary" className="text-xs">WA</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedCustomerId(c.id); }}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && (!data?.content || data.content.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No customers registered yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {data.number + 1} of {data.totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={data.first} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={data.last} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
