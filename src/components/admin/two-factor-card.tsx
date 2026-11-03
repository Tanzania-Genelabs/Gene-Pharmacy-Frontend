"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { authApi } from "@/api/auth.api";
import { apiErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/** Turn two-factor sign-in on or off for your own admin account. */
export function TwoFactorCard() {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["admin", "2fa"], queryFn: () => authApi.twoFactorStatus() });
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [password, setPassword] = useState("");
  const [disabling, setDisabling] = useState(false);

  useEffect(() => {
    if (!setup) return;
    void QRCode.toDataURL(setup.otpauthUrl, { margin: 1, width: 192 }).then(setQr);
  }, [setup]);

  const begin = useMutation({
    mutationFn: () => authApi.twoFactorSetup(),
    onSuccess: setSetup,
    onError: (e) => toast.error(apiErrorMessage(e, "Could not start the setup")),
  });
  const enable = useMutation({
    mutationFn: () => authApi.twoFactorEnable(code.trim()),
    onSuccess: (r) => {
      setRecovery(r.recoveryCodes);
      setSetup(null);
      setCode("");
      void qc.invalidateQueries({ queryKey: ["admin", "2fa"] });
      void qc.invalidateQueries({ queryKey: ["admin", "system-status"] });
      toast.success("Two-factor sign-in is on");
    },
    onError: (e) => toast.error(apiErrorMessage(e, "That code is not right")),
  });
  const disable = useMutation({
    mutationFn: () => authApi.twoFactorDisable(password, code.trim()),
    onSuccess: () => {
      setDisabling(false);
      setPassword("");
      setCode("");
      void qc.invalidateQueries({ queryKey: ["admin", "2fa"] });
      toast.success("Two-factor sign-in is off");
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not turn it off")),
  });

  const enabled = status.data?.enabled ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {enabled ? <ShieldCheck className="h-5 w-5 text-green-600" /> : <ShieldAlert className="h-5 w-5 text-amber-500" />}
          Two-factor sign-in
        </CardTitle>
        <CardDescription>
          An admin account can reach every pharmacy. With two-factor on, the password alone is not enough: sign-in also needs a code from your phone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

        {recovery && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold">Save these recovery codes now. They are shown only once.</p>
            <p className="mb-2 text-xs text-muted-foreground">Each works one time if you lose your phone. Keep them somewhere safe, not on the same phone.</p>
            <div className="grid grid-cols-2 gap-1 font-mono text-sm">
              {recovery.map((c) => <span key={c}>{c}</span>)}
            </div>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setRecovery(null)}>I saved them</Button>
          </div>
        )}

        {status.data && !enabled && !setup && (
          <Button onClick={() => begin.mutate()} disabled={begin.isPending}>
            {begin.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Turn on two-factor
          </Button>
        )}

        {setup && (
          <div className="space-y-3">
            <p className="text-sm">1. Scan this with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy...).</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- a generated data: URL, nothing to optimise */}
            {qr && <img src={qr} alt="Authenticator QR code" className="h-48 w-48 rounded border bg-white p-1" />}
            <p className="text-xs text-muted-foreground">Cannot scan? Enter this key by hand: <span className="select-all font-mono">{setup.secret}</span></p>
            <p className="text-sm">2. Type the 6-digit code the app shows.</p>
            <div className="flex max-w-xs gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" inputMode="numeric" autoComplete="one-time-code" />
              <Button onClick={() => enable.mutate()} disabled={enable.isPending || code.trim().length < 6}>
                {enable.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Confirm
              </Button>
            </div>
          </div>
        )}

        {enabled && !disabling && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium text-green-700 dark:text-green-400">On</span>
            <span className="text-muted-foreground">{status.data?.recoveryCodesLeft} recovery codes left</span>
            <Button size="sm" variant="outline" onClick={() => setDisabling(true)}>Turn off</Button>
          </div>
        )}

        {enabled && disabling && (
          <div className="max-w-sm space-y-2">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" />
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code or recovery code" autoComplete="one-time-code" />
            <div className="flex gap-2">
              <Button variant="destructive" onClick={() => disable.mutate()} disabled={disable.isPending || !password || !code.trim()}>
                {disable.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Turn off two-factor
              </Button>
              <Button variant="outline" onClick={() => { setDisabling(false); setCode(""); setPassword(""); }}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
