"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dayHeading } from "@/lib/periods";
import type { BranchResponse } from "@/types";
import { greeting } from "./format";

interface Props {
  firstName?: string | null;
  pharmacyName?: string | null;
  todayKey: string;
  hour: number;
  /** Shown only when there is a choice to make. */
  branches?: BranchResponse[];
  branchId?: string;
  onBranchChange?: (id: string) => void;
  /** A fixed branch name, for people held to one branch. */
  fixedBranchName?: string | null;
  updatedAt?: string | null;
  refreshing?: boolean;
  refreshFailed?: boolean;
  onRefresh?: () => void;
}

/** Greeting, date, branch picker and "Updated hh:mm" with a refresh button. */
export function DashboardHeader({
  firstName, pharmacyName, todayKey, hour, branches, branchId = "", onBranchChange, fixedBranchName,
  updatedAt, refreshing, refreshFailed, onRefresh,
}: Props) {
  const active = (branches ?? []).filter((b) => b.status === "Active");
  const showPicker = onBranchChange && active.length > 1;

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {greeting(hour)}{firstName ? `, ${firstName}` : ""} 👋
        </h2>
        <p className="text-muted-foreground text-sm mt-1 truncate">
          {dayHeading(todayKey)}
          {pharmacyName ? ` · ${pharmacyName}` : ""}
          {fixedBranchName ? ` · ${fixedBranchName}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {showPicker && (
          <select
            aria-label="Branch"
            className="h-9 max-w-[14rem] rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={branchId}
            onChange={(e) => onBranchChange(e.target.value)}
          >
            <option value="">All branches</option>
            {active.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
        {onRefresh && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className={cn(refreshFailed && "text-amber-600 dark:text-amber-400")}>
              {refreshFailed ? "Couldn't refresh" : updatedAt ? `Updated ${updatedAt}` : "Loading…"}
            </span>
            <Button variant="ghost" size="icon-sm" onClick={onRefresh} disabled={refreshing} aria-label="Refresh" title="Refresh">
              <RefreshCw className={cn(refreshing && "animate-spin")} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
