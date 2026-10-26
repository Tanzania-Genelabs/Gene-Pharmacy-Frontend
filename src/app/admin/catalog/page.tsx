"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, Library, Loader2, Plus, Search, Upload } from "lucide-react";
import { adminCatalogApi } from "@/api/admin.api";
import { CatalogImportDialog } from "@/components/admin/catalog-import-dialog";
import { CatalogItemDialog } from "@/components/admin/catalog-item-dialog";
import { apiErrorMessage } from "@/lib/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CatalogItem, CatalogKind } from "@/types";

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default function AdminCatalogPage() {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [category, setCategory] = useState("");
  const [review, setReview] = useState(""); // "", "unverified", "verified"
  const [status, setStatus] = useState("active"); // "active", "off", ""
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Wait for a pause in typing before asking the server.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: stats } = useQuery({ queryKey: ["admin", "catalog", "stats"], queryFn: () => adminCatalogApi.stats() });
  const { data: facets } = useQuery({ queryKey: ["admin", "catalog", "facets"], queryFn: () => adminCatalogApi.facets() });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "catalog", "list", search, kind, category, review, status, page],
    queryFn: () =>
      adminCatalogApi.list({
        search: search || undefined,
        kind: (kind || undefined) as CatalogKind | undefined,
        category: category || undefined,
        verified: review === "" ? undefined : review === "verified",
        active: status === "" ? undefined : status === "active",
        page,
        size: 25,
      }),
    placeholderData: (previous) => previous,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "catalog"] });

  const verify = useMutation({
    mutationFn: (item: CatalogItem) => adminCatalogApi.update(item.id, { verified: !item.verified }),
    onSuccess: refresh,
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Could not update")),
  });

  const toggleActive = useMutation({
    mutationFn: (item: CatalogItem) => (item.active ? adminCatalogApi.deactivate(item.id) : adminCatalogApi.reactivate(item.id)),
    onSuccess: (saved) => {
      toast.success(saved.active ? `${saved.name} is back on` : `${saved.name} hidden from pharmacies`);
      refresh();
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Could not update")),
  });

  function openForm(item: CatalogItem | null) {
    setEditing(item);
    setFormOpen(true);
  }

  const items = data?.content ?? [];
  const unverified = (stats?.total ?? 0) - (stats?.verified ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Drug Catalog</h1>
          <p className="text-muted-foreground">
            The shared product list every pharmacy can pick from, so nobody has to type the same drug twice. It holds names,
            strengths and categories, never prices or stock.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import file
          </Button>
          <Button onClick={() => openForm(null)}>
            <Plus className="h-4 w-4 mr-2" />
            Add item
          </Button>
        </div>
      </div>

      <CatalogImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <CatalogItemDialog item={editing} open={formOpen} onOpenChange={setFormOpen} />

      <div className="grid gap-4 md:grid-cols-4">
        <Stat title="Products" value={stats?.total ?? 0} detail={`${stats?.active ?? 0} visible to pharmacies`} />
        <Stat title="Checked by a pharmacist" value={stats?.verified ?? 0} detail={`${unverified} still to review`} />
        <Stat title="With a barcode" value={stats?.withBarcode ?? 0} detail="Barcodes let the till find items" />
        <Stat
          title="By type"
          value={Object.keys(stats?.byKind ?? {}).length}
          detail={Object.entries(stats?.byKind ?? {}).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(" · ") || "—"}
        />
      </div>

      {unverified > 0 && (
        <p className="text-sm rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-yellow-800 dark:text-yellow-300">
          {unverified} item{unverified === 1 ? " has" : "s have"} not been checked by a pharmacist. Pharmacies can use them, but see
          &quot;unverified&quot; next to them. Review names, strengths and prescription status, then tick <strong>Verify</strong>.
        </p>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, generic, maker, barcode…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="pl-8 w-72" />
        </div>
        <select aria-label="Type" value={kind} onChange={(e) => { setKind(e.target.value); setPage(0); }} className={`${selectClass} w-40`}>
          <option value="">All types</option>
          {facets?.kinds.map((k) => (
            <option key={k.name} value={k.name}>{k.name} ({k.count})</option>
          ))}
        </select>
        <select aria-label="Category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(0); }} className={`${selectClass} w-56`}>
          <option value="">All categories</option>
          {facets?.categories.map((c) => (
            <option key={c.name} value={c.name}>{c.name} ({c.count})</option>
          ))}
        </select>
        <select aria-label="Review" value={review} onChange={(e) => { setReview(e.target.value); setPage(0); }} className={`${selectClass} w-44`}>
          <option value="">Checked or not</option>
          <option value="unverified">Not yet checked</option>
          <option value="verified">Checked</option>
        </select>
        <select aria-label="Visibility" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} className={`${selectClass} w-40`}>
          <option value="active">Visible</option>
          <option value="off">Hidden</option>
          <option value="">Visible and hidden</option>
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Library className="h-4 w-4" /> Products</CardTitle>
          <CardDescription>
            {data ? `${data.totalElements.toLocaleString()} matching` : "Loading…"} · Hiding a product removes it from pharmacies&apos; search; pharmacies that already added it keep their copy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              {stats?.total === 0 ? "The catalog is empty. Import a file or add the first item." : "Nothing matches these filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Product</th>
                    <th className="pb-3 font-medium">Type · Category</th>
                    <th className="pb-3 font-medium">Barcode</th>
                    <th className="pb-3 font-medium">Source</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item) => (
                    <tr key={item.id} className={`align-top hover:bg-muted/40 ${item.active ? "" : "opacity-60"}`}>
                      <td className="py-3 pr-3">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[item.genericName, item.manufacturer].filter(Boolean).join(" · ") || "—"}
                          {item.requiresPrescription && <Badge variant="outline" className="ml-2">Rx</Badge>}
                        </p>
                      </td>
                      <td className="py-3 pr-3 text-muted-foreground">{item.kind} · {item.category ?? "—"}</td>
                      <td className="py-3 pr-3 font-mono text-xs">{item.barcode ?? "—"}</td>
                      <td className="py-3 pr-3 text-xs text-muted-foreground max-w-48">{item.source ?? "—"}</td>
                      <td className="py-3 pr-3 whitespace-nowrap">
                        {item.verified ? (
                          <Badge className="gap-1"><BadgeCheck className="h-3 w-3" /> Checked</Badge>
                        ) : (
                          <Badge variant="secondary">Not checked</Badge>
                        )}
                        {!item.active && <Badge variant="outline" className="ml-1">Hidden</Badge>}
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <Button variant="ghost" size="sm" onClick={() => verify.mutate(item)} disabled={verify.isPending}>
                          {item.verified ? "Unverify" : "Verify"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openForm(item)}>Edit</Button>
                        <Button variant="ghost" size="sm" className={item.active ? "text-destructive" : ""} onClick={() => toggleActive.mutate(item)} disabled={toggleActive.isPending}>
                          {item.active ? "Hide" : "Show"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <p className="text-sm text-muted-foreground">Page {data.number + 1} of {data.totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={data.first} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={data.last} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ title, value, detail }: { title: string; value: number; detail: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        <p className="text-xs text-muted-foreground mt-1">{detail}</p>
      </CardContent>
    </Card>
  );
}
