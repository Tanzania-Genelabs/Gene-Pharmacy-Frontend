"use client";

import { use, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditLogApi } from "@/api/audit-log.api";
import { actionLabel, actionVariant } from "@/lib/audit";
import { Search, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default function AuditLogsPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const [page, setPage] = useState(0);
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Wait for a pause in typing before asking the server.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Only offer actions that have actually happened in this pharmacy.
  const { data: facets } = useQuery({
    queryKey: ["audit-logs", pharmacyId, "facets"],
    queryFn: () => auditLogApi.facets(pharmacyId),
  });

  const rangeInvalid = !!from && !!to && to < from;

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", pharmacyId, page, action, from, to, search],
    queryFn: () =>
      auditLogApi.list(pharmacyId, {
        page,
        size: 30,
        action: action || undefined,
        from: from || undefined,
        to: to || undefined,
        search: search || undefined,
      }),
    enabled: !rangeInvalid,
    placeholderData: (prev) => prev,
  });

  const filtered = !!(action || from || to || search);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Audit Logs</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Who did what in your pharmacy: sign-ins, staff changes, voided sales, stock adjustments, price changes and
          payments · {data?.totalElements ?? 0} {filtered ? "matching " : ""}records. Entries cannot be edited or deleted.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
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
          onChange={(e) => {
            setAction(e.target.value);
            setPage(0);
          }}
          className={`${selectClass} w-52`}
        >
          <option value="">All actions</option>
          {facets?.actions.map((value) => (
            <option key={value} value={value}>
              {actionLabel(value)}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="log-from">From</label>
          <Input id="log-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} className="w-40" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="log-to">To</label>
          <Input id="log-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} className="w-40" />
        </div>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAction("");
              setFrom("");
              setTo("");
              setSearchInput("");
              setSearch("");
              setPage(0);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
      {rangeInvalid && <p className="text-sm text-destructive">The end date is before the start date.</p>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>What</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>IP address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 w-full bg-muted animate-pulse rounded" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data?.content.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    {filtered ? "Nothing matches these filters" : "No events recorded yet"}
                  </TableCell>
                </TableRow>
              ) : (
                data?.content.map((log) => (
                  <TableRow key={log.id} className="hover:bg-accent/50 align-top">
                    <TableCell className="tabular-nums text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.actorEmail ?? <span className="text-muted-foreground italic">System</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={actionVariant(log.action)} className="whitespace-nowrap">
                        {actionLabel(log.action)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-md whitespace-normal">{log.description}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground text-xs whitespace-nowrap">
                      {log.ipAddress ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page + 1} of {data.totalPages}
          </span>
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
