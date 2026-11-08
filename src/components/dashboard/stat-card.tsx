import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Change } from "./format";

/** One big number with a title, an icon and a short line of help under it. */
export function StatCard({
  title, value, icon: Icon, iconClass, children, valueClass,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  iconClass: string;
  valueClass?: string;
  children?: ReactNode;
}) {
  return (
    <Card className="gap-0 py-5 hover:shadow-md transition-shadow">
      <CardContent className="px-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", iconClass)}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className={cn("mt-2 text-2xl sm:text-3xl font-bold tabular-nums tracking-tight text-foreground", valueClass)}>{value}</p>
        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">{children}</div>
      </CardContent>
    </Card>
  );
}

/** "▲ 12% vs yesterday" in green, "▼ 5% …" in red, or a neutral line when there is nothing to compare. */
export function ChangeLine({ c, label, none }: { c: Change; label: string; none: string }) {
  if (c.pct === null) return <p>{none}</p>;
  if (c.pct === 0) return <p>Same as {label}</p>;
  return (
    <p>
      <span className={cn("font-semibold", c.up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
        {c.up ? "▲" : "▼"} {Math.abs(c.pct)}%
      </span>{" "}
      vs {label}
    </p>
  );
}

export function StatCardSkeleton() {
  return (
    <Card className="gap-0 py-5">
      <CardContent className="px-5 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-8 w-8 rounded-lg bg-muted" />
        </div>
        <div className="mt-3 h-8 w-32 rounded bg-muted" />
        <div className="mt-2 h-3 w-40 rounded bg-muted" />
      </CardContent>
    </Card>
  );
}

/** A grey block the size of a card, for loading. */
export function BlockSkeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl border bg-card", className)}><div className="m-5 h-4 w-32 rounded bg-muted" /></div>;
}
