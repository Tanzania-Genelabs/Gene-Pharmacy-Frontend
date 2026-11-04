"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle, Loader2, UserCheck, Zap } from "lucide-react";
import { adminSettingsApi } from "@/api/admin.api";
import { apiErrorMessage } from "@/lib/errors";
import { timeAgo } from "@/lib/audit";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminPlatformSettings } from "@/types";

type Mode = AdminPlatformSettings["pharmacyApprovalMode"];

const OPTIONS: { mode: Mode; title: string; detail: string; icon: typeof Zap }[] = [
  {
    mode: "auto",
    title: "Automatic approval",
    detail: "A new pharmacy can start working the moment it registers, and its free trial starts at once.",
    icon: Zap,
  },
  {
    mode: "manual",
    title: "Manual approval",
    detail: "A new pharmacy waits until you approve it under Pharmacies. Its free trial starts when you approve.",
    icon: UserCheck,
  },
];

/** Choose whether new pharmacies are approved at once or wait for a SuperAdmin. */
export function ApprovalModeCard() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["admin", "settings"], queryFn: () => adminSettingsApi.get() });

  const change = useMutation({
    mutationFn: (mode: Mode) => adminSettingsApi.setApprovalMode(mode),
    onSuccess: (saved) => {
      qc.setQueryData(["admin", "settings"], saved);
      toast.success(
        saved.pharmacyApprovalMode === "auto"
          ? "New pharmacies are now approved automatically"
          : "New pharmacies now wait for your approval",
      );
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not save the setting")),
  });

  const current = settings.data?.pharmacyApprovalMode;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          New pharmacy approval
        </CardTitle>
        <CardDescription>
          Decides what happens when a pharmacy registers from now on. Pharmacies already waiting stay as they are; approve
          them under Pharmacies.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {settings.isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        {settings.isError && <p className="text-sm text-destructive">Could not read the setting.</p>}

        {current && (
          <>
            <div role="radiogroup" aria-label="New pharmacy approval" className="grid gap-3 md:grid-cols-2">
              {OPTIONS.map(({ mode, title, detail, icon: Icon }) => {
                const selected = current === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={change.isPending}
                    onClick={() => !selected && change.mutate(mode)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors disabled:opacity-60",
                      selected ? "border-primary bg-primary/5" : "hover:bg-accent",
                    )}
                  >
                    <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
                    <span className="space-y-1">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {title}
                        {selected && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] text-primary-foreground">Current</span>}
                        {change.isPending && change.variables === mode && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      </span>
                      <span className="block text-sm text-muted-foreground">{detail}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {settings.data?.updatedBy && (
              <p className="mt-3 text-xs text-muted-foreground">
                Last changed by {settings.data.updatedBy}
                {settings.data.updatedAt ? ` ${timeAgo(settings.data.updatedAt)}` : ""}.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
