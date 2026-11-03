"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

interface ReasonDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  destructive?: boolean;
  /** When false the reason may be left empty (it is still kept if given). */
  required?: boolean;
  pending?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/**
 * Sensitive admin actions (suspend, reject, change a plan, disable an account...) ask for a reason first.
 * The reason is saved in the audit log next to who did it and what changed.
 */
export function ReasonDialog({ open, title, description, confirmLabel, destructive, required = true, pending, onConfirm, onClose }: ReasonDialogProps) {
  // Remount when it opens so a reason typed for one action is never carried into the next.
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-md p-6" aria-describedby="reason-desc">
        {open && <ReasonForm {...{ title, description, confirmLabel, destructive, required, pending, onConfirm, onClose }} />}
      </DialogContent>
    </Dialog>
  );
}

function ReasonForm({ title, description, confirmLabel, destructive, required = true, pending, onConfirm, onClose }: Omit<ReasonDialogProps, "open">) {
  const [reason, setReason] = useState("");
  const ok = !required || reason.trim().length >= 5;

  return (
    <>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription id="reason-desc" className="mt-1">
        {description ?? "Say why. This is saved in the audit log with your name."}
      </DialogDescription>
      <Textarea
        className="mt-4"
        rows={3}
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={required ? "Reason (at least 5 characters)" : "Reason (optional)"}
        maxLength={500}
      />
      <div className="mt-4 flex gap-2">
        <Button className="flex-1" variant={destructive ? "destructive" : "default"} disabled={!ok || pending} onClick={() => onConfirm(reason.trim())}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} {confirmLabel}
        </Button>
        <Button variant="outline" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </>
  );
}
