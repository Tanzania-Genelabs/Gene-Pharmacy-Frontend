"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Inbox, Loader2 } from "lucide-react";
import { adminRequestApi } from "@/api/admin.api";
import { apiErrorMessage } from "@/lib/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SupportRequest, SupportRequestKind, SupportRequestStatus } from "@/types";

const KIND: Record<SupportRequestKind, string> = { MoveSales: "Sales on the wrong day", ShiftCash: "Shift / cash count", Other: "Other" };
const FILTERS: { value: SupportRequestStatus | ""; label: string }[] = [
  { value: "Open", label: "Open" },
  { value: "Resolved", label: "Done" },
  { value: "Rejected", label: "Declined" },
  { value: "", label: "All" },
];

/** Pharmacies asking for corrections. The fix is made inside a support session; the answer goes back to the pharmacy. */
export default function AdminRequestsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<SupportRequestStatus | "">("Open");
  const [page, setPage] = useState(0);
  const [answering, setAnswering] = useState<{ request: SupportRequest; status: "Resolved" | "Rejected" } | null>(null);
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "support-requests", status, page],
    queryFn: () => adminRequestApi.list({ status: status || undefined, page, size: 20 }),
    refetchInterval: 60_000,
  });

  const answer = useMutation({
    mutationFn: () => adminRequestApi.resolve(answering!.request.id, answering!.status, note.trim()),
    onSuccess: () => {
      toast.success("Answer sent to the pharmacy");
      setAnswering(null);
      void qc.invalidateQueries({ queryKey: ["admin", "support-requests"] });
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not save the answer")),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight"><Inbox className="h-7 w-7" /> Requests</h1>
        <p className="text-muted-foreground">
          Pharmacies asking for a correction. Open the pharmacy (a support session starts), fix it, then mark it done with a short answer the owner will read.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button key={f.label} size="sm" variant={status === f.value ? "default" : "outline"} onClick={() => { setStatus(f.value); setPage(0); }}>
            {f.label}{f.value === "Open" && data?.openCount ? ` (${data.openCount})` : ""}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{FILTERS.find((f) => f.value === status)?.label} requests</CardTitle>
          <CardDescription>{data?.totalElements ?? 0} requests</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (data?.content.length ?? 0) === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nothing here.</p>
          ) : (
            data!.content.map((r) => (
              <div key={r.id} className="space-y-2 rounded-md border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">
                    <Link href={`/admin/pharmacies/${r.pharmacyId}`} className="hover:underline">{r.pharmacyName ?? r.pharmacyId}</Link>
                    <span className="text-muted-foreground"> · {KIND[r.kind]}</span>
                    {r.businessDate && <span className="text-muted-foreground"> · {r.businessDate}</span>}
                    {r.saleIds.length > 0 && <span className="text-muted-foreground"> · {r.saleIds.length} receipt(s)</span>}
                  </div>
                  <Badge variant={r.status === "Open" ? "outline" : r.status === "Resolved" ? "default" : "secondary"}>{r.status}</Badge>
                </div>
                <p className="whitespace-pre-wrap text-sm">{r.message}</p>
                <p className="text-xs text-muted-foreground">{r.requestedByName ?? "—"} · {new Date(r.createdAt).toLocaleString()}</p>
                {r.adminNote && (
                  <p className="rounded bg-muted p-2 text-sm"><span className="font-medium">{r.resolvedByEmail}: </span>{r.adminNote}</p>
                )}
                {r.status === "Open" && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/${r.pharmacyId}/${r.kind === "ShiftCash" ? "shifts" : "sales"}`}><ExternalLink className="h-4 w-4" /> Open pharmacy</Link>
                    </Button>
                    <Button size="sm" onClick={() => { setAnswering({ request: r, status: "Resolved" }); setNote(""); }}>Mark done</Button>
                    <Button size="sm" variant="outline" onClick={() => { setAnswering({ request: r, status: "Rejected" }); setNote(""); }}>Decline</Button>
                  </div>
                )}
              </div>
            ))
          )}
          {(data?.totalPages ?? 0) > 1 && (
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={data?.last} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!answering} onOpenChange={(o) => !o && setAnswering(null)}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{answering?.status === "Resolved" ? "Mark as done" : "Decline the request"}</DialogTitle></DialogHeader>
          <div className="space-y-1 px-6 py-2">
            <Label>Answer to the pharmacy *</Label>
            <Textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={answering?.status === "Resolved" ? "e.g. Moved the 12 sales made after midnight to Friday 7 Nov." : "e.g. These sales were made after the shop closed; they belong to Saturday."} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnswering(null)}>Cancel</Button>
            <Button disabled={note.trim().length < 5 || answer.isPending} onClick={() => answer.mutate()}>
              {answer.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Send answer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
