"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationApi } from "@/api/notification.api";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bell,
  CheckCheck,
  Package,
  AlertTriangle,
  Info,
  ShoppingCart,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { NotificationType } from "@/types";

interface NotificationBellProps {
  pharmacyId: string;
}

const TYPE_ICON: Record<NotificationType, React.ElementType> = {
  LowStock: Package,
  ExpiryAlert: AlertTriangle,
  SaleProcessed: ShoppingCart,
  OrderReceived: ShoppingCart,
  SystemAlert: Info,
};

const TYPE_COLOR: Record<NotificationType, string> = {
  LowStock: "text-orange-500",
  ExpiryAlert: "text-destructive",
  SaleProcessed: "text-emerald-500",
  OrderReceived: "text-blue-500",
  SystemAlert: "text-blue-400",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell({ pharmacyId }: NotificationBellProps) {
  const qc = useQueryClient();
  const router = useRouter();

  const { data: summary } = useQuery({
    queryKey: ["notification-summary", pharmacyId],
    queryFn: () => notificationApi.pendingCount(pharmacyId),
    refetchInterval: 30_000, // poll every 30 s
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(pharmacyId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-summary", pharmacyId] });
      qc.invalidateQueries({ queryKey: ["notifications", pharmacyId] });
    },
    onError: () => toast.error("Failed to mark as read"),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationApi.markAllRead(pharmacyId),
    onSuccess: () => {
      toast.success("All notifications marked as read");
      qc.invalidateQueries({ queryKey: ["notification-summary", pharmacyId] });
      qc.invalidateQueries({ queryKey: ["notifications", pharmacyId] });
    },
    onError: () => toast.error("Failed to mark all as read"),
  });

  const unread = summary?.unreadCount ?? 0;
  const displayItems = summary?.latestItems ?? summary?.latestUnread ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 relative"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground leading-none">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                {unread}
              </Badge>
            )}
          </div>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notification list */}
        <ScrollArea className="max-h-[360px]">
          {displayItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-25" />
              <p className="text-sm">No unread notifications</p>
            </div>
          ) : (
            <div className="py-1">
              {displayItems.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Bell;
                const color = TYPE_COLOR[n.type] ?? "text-muted-foreground";
                const isPending = n.status === "Pending";
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "group flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors",
                      isPending && "bg-accent/20"
                    )}
                  >
                    <div className={cn("mt-0.5 shrink-0 relative", color)}>
                      <Icon className="h-4 w-4" />
                      {isPending && (
                        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                      title="Mark as read"
                      onClick={() => markReadMutation.mutate(n.id)}
                      disabled={markReadMutation.isPending}
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <DropdownMenuSeparator className="my-0" />
        <DropdownMenuItem
          className="justify-center text-sm text-primary font-medium py-2.5 cursor-pointer"
          onClick={() => router.push(`/${pharmacyId}/notifications`)}
        >
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
