"use client";

import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Loader2, MessageCircle } from "lucide-react";
import { shiftApi } from "@/api/shift.api";
import { dayReportText } from "@/lib/day-report";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** The end-of-day report of one shift, with buttons to send it on WhatsApp or copy it. */
export function ShiftReportDialog({ pharmacyId, shiftId, onClose }: { pharmacyId: string; shiftId: string | null; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["shifts", pharmacyId, "report", shiftId],
    queryFn: () => shiftApi.report(pharmacyId, shiftId!),
    enabled: !!shiftId,
  });
  const text = data ? dayReportText(data) : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Report copied");
    } catch {
      toast.error("Could not copy. Select the text and copy it by hand.");
    }
  };

  return (
    <Dialog open={!!shiftId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>End-of-day report</DialogTitle></DialogHeader>
        <div className="px-6 py-2">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : isError || !data ? (
            <p className="py-6 text-sm text-red-600">Could not load the report.</p>
          ) : (
            <pre className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-sans text-sm leading-relaxed">{text.replace(/\*/g, "")}</pre>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={!data} onClick={copy}><Copy className="h-4 w-4" /> Copy</Button>
          <Button disabled={!data} asChild={!!data}>
            {data ? (
              <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" /> Send on WhatsApp
              </a>
            ) : (
              <span><MessageCircle className="h-4 w-4" /> Send on WhatsApp</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
