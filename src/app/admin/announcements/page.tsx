"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Megaphone } from "lucide-react";
import { adminAnnouncementApi } from "@/api/admin.api";
import { pharmacyApi } from "@/api/pharmacy.api";
import { apiErrorMessage } from "@/lib/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Short notices shown at the top of every pharmacy's web app and phone app. */
export default function AdminAnnouncementsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [form, setForm] = useState({ title: "", message: "", level: "info" as "info" | "warning", startsAt: "", endsAt: "", everyone: true });
  const [chosen, setChosen] = useState<string[]>([]);

  const list = useQuery({ queryKey: ["admin", "announcements", page], queryFn: () => adminAnnouncementApi.list({ page, size: 20 }) });
  const pharmacies = useQuery({
    queryKey: ["admin", "announcements", "pharmacies"],
    queryFn: () => pharmacyApi.list({ page: 0, size: 500 }),
    enabled: !form.everyone,
    staleTime: 5 * 60_000,
  });

  const publish = useMutation({
    mutationFn: () => adminAnnouncementApi.create({
      title: form.title.trim(),
      message: form.message.trim(),
      level: form.level,
      pharmacyIds: form.everyone ? undefined : chosen,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
    }),
    onSuccess: () => {
      toast.success("Published");
      setForm({ title: "", message: "", level: "info", startsAt: "", endsAt: "", everyone: true });
      setChosen([]);
      void qc.invalidateQueries({ queryKey: ["admin", "announcements"] });
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not publish")),
  });
  const end = useMutation({
    mutationFn: (id: string) => adminAnnouncementApi.end(id),
    onSuccess: () => { toast.success("Taken down"); void qc.invalidateQueries({ queryKey: ["admin", "announcements"] }); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not take it down")),
  });

  const ready = form.title.trim().length >= 3 && form.message.trim().length >= 5 && (form.everyone || chosen.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight"><Megaphone className="h-7 w-7" /> Announcements</h1>
        <p className="text-muted-foreground">Notices shown at the top of the pharmacies&apos; web and phone apps, e.g. a new app version or planned downtime.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>New announcement</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1">
              <Label>Title *</Label>
              <Input maxLength={120} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Update the Gene Pharmacy app" />
            </div>
            <div className="space-y-1">
              <Label>Kind</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value as "info" | "warning" }))}>
                <option value="info">Information</option>
                <option value="warning">Important</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Message *</Label>
            <Textarea rows={3} maxLength={1000} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="e.g. Version 1.2 fixes sales after midnight. Update from the Play Store." />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Starts (empty = now)</Label>
              <Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Ends (empty = until taken down)</Label>
              <Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={form.everyone} onChange={(e) => setForm((f) => ({ ...f, everyone: e.target.checked }))} />
            Every pharmacy
          </label>
          {!form.everyone && (
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
              {pharmacies.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {(pharmacies.data?.content ?? []).map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-primary" checked={chosen.includes(p.id)}
                    onChange={(e) => setChosen((c) => (e.target.checked ? [...c, p.id] : c.filter((x) => x !== p.id)))} />
                  {p.name} <span className="text-xs text-muted-foreground">{p.city}</span>
                </label>
              ))}
            </div>
          )}
          <Button disabled={!ready || publish.isPending} onClick={() => publish.mutate()}>
            {publish.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Publish
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Published</CardTitle>
          <CardDescription>{list.data?.totalElements ?? 0} announcements</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(list.data?.content ?? []).map((a) => (
            <div key={a.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {a.title} {a.level === "warning" && <Badge variant="destructive" className="ml-1">Important</Badge>}
                </p>
                <p className="text-sm">{a.message}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(a.startsAt).toLocaleString()} → {a.endsAt ? new Date(a.endsAt).toLocaleString() : "until taken down"} ·{" "}
                  {a.pharmacyIds?.length ? `${a.pharmacyIds.length} pharmacy(ies)` : "every pharmacy"} · {a.createdByEmail}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={a.live ? "default" : "outline"}>{a.live ? "Showing" : "Not showing"}</Badge>
                {(a.live || !a.endsAt || new Date(a.endsAt) > new Date()) && (
                  <Button size="sm" variant="outline" disabled={end.isPending} onClick={() => end.mutate(a.id)}>Take down</Button>
                )}
              </div>
            </div>
          ))}
          {(list.data?.content.length ?? 0) === 0 && !list.isLoading && <p className="py-8 text-center text-sm text-muted-foreground">No announcements yet.</p>}
          {(list.data?.totalPages ?? 0) > 1 && (
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={list.data?.last} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
