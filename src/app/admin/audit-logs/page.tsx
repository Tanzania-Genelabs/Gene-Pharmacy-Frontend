"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminAuditLogApi } from "@/api/admin.api";
import type { AdminAuditLogSummary } from "@/api/admin.api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Loader2, Search } from "lucide-react";

const ACTION_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  Create: "default",
  Update: "secondary",
  Delete: "destructive",
  Login: "outline",
  Logout: "outline",
  Approve: "default",
  Reject: "destructive",
  Activate: "default",
  Deactivate: "destructive",
  Export: "secondary",
  Transfer: "secondary",
  Payment: "default",
  Void: "destructive",
};

const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All Actions" },
  { value: "Create", label: "Create" },
  { value: "Update", label: "Update" },
  { value: "Delete", label: "Delete" },
  { value: "Login", label: "Login" },
  { value: "Logout", label: "Logout" },
  { value: "Approve", label: "Approve" },
  { value: "Reject", label: "Reject" },
  { value: "Activate", label: "Activate" },
  { value: "Deactivate", label: "Deactivate" },
  { value: "Export", label: "Export" },
  { value: "Payment", label: "Payment" },
];

const ENTITY_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All Entities" },
  { value: "User", label: "User" },
  { value: "Drug", label: "Drug" },
  { value: "Sale", label: "Sale" },
  { value: "PurchaseOrder", label: "Purchase Order" },
  { value: "Pharmacy", label: "Pharmacy" },
  { value: "Subscription", label: "Subscription" },
  { value: "Inventory", label: "Inventory" },
];

export default function AdminAuditLogsPage() {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: [
      "admin",
      "audit-logs",
      actionFilter,
      entityFilter,
      fromDate,
      toDate,
      page,
    ],
    queryFn: () =>
      adminAuditLogApi.list({
        action: actionFilter === "all" ? undefined : actionFilter,
        entityType: entityFilter === "all" ? undefined : entityFilter,
        from: fromDate || undefined,
        to: toDate || undefined,
        page,
        size: 20,
      }),
  });

  const logs: AdminAuditLogSummary[] = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground">
          Platform-wide activity and security audit trail
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(0);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 w-40"
        >
          {ACTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={entityFilter}
          onChange={(e) => {
            setEntityFilter(e.target.value);
            setPage(0);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 w-44"
        >
          {ENTITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">From:</label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(0);
            }}
            className="w-40"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">To:</label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(0);
            }}
            className="w-40"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
          <CardDescription>
            {data?.totalElements ?? 0} total log entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No audit logs found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Audit events will appear here as users interact with the platform.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Timestamp</th>
                    <th className="pb-3 font-medium">Actor</th>
                    <th className="pb-3 font-medium">Action</th>
                    <th className="pb-3 font-medium">Entity</th>
                    <th className="pb-3 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-3 text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3">
                        {log.actorEmail ?? (
                          <span className="text-muted-foreground italic">
                            System
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={ACTION_VARIANT[log.action] ?? "outline"}
                        >
                          {log.action}
                        </Badge>
                      </td>
                      <td className="py-3">{log.entityType}</td>
                      <td className="py-3 max-w-md truncate text-muted-foreground">
                        {log.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <p className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
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
