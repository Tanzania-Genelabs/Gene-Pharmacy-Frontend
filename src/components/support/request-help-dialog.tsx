"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supportApi } from "@/api/support.api";
import { apiErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SupportRequestKind } from "@/types";

export interface HelpContext {
  kind: SupportRequestKind;
  /** What the request is about, shown to the user, e.g. "Sales of Fri 7 Nov". */
  about?: string;
  businessDate?: string;
  shiftId?: string;
  saleIds?: string[];
  branchId?: string;
}

const KIND_LABELS: Record<SupportRequestKind, string> = {
  MoveSales: "Sales are on the wrong day",
  ShiftCash: "A shift or its cash count is wrong",
  Other: "Something else",
};

const PLACEHOLDERS: Record<SupportRequestKind, string> = {
  MoveSales: "e.g. We were open until 2am on Friday but the sales after midnight show on Saturday. Please put them on Friday.",
  ShiftCash: "e.g. The shift was closed by mistake at 3pm. Please open it again.",
  Other: "Tell us what is wrong and what you would like corrected.",
};

/** Asks Gene Pharmacy to correct something the shop may not change itself. The answer shows on the Help requests page. */
export function RequestHelpDialog({ pharmacyId, context, onClose }: { pharmacyId: string; context: HelpContext | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<SupportRequestKind>(context?.kind ?? "Other");
  const [message, setMessage] = useState("");
  const [lastContext, setLastContext] = useState(context);
  if (context !== lastContext) {
    // A new request was opened: start from its kind and an empty message.
    setLastContext(context);
    setKind(context?.kind ?? "Other");
    setMessage("");
  }

  const send = useMutation({
    mutationFn: () => supportApi.create(pharmacyId, {
      kind,
      message: message.trim(),
      businessDate: context?.businessDate,
      shiftId: context?.shiftId,
      saleIds: context?.saleIds,
      branchId: context?.branchId,
    }),
    onSuccess: () => {
      toast.success("Sent to Gene Pharmacy. You will see the answer under Help requests.");
      void qc.invalidateQueries({ queryKey: ["support-requests", pharmacyId] });
      onClose();
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not send the request")),
  });

  return (
    <Dialog open={!!context} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" aria-describedby="help-desc">
        <DialogHeader>
          <DialogTitle>Ask Gene Pharmacy to fix it</DialogTitle>
          <DialogDescription id="help-desc">
            {context?.about ? `${context.about}. ` : ""}Our team checks it, makes the correction and writes back. Every correction is in your audit log.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-6 py-2">
          <div className="space-y-1">
            <Label>What is wrong?</Label>
            <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={kind} onChange={(e) => setKind(e.target.value as SupportRequestKind)}>
              {(Object.keys(KIND_LABELS) as SupportRequestKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Details * (at least 10 characters)</Label>
            <Textarea rows={4} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={PLACEHOLDERS[kind]} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={message.trim().length < 10 || send.isPending} onClick={() => send.mutate()}>
            {send.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
