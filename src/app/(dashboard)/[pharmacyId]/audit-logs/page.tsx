"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditLogApi } from "@/api/audit-log.api";
import { Shield, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import type { AuditAction } from "@/types";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

const actionVariant: Partial<Record<AuditAction, "default" | "secondary" | "destructive" | "outline">> = {
  Create: "default",
  Update: "outline",
  Delete: "destructive",
  Login: "secondary",
  Logout: "secondary",
  Export: "outline",
  Import: "outline",
};

export default function AuditLogsPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", pharmacyId, page],
    queryFn: () => auditLogApi.list(pharmacyId, { page, size: 30 }),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Audit Logs</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Full activity trail · {data?.totalElements ?? 0} records
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
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
                    <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                data?.content.map((log) => (
                  <TableRow key={log.id} className="hover:bg-accent/50">
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{log.performedBy}</p>
                        <p className="text-xs text-muted-foreground">{log.userRole}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={actionVariant[log.action] ?? "secondary"}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{log.entityType}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.entityId?.slice(0, 8)}…
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground text-xs">
                      {log.ipAddress ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground text-xs">
                      {new Date(log.createdAt).toLocaleString()}
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
          <span>Page {page + 1} of {data.totalPages}</span>
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
