"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationApi } from "@/api/notification.api";
import { toast } from "sonner";
import { Bell, CheckCheck } from "lucide-react";
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
import type { NotificationType } from "@/types";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

const typeVariant: Partial<Record<NotificationType, string>> = {
  LowStock: "text-orange-600 dark:text-orange-400",
  ExpiryAlert: "text-destructive",
  SaleProcessed: "text-emerald-600 dark:text-emerald-400",
  OrderReceived: "text-blue-600 dark:text-blue-400",
  SystemAlert: "text-blue-600 dark:text-blue-400",
};

export default function NotificationsPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const qc = useQueryClient();
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", pharmacyId, page],
    queryFn: () => notificationApi.list(pharmacyId, { page, size: 20 }),
    placeholderData: (prev) => prev,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(pharmacyId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", pharmacyId] }),
    onError: () => toast.error("Failed to mark as read"),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllRead(pharmacyId),
    onSuccess: () => {
      toast.success("All notifications marked as read");
      qc.invalidateQueries({ queryKey: ["notifications", pharmacyId] });
    },
    onError: () => toast.error("Failed to mark all as read"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Notifications</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {data?.totalElements ?? 0} notifications
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAllReadMutation.mutate()}
          disabled={markAllReadMutation.isPending}
        >
          <CheckCheck className="h-4 w-4 mr-2" />
          Mark all read
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
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
                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No notifications
                  </TableCell>
                </TableRow>
              ) : (
                data?.content.map((notif) => (
                  <TableRow
                    key={notif.id}
                    className={cn(
                      "hover:bg-accent/50",
                      notif.status === "Pending" && "bg-accent/20"
                    )}
                  >
                    <TableCell>
                      <span className={cn("text-sm font-medium", typeVariant[notif.type] ?? "")}>
                        {notif.type}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[400px]">
                      <p className="truncate text-sm">{notif.message}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={notif.status === "Pending" ? "default" : "secondary"}>
                        {notif.status === "Pending" ? "Unread" : notif.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground text-xs">
                      {new Date(notif.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {notif.status === "Pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => markReadMutation.mutate(notif.id)}
                          disabled={markReadMutation.isPending}
                        >
                          Mark read
                        </Button>
                      )}
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
