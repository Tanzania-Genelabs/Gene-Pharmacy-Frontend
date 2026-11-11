"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Info, TriangleAlert, X } from "lucide-react";
import { supportApi } from "@/api/support.api";
import { cn } from "@/lib/utils";

const DISMISSED_KEY = "gene:dismissed-announcements";

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/** Notices from Gene Pharmacy (new app version, planned downtime) at the top of the pharmacy's screens. */
export function AnnouncementBanner({ pharmacyId }: { pharmacyId: string }) {
  // Read once on the client; the banner only appears after the notices load, so the server render never differs.
  const [dismissed, setDismissed] = useState<string[]>(() => (typeof window === "undefined" ? [] : readDismissed()));

  const { data } = useQuery({
    queryKey: ["announcements", pharmacyId],
    queryFn: () => supportApi.announcements(pharmacyId),
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: false,
  });

  const shown = (data ?? []).filter((a) => !dismissed.includes(a.id));
  if (shown.length === 0) return null;

  const dismiss = (id: string) => {
    const next = [...dismissed, id].slice(-50);
    setDismissed(next);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      /* private mode: it shows again next time */
    }
  };

  return (
    <div className="space-y-px">
      {shown.map((a) => {
        const warning = a.level === "warning";
        const Icon = warning ? TriangleAlert : Info;
        return (
          <div
            key={a.id}
            role="status"
            className={cn(
              "flex items-start gap-3 px-6 py-2 text-sm",
              warning ? "bg-amber-100 text-amber-950 dark:bg-amber-500/15 dark:text-amber-100" : "bg-sky-50 text-sky-950 dark:bg-sky-500/10 dark:text-sky-100",
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1"><span className="font-semibold">{a.title}</span> · {a.message}</p>
            <button type="button" aria-label="Dismiss" className="opacity-70 hover:opacity-100" onClick={() => dismiss(a.id)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
