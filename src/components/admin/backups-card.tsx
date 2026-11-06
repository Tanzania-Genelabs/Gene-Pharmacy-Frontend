"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Download, HardDrive, Loader2, ShieldAlert } from "lucide-react";
import { adminBackupApi, type BackupFile } from "@/api/admin.api";
import { timeAgo } from "@/lib/audit";
import { apiErrorMessage } from "@/lib/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** Every database backup, and a guarded way to download one in an emergency. */
export function BackupsCard() {
  const list = useQuery({ queryKey: ["admin", "backups"], queryFn: () => adminBackupApi.list() });
  const [target, setTarget] = useState<BackupFile | null>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [reason, setReason] = useState("");
  const [checksum, setChecksum] = useState<{ file: string; sha256: string | null } | null>(null);

  const close = () => {
    setTarget(null);
    setPassword("");
    setCode("");
    setReason("");
  };

  const download = useMutation({
    mutationFn: () => adminBackupApi.download(target!.name, { password, code: code.trim(), reason: reason.trim() }),
    onSuccess: ({ blob, sha256 }) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = target!.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setChecksum({ file: target!.name, sha256 });
      toast.success("Backup downloaded");
      close();
    },
    onError: (e) => {
      // The code is single-use, so a failed try needs a fresh one.
      setCode("");
      toast.error(apiErrorMessage(e, "Could not download the backup"));
    },
  });

  const backups = list.data?.backups ?? [];
  const ready = password.length > 0 && code.trim().length >= 6 && reason.trim().length >= 5;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" /> Database backups
        </CardTitle>
        <CardDescription>
          Every backup the server holds. A backup contains every pharmacy&apos;s data, so downloading one asks for your password and a fresh
          two-factor code again, needs a reason, and is recorded in the audit log.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {list.data && !list.data.twoFactorEnabled && (
          <p className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Turn on two-factor sign-in above first. Backups cannot be downloaded without it.
          </p>
        )}
        {list.data && !list.data.offServerConfigured && (
          <p className="text-xs text-muted-foreground">No off-server copy is configured, so these files exist on this server only.</p>
        )}
        {checksum && (
          <div className="flex items-start gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p>{checksum.file} saved.</p>
              {checksum.sha256 && (
                <p className="break-all font-mono">
                  SHA-256 {checksum.sha256}. Compare it with <code>sha256sum</code> on your copy to be sure it is intact.
                </p>
              )}
            </div>
          </div>
        )}

        {list.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading backups…
          </div>
        ) : list.isError ? (
          <p className="text-sm text-destructive">Could not load the backups.</p>
        ) : backups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No backup exists yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {backups.map((b) => (
              <li key={b.name} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs">{b.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {timeAgo(b.createdAt)} · {size(b.sizeBytes)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {b.onServer && <Badge variant="secondary">Server</Badge>}
                  {b.offServer && <Badge variant="secondary">Off-server</Badge>}
                  <Button size="sm" variant="outline" disabled={!list.data?.twoFactorEnabled} onClick={() => setTarget(b)}>
                    <Download className="mr-1 h-4 w-4" /> Download
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={target !== null} onOpenChange={(open) => !open && !download.isPending && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Download backup</DialogTitle>
            <DialogDescription className="break-all font-mono text-xs">{target?.name}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3 px-6 py-4"
            autoComplete="off"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready && !download.isPending) download.mutate();
            }}
          >
            <p className="text-xs text-muted-foreground">
              This file holds every pharmacy&apos;s data. Keep it on an encrypted disk and delete it when you are done.
            </p>
            <div className="space-y-1">
              <Label htmlFor="bk-reason">Why do you need it? *</Label>
              <Input id="bk-reason" placeholder="e.g. Server disk failed, restoring" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bk-password">Your password *</Label>
              <Input id="bk-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bk-code">Authenticator code *</Label>
              <Input
                id="bk-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code (or a recovery code)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <DialogFooter className="px-0">
              <Button type="button" variant="outline" disabled={download.isPending} onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={!ready || download.isPending}>
                {download.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
                Download
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
