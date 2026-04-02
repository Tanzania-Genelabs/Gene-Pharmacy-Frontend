"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { loyaltyApi } from "@/api/loyalty.api";
import { customerApi } from "@/api/customer.api";
import { toast } from "sonner";
import {
  Search,
  Gift,
  Star,
  TrendingUp,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { LoyaltyTier, RedeemPointsRequest } from "@/types";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

function tierColor(tier: LoyaltyTier): string {
  const map: Record<LoyaltyTier, string> = {
    Bronze: "bg-amber-700 text-white",
    Silver: "bg-gray-400 text-white",
    Gold: "bg-yellow-500 text-white",
    Platinum: "bg-gradient-to-r from-purple-500 to-indigo-600 text-white",
  };
  return map[tier] ?? "bg-gray-400 text-white";
}

export default function LoyaltyPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const qc = useQueryClient();
  const [phoneSearch, setPhoneSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showRedeem, setShowRedeem] = useState(false);
  const [redeemForm, setRedeemForm] = useState<RedeemPointsRequest>({ points: 0, description: "" });

  // Step 1: Look up customer by phone, then fetch loyalty
  const { data: customer, isFetching: searchingCustomer } = useQuery({
    queryKey: ["customers", "phone", pharmacyId, phoneSearch],
    queryFn: () => customerApi.lookupByPhone(pharmacyId, phoneSearch),
    enabled: phoneSearch.length >= 9,
    retry: false,
  });

  const activeCustomerId = selectedCustomerId ?? customer?.id;

  const { data: account } = useQuery({
    queryKey: ["loyalty", "account", pharmacyId, activeCustomerId],
    queryFn: () => loyaltyApi.getAccount(pharmacyId, activeCustomerId!),
    enabled: !!activeCustomerId,
  });

  const { data: transactions } = useQuery({
    queryKey: ["loyalty", "transactions", pharmacyId, activeCustomerId],
    queryFn: () => loyaltyApi.getTransactions(pharmacyId, activeCustomerId!, { size: 20 }),
    enabled: !!activeCustomerId,
  });

  const redeemMutation = useMutation({
    mutationFn: (data: RedeemPointsRequest) =>
      loyaltyApi.redeem(pharmacyId, activeCustomerId!, data),
    onSuccess: () => {
      toast.success("Points redeemed successfully!");
      qc.invalidateQueries({ queryKey: ["loyalty", "account", pharmacyId, activeCustomerId] });
      qc.invalidateQueries({ queryKey: ["loyalty", "transactions", pharmacyId, activeCustomerId] });
      setShowRedeem(false);
      setRedeemForm({ points: 0, description: "" });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to redeem points");
    },
  });

  function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    if (redeemForm.points <= 0) {
      toast.error("Enter points to redeem");
      return;
    }
    redeemMutation.mutate(redeemForm);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Loyalty Program</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Earn 1 point per TZS 1,000 spent • Redeem 1 point = TZS 100 discount
        </p>
      </div>

      {/* Customer lookup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Find Customer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Enter customer phone number…"
              value={phoneSearch}
              onChange={(e) => { setPhoneSearch(e.target.value); setSelectedCustomerId(null); }} />
          </div>
          {searchingCustomer && <p className="text-sm text-muted-foreground mt-2">Searching…</p>}
          {customer && (
            <p className="text-sm mt-2 text-foreground">
              Found: <span className="font-semibold">{customer.name}</span>
              <Button variant="link" size="sm" className="ml-2"
                onClick={() => setSelectedCustomerId(customer.id)}>
                View Loyalty →
              </Button>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Loyalty Account Card */}
      {account && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-yellow-50 dark:bg-yellow-950/30">
                <Award className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tier</p>
                <Badge className={tierColor(account.tier)}>{account.tier}</Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                <Star className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Balance</p>
                <p className="text-xl font-bold">{account.pointsBalance.toLocaleString()} pts</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-50 dark:bg-green-950/30">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Lifetime Earned</p>
                <p className="text-xl font-bold">{account.lifetimePointsEarned.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-2 p-5">
              <p className="text-sm text-muted-foreground">
                {account.pointsToNextTier > 0
                  ? `${account.pointsToNextTier.toLocaleString()} pts to next tier`
                  : "🏆 Max tier reached!"}
              </p>
              <Button size="sm" onClick={() => setShowRedeem(true)}
                disabled={account.pointsBalance <= 0}>
                <Gift className="h-4 w-4 mr-2" />
                Redeem Points
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Redeem Dialog */}
      <Dialog open={showRedeem} onOpenChange={setShowRedeem}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Redeem Points</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRedeem} className="space-y-4 px-6 py-4">
            <p className="text-sm text-muted-foreground">
              Available: <span className="font-semibold">{account?.pointsBalance.toLocaleString() ?? 0}</span> points
              (= TZS {((account?.pointsBalance ?? 0) * 100).toLocaleString()} discount)
            </p>
            <div className="space-y-1">
              <Label htmlFor="r-pts">Points to Redeem *</Label>
              <Input id="r-pts" type="number" min={1} max={account?.pointsBalance}
                value={redeemForm.points}
                onChange={(e) => setRedeemForm((f) => ({ ...f, points: Number(e.target.value) }))} />
              <p className="text-xs text-muted-foreground">
                = TZS {(redeemForm.points * 100).toLocaleString()} discount
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="r-desc">Reason</Label>
              <Input id="r-desc" placeholder="e.g. Sale #RCP-001"
                value={redeemForm.description ?? ""}
                onChange={(e) => setRedeemForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={redeemMutation.isPending}>
                {redeemMutation.isPending ? "Redeeming…" : "Redeem"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Transaction History */}
      {account && transactions && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="text-right">Balance After</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.content.length > 0 ? transactions.content.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{new Date(t.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={t.type === "Earn" || t.type === "Bonus" ? "secondary" : "outline"}>
                        {t.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{t.description}</TableCell>
                    <TableCell className={`text-right font-semibold ${t.points >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {t.points >= 0 ? "+" : ""}{t.points}
                    </TableCell>
                    <TableCell className="text-right">{t.balanceAfter}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                      No transactions yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
