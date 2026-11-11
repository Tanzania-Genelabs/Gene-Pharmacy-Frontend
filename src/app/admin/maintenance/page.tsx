"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Play, Wrench } from "lucide-react";
import { adminMaintenanceApi } from "@/api/admin.api";
import { pharmacyApi } from "@/api/pharmacy.api";
import { apiErrorMessage } from "@/lib/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MaintenanceRun, MaintenanceRunStatus, MaintenanceTask } from "@/types";

const STATUS_VARIANT: Record<MaintenanceRunStatus, "default" | "secondary" | "destructive" | "outline"> = {
  Pending: "outline",
  Running: "secondary",
  Completed: "default",
  Failed: "destructive",
  Cancelled: "outline",
};

/**
 * Predefined data fixes. The admin fills in a task and a reason; the background worker (run every minute by the
 * scheduler) picks it up and carries it out, so the database can be put right without a new deployment.
 */
export default function AdminMaintenancePage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const tasks = useQuery({ queryKey: ["admin", "maintenance", "tasks"], queryFn: adminMaintenanceApi.tasks });
  const runs = useQuery({
    queryKey: ["admin", "maintenance", "runs", page],
    queryFn: () => adminMaintenanceApi.runs({ page, size: 20 }),
    // Poll while something is waiting or running, so progress moves on screen.
    refetchInterval: (q) => (q.state.data?.content.some((r) => r.status === "Pending" || r.status === "Running") ? 3_000 : 30_000),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => adminMaintenanceApi.cancel(id),
    onSuccess: () => { toast.success("Cancel requested"); void qc.invalidateQueries({ queryKey: ["admin", "maintenance", "runs"] }); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not cancel")),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight"><Wrench className="h-7 w-7" /> Maintenance</h1>
        <p className="text-muted-foreground">
          Data fixes the background worker carries out for you: pick a task, fill it in and give a reason. It starts within a minute.
          Every run is in the audit log, and in the pharmacy&apos;s own log when it changes that pharmacy.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {tasks.isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          (tasks.data ?? []).map((t) => <TaskCard key={t.key} task={t} />)
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Runs</CardTitle>
          <CardDescription>{runs.data?.totalElements ?? 0} runs, newest first</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Started</th>
                  <th className="pb-3 font-medium">Task</th>
                  <th className="pb-3 font-medium">Pharmacy</th>
                  <th className="pb-3 font-medium">Progress</th>
                  <th className="pb-3 font-medium">Result</th>
                  <th className="pb-3 font-medium">State</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody className="divide-y align-top">
                {(runs.data?.content ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 pr-3 whitespace-nowrap text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                      <div className="text-xs">{r.requestedByEmail}</div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="font-medium">{r.taskLabel}</span>
                      {r.dryRun && <Badge variant="outline" className="ml-2">Dry run</Badge>}
                      <div className="max-w-xs text-xs text-muted-foreground">{r.reason}</div>
                      <ParamsLine run={r} />
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">{r.pharmacyName ?? (r.params.pharmacyId ? r.params.pharmacyId : "All")}</td>
                    <td className="py-2.5 pr-3 whitespace-nowrap tabular-nums">
                      {r.progressTotal > 0 ? `${r.progressDone} / ${r.progressTotal}` : r.status === "Pending" ? "Waiting for the worker" : "—"}
                    </td>
                    <td className="py-2.5 pr-3 max-w-sm text-xs">
                      {r.error ? <span className="text-red-600">{r.error}</span> : <ResultLine result={r.result} />}
                    </td>
                    <td className="py-2.5 pr-3"><Badge variant={STATUS_VARIANT[r.status]}>{r.status}{r.cancelRequested && r.status === "Running" ? " (stopping)" : ""}</Badge></td>
                    <td className="py-2.5 text-right">
                      {(r.status === "Pending" || (r.status === "Running" && !r.cancelRequested)) && (
                        <Button size="sm" variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate(r.id)}>Cancel</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(runs.data?.content.length ?? 0) === 0 && !runs.isLoading && <p className="py-10 text-center text-sm text-muted-foreground">Nothing has been run yet.</p>}
          </div>
          {(runs.data?.totalPages ?? 0) > 1 && (
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={runs.data?.last} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ParamsLine({ run }: { run: MaintenanceRun }) {
  const shown = Object.entries(run.params).filter(([k]) => k !== "pharmacyId");
  if (shown.length === 0) return null;
  return <div className="text-xs text-muted-foreground">{shown.map(([k, v]) => `${k}: ${v}`).join(" · ")}</div>;
}

function ResultLine({ result }: { result: Record<string, unknown> | null }) {
  if (!result) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="space-y-0.5">
      {Object.entries(result).filter(([, v]) => v !== null && v !== false).map(([k, v]) => (
        <div key={k}>
          <span className="text-muted-foreground">{k}:</span>{" "}
          {typeof v === "object" ? Object.entries(v as Record<string, unknown>).map(([a, b]) => `${a} (${String(b)})`).join(", ") || "none" : String(v)}
        </div>
      ))}
    </div>
  );
}

function TaskCard({ task }: { task: MaintenanceTask }) {
  const qc = useQueryClient();
  const [params, setParams] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [dryRun, setDryRun] = useState(task.supportsDryRun);
  const needsPharmacy = task.fields.some((f) => f.type === "pharmacy");
  const pharmacies = useQuery({
    queryKey: ["admin", "maintenance", "pharmacies"],
    queryFn: () => pharmacyApi.list({ page: 0, size: 500 }),
    enabled: needsPharmacy,
    staleTime: 5 * 60_000,
  });

  const missing = task.fields.some((f) => f.required && !params[f.name]);
  const start = useMutation({
    mutationFn: () => adminMaintenanceApi.start({ task: task.key, params, dryRun, reason: reason.trim() }),
    onSuccess: () => {
      toast.success(`${task.label}${dryRun ? " (dry run)" : ""} queued. The worker starts it within a minute.`);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["admin", "maintenance", "runs"] });
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not start the task")),
  });

  const set = (name: string, value: string) => setParams((p) => ({ ...p, [name]: value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{task.label}</CardTitle>
        <CardDescription>{task.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {task.fields.map((f) => (
          <div key={f.name} className="space-y-1">
            <Label>{f.label}{f.required ? " *" : ""}</Label>
            {f.type === "pharmacy" ? (
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={params[f.name] ?? ""}
                onChange={(e) => set(f.name, e.target.value)}
              >
                <option value="">{f.required ? "Choose a pharmacy…" : "All pharmacies"}</option>
                {(pharmacies.data?.content ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            ) : f.type === "date" ? (
              <Input type="date" value={params[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} />
            ) : f.type === "boolean" ? (
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={params[f.name] === "1"} onChange={(e) => set(f.name, e.target.checked ? "1" : "")} />
            ) : (
              <Input value={params[f.name] ?? ""} placeholder={f.type === "branch" ? "Branch id (leave empty for all)" : undefined} onChange={(e) => set(f.name, e.target.value.trim())} />
            )}
            {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
          </div>
        ))}
        <div className="space-y-1">
          <Label>Reason * (at least 10 characters)</Label>
          <Textarea rows={2} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="Why is this needed? e.g. Owner moved the day cut-off to 04:00" />
        </div>
        {task.supportsDryRun && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            Dry run: only count what would change
          </label>
        )}
        <Button disabled={missing || reason.trim().length < 10 || start.isPending} onClick={() => start.mutate()}>
          {start.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {dryRun ? "Start dry run" : "Run"}
        </Button>
      </CardContent>
    </Card>
  );
}
