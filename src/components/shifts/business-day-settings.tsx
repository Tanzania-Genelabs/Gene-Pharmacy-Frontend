"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { pharmacyApi } from "@/api/pharmacy.api";
import type { PharmacyResponse } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Owner settings for the business day: when the day rolls over for a shop that does not use shifts, and how long a
 * shift may stay open before the system closes it. The day a shop trades on follows its open shift past midnight.
 */
export function BusinessDaySettings({ pharmacyId }: { pharmacyId: string }) {
  const { data: pharmacy } = useQuery({
    queryKey: ["pharmacy", pharmacyId],
    queryFn: () => pharmacyApi.getById(pharmacyId),
    staleTime: Infinity,
  });

  // The form starts from what is saved; it is rebuilt when a save comes back (the key changes with it).
  return pharmacy ? <SettingsForm key={`${pharmacy.dayCutoffTime}-${pharmacy.shiftMaxHours}`} pharmacyId={pharmacyId} pharmacy={pharmacy} /> : null;
}

function SettingsForm({ pharmacyId, pharmacy }: { pharmacyId: string; pharmacy: PharmacyResponse }) {
  const qc = useQueryClient();
  const [cutoff, setCutoff] = useState(pharmacy.dayCutoffTime ?? "00:00");
  const [maxHours, setMaxHours] = useState(String(pharmacy.shiftMaxHours ?? 20));

  const save = useMutation({
    mutationFn: () => pharmacyApi.update(pharmacyId, { dayCutoffTime: cutoff, shiftMaxHours: Number(maxHours) }),
    onSuccess: (updated) => {
      qc.setQueryData(["pharmacy", pharmacyId], updated);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Business day settings saved");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Could not save the settings");
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const hours = Number(maxHours);
    if (!Number.isInteger(hours) || hours < 6 || hours > 36) {
      toast.error("A shift can stay open between 6 and 36 hours");
      return;
    }
    if (!/^(0[0-9]|1[01]):[0-5][0-9]$/.test(cutoff)) {
      toast.error("The day can roll over between 00:00 and 11:59");
      return;
    }
    save.mutate();
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-primary" />
          Business day
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          While a shift is open, every sale stays on the day that shift was opened for, even after midnight. The day ends
          when you close the shift.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="bd-cutoff">When no shift is open, the day ends at</Label>
            <Input id="bd-cutoff" type="time" value={cutoff} onChange={(e) => setCutoff(e.target.value)} required />
            <p className="text-xs text-muted-foreground">00:00 is the plain calendar day. 04:00 keeps sales until 4 am on the day before.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bd-hours">Close a forgotten shift after (hours)</Label>
            <Input id="bd-hours" type="number" min={6} max={36} step={1} value={maxHours} onChange={(e) => setMaxHours(e.target.value)} required />
            <p className="text-xs text-muted-foreground">The system closes it for you; the cash is then not counted.</p>
          </div>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
