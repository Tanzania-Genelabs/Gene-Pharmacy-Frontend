"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LifeBuoy, Loader2, Plus } from "lucide-react";
import { supportApi } from "@/api/support.api";
import { RequestHelpDialog, type HelpContext } from "@/components/support/request-help-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { SupportRequestKind, SupportRequestStatus } from "@/types";

const KIND: Record<SupportRequestKind, string> = { MoveSales: "Sales on the wrong day", ShiftCash: "Shift or cash count", Other: "Other" };
const STATUS: Record<SupportRequestStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  Open: { label: "Waiting", variant: "outline" },
  Resolved: { label: "Done", variant: "default" },
  Rejected: { label: "Declined", variant: "secondary" },
};

/** Requests to Gene Pharmacy to correct something the shop may not change itself, and the answers. */
export default function HelpRequestsPage({ params }: { params: Promise<{ pharmacyId: string }> }) {
  const { pharmacyId } = use(params);
  const [help, setHelp] = useState<HelpContext | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["support-requests", pharmacyId],
    queryFn: () => supportApi.list(pharmacyId, { page: 0, size: 50 }),
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><LifeBuoy className="h-6 w-6" /> Help requests</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask Gene Pharmacy to correct what you cannot change yourself, such as sales counted on the wrong day or a shift closed by mistake.
          </p>
        </div>
        <Button size="sm" onClick={() => setHelp({ kind: "Other" })}><Plus className="h-4 w-4" /> New request</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (data?.content.length ?? 0) === 0 ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">
          No requests yet. You can also ask from a day in Sales history or from a shift in Shifts.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {data!.content.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-2 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {KIND[r.kind]}
                    {r.businessDate ? ` · ${new Date(`${r.businessDate}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}` : ""}
                    {r.saleIds.length > 0 ? ` · ${r.saleIds.length} receipt${r.saleIds.length === 1 ? "" : "s"}` : ""}
                  </span>
                  <Badge variant={STATUS[r.status].variant}>{STATUS[r.status].label}</Badge>
                </div>
                <p className="whitespace-pre-wrap text-sm">{r.message}</p>
                <p className="text-xs text-muted-foreground">{r.requestedByName ?? "Someone"} · {new Date(r.createdAt).toLocaleString()}</p>
                {r.adminNote && (
                  <div className="rounded-md bg-muted p-3 text-sm">
                    <span className="font-medium">Gene Pharmacy: </span>{r.adminNote}
                    {r.resolvedAt && <span className="block text-xs text-muted-foreground">{new Date(r.resolvedAt).toLocaleString()}</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RequestHelpDialog pharmacyId={pharmacyId} context={help} onClose={() => setHelp(null)} />
    </div>
  );
}
