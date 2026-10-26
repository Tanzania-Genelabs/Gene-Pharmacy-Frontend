"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminAuditLogApi } from "@/api/admin.api";
import { pharmacyApi } from "@/api/pharmacy.api";
import { actionLabel, actionVariant } from "@/lib/audit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Shield } from "lucide-react";

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default function AdminAuditLogsPage() {
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [pharmacyId, setPharmacyId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // Wait for a pause in typing before asking the server.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Only offer filter values that really exist in the log.
  const { data: facets } = useQuery({
    queryKey: ["admin", "audit-logs", "facets"],
    queryFn: () => adminAuditLogApi.facets(),
  });

  const { data: pharmacies } = useQuery({
    queryKey: ["admin", "pharmacies", "for-audit-filter"],
    queryFn: () => pharmacyApi.list({ size: 200 }),
  });

  const rangeInvalid = !!from && !!to && to < from;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "audit-logs", action, entityType, pharmacyId, from, to, search, page],
    queryFn: () =>
      adminAuditLogApi.list({
        action: action || undefined,
        entityType: entityType || undefined,
        pharmacyId: pharmacyId || undefined,
        from: from || undefined,
        to: to || undefined,
        search: search || undefined,
        page,
        size: 25,
      }),
    enabled: !rangeInvalid,
    placeholderData: (previous) => previous,
  });

  const logs = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;
  const filtered = !!(action || entityType || pharmacyId || from || to || search);

  function reset() {
    setAction("");
    setEntityType("");
    setPharmacyId("");
    setFrom("");
    setTo("");
    setSearchInput("");
    setSearch("");
    setPage(0);
  }

  function onFilter<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(0);
    };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground">
          Security and money-relevant events across all pharmacies: sign-ins, staff and role changes, voided sales,
          stock adjustments, price changes, approvals and subscription payments.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search who or what…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8 w-64"
          />
        </div>
        <select
          aria-label="Action"
          value={action}
          onChange={(e) => onFilter(setAction)(e.target.value)}
          className={`${selectClass} w-48`}
        >
          <option value="">All actions</option>
          {facets?.actions.map((value) => (
            <option key={value} value={value}>
              {actionLabel(value)}
            </option>
          ))}
        </select>
        <select
          aria-label="Entity"
          value={entityType}
          onChange={(e) => onFilter(setEntityType)(e.target.value)}
          className={`${selectClass} w-44`}
        >
          <option value="">All entities</option>
          {facets?.entityTypes.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          aria-label="Pharmacy"
          value={pharmacyId}
          onChange={(e) => onFilter(setPharmacyId)(e.target.value)}
          className={`${selectClass} w-52`}
        >
          <option value="">All pharmacies</option>
          {pharmacies?.content.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="audit-from">From</label>
          <Input id="audit-from" type="date" value={from} onChange={(e) => onFilter(setFrom)(e.target.value)} className="w-40" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="audit-to">To</label>
          <Input id="audit-to" type="date" value={to} onChange={(e) => onFilter(setTo)(e.target.value)} className="w-40" />
        </div>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={reset}>
            Clear filters
          </Button>
        )}
      </div>
      {rangeInvalid && <p className="text-sm text-destructive">The end date is before the start date.</p>}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Audit trail</CardTitle>
          <CardDescription>
            {data ? `${data.totalElements.toLocaleString()} ${filtered ? "matching " : ""}entries` : "Loading…"}
            {" · "}Entries are append-only: nothing in the app can edit or delete them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <p className="py-12 text-center text-sm text-destructive">Could not load the audit log.</p>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">{filtered ? "Nothing matches these filters" : "No events recorded yet"}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {filtered ? "Try widening the dates or clearing a filter." : "Events appear here as people use the platform."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">When</th>
                    <th className="pb-3 font-medium">Who</th>
                    <th className="pb-3 font-medium">Pharmacy</th>
                    <th className="pb-3 font-medium">What</th>
                    <th className="pb-3 font-medium">Details</th>
                    <th className="pb-3 font-medium">IP address</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/50 transition-colors align-top">
                      <td className="py-3 pr-3 text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 pr-3">
                        {log.actorEmail ?? <span className="text-muted-foreground italic">System</span>}
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap">
                        {log.pharmacyName ?? <span className="text-muted-foreground italic">Platform</span>}
                      </td>
                      <td className="py-3 pr-3">
                        <Badge variant={actionVariant(log.action)} className="whitespace-nowrap">
                          {actionLabel(log.action)}
                        </Badge>
                      </td>
                      <td className="py-3 pr-3 max-w-md text-muted-foreground">{log.description}</td>
                      <td className="py-3 text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                        {log.ipAddress ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

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
