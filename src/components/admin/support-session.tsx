"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2, LifeBuoy } from "lucide-react";
import { adminSupportApi } from "@/api/admin.api";
import { apiErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { SupportSession } from "@/types";

const DURATIONS = [
  { minutes: 15, label: "15 minutes" },
  { minutes: 30, label: "30 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
  { minutes: 240, label: "4 hours (longest)" },
];

export const supportKey = (pharmacyId: string) => ["admin", "support-session", pharmacyId];

/** Shown instead of a pharmacy's workspace until the admin says why they are going in, and for how long. */
export function SupportGate({ pharmacyId, pharmacyName }: { pharmacyId: string; pharmacyName?: string }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [minutes, setMinutes] = useState(30);

  const start = useMutation({
    mutationFn: () => adminSupportApi.start(pharmacyId, reason.trim(), minutes),
    onSuccess: (session) => {
      qc.setQueryData(supportKey(pharmacyId), session);
      toast.success("Support session started");
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not start the session")),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LifeBuoy className="h-5 w-5" /> Open {pharmacyName ?? "this pharmacy"}</CardTitle>
          <CardDescription>
            You are about to enter a pharmacy&apos;s private data. Say why and for how long. The session ends by itself, every change you make is recorded, and the pharmacy owner can see in their audit log that support was inside.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            rows={3}
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why do you need access? (at least 10 characters) e.g. Owner called about missing stock after the Tuesday delivery"
            maxLength={500}
          />
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <Button key={d.minutes} size="sm" variant={minutes === d.minutes ? "default" : "outline"} onClick={() => setMinutes(d.minutes)}>
                {d.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" disabled={start.isPending || reason.trim().length < 10} onClick={() => start.mutate()}>
              {start.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Start session
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/admin/pharmacies/${pharmacyId}`}><ArrowLeft className="h-4 w-4" /> Back</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** The bar at the top of a pharmacy while an admin is inside: who, why, time left, and how to leave. */
export function SupportBanner({ session, pharmacyName, status }: { session: SupportSession; pharmacyName?: string; status?: string }) {
  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const left = Math.max(0, new Date(session.expiresAt).getTime() - now);

  // When the time is up the door closes: ask the server, which will say there is no session any more.
  useEffect(() => {
    if (left === 0) void qc.invalidateQueries({ queryKey: supportKey(session.pharmacyId) });
  }, [left, qc, session.pharmacyId]);

  const end = useMutation({
    mutationFn: () => adminSupportApi.end(session.id),
    onSuccess: () => {
      qc.setQueryData(supportKey(session.pharmacyId), null);
      window.location.assign(`/admin/pharmacies/${session.pharmacyId}`);
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not end the session")),
  });

  const minutes = Math.ceil(left / 60_000);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-primary px-6 py-1.5 text-xs font-medium text-primary-foreground">
      <span>
        Support session - {pharmacyName ?? "this pharmacy"}
        {status && status !== "Active" ? ` (${status})` : ""} · {minutes} min left · &ldquo;{session.reason}&rdquo; · {session.writeCount} change{session.writeCount === 1 ? "" : "s"} recorded
      </span>
      <span className="flex items-center gap-3">
        <Link href={`/admin/pharmacies/${session.pharmacyId}`} className="underline underline-offset-2">Back to admin</Link>
        <button type="button" className="underline underline-offset-2" onClick={() => end.mutate()} disabled={end.isPending}>
          End session
        </button>
      </span>
    </div>
  );
}
