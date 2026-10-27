"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { expiryApi } from "@/api/expiry.api";
import { inventoryApi } from "@/api/inventory.api";
import { drugApi } from "@/api/drug.api";
import { branchApi } from "@/api/branch.api";
import { apiErrorMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  Clock,
  TrendingDown,
  Package,
  ShieldAlert,
  Plus,
  Loader2,
} from "lucide-react";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

export default function ExpiryPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [showAdd, setShowAdd] = useState(false);

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["expiry", "dashboard", pharmacyId],
    queryFn: () => expiryApi.dashboard(pharmacyId),
  });

  const { data: nearExpiry } = useQuery({
    queryKey: ["expiry", "near-expiry", pharmacyId],
    queryFn: () => expiryApi.nearExpiry(pharmacyId, { days: 90 }),
  });

  const { data: batches } = useQuery({
    queryKey: ["expiry", "batches", pharmacyId],
    queryFn: () => expiryApi.listBatches(pharmacyId, { size: 100 }),
    enabled: tab === "batches",
  });

  const { data: reorders } = useQuery({
    queryKey: ["expiry", "reorders", pharmacyId],
    queryFn: () => expiryApi.reorderRecommendations(pharmacyId),
  });

  const stats = [
    {
      title: "Expired",
      value: dashboard?.expiredCount ?? 0,
      icon: ShieldAlert,
      color: "text-red-600",
      bg: "bg-red-50 dark:bg-red-950/30",
    },
    {
      title: "Expiring in 7 days",
      value: dashboard?.expiringIn7Days ?? 0,
      icon: AlertTriangle,
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-950/30",
    },
    {
      title: "Expiring in 30 days",
      value: dashboard?.expiringIn30Days ?? 0,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950/30",
    },
    {
      title: "At-Risk Value",
      value: dashboard?.totalAtRiskValue != null
        ? `TZS ${dashboard.totalAtRiskValue.toLocaleString()}`
        : "—",
      icon: TrendingDown,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950/30",
    },
  ];

  function urgencyBadge(urgency: string) {
    const map: Record<string, string> = {
      Critical: "destructive",
      High: "destructive",
      Medium: "secondary",
      Low: "outline",
    };
    return <Badge variant={map[urgency] as "destructive" | "secondary" | "outline" ?? "secondary"}>{urgency}</Badge>;
  }

  function expiryBadge(days: number) {
    if (days <= 0) return <Badge variant="destructive">Expired</Badge>;
    if (days <= 7) return <Badge variant="destructive">{days}d left</Badge>;
    if (days <= 30) return <Badge className="bg-orange-500 text-white">{days}d left</Badge>;
    return <Badge variant="secondary">{days}d left</Badge>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Expiry & Stock Health</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Monitor expiring drugs and get smart reorder suggestions
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add batch
        </Button>
      </div>

      <AddBatchDialog
        pharmacyId={pharmacyId}
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["expiry"] });
          qc.invalidateQueries({ queryKey: ["inventory", pharmacyId] });
        }}
      />

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.title}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${s.bg}`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{s.title}</p>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Near-Expiry Items</TabsTrigger>
          <TabsTrigger value="batches">All Batches</TabsTrigger>
          <TabsTrigger value="reorders">Reorder Suggestions</TabsTrigger>
        </TabsList>

        {/* Near-expiry items */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Items Approaching Expiry
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drug</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Qty Left</TableHead>
                    <TableHead className="text-right">Original Price</TableHead>
                    <TableHead className="text-right">Markdown Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nearExpiry && nearExpiry.length > 0 ? (
                    nearExpiry.map((item, i) => (
                      <TableRow key={`${item.drugId}-${item.batchNumber}-${i}`}>
                        <TableCell className="font-medium">{item.drugName}</TableCell>
                        <TableCell>{item.branchName}</TableCell>
                        <TableCell className="font-mono text-xs">{item.batchNumber}</TableCell>
                        <TableCell>{item.expiryDate}</TableCell>
                        <TableCell>{expiryBadge(item.daysUntilExpiry)}</TableCell>
                        <TableCell className="text-right">{item.remainingQuantity}</TableCell>
                        <TableCell className="text-right">TZS {item.originalPrice.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          TZS {item.suggestedMarkdownPrice.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        {isLoading ? "Loading…" : "No near-expiry items. Your stock is healthy! 🎉"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Every batch that has been entered */}
        <TabsContent value="batches">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-500" />
                Batches with an expiry date
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drug</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead className="text-right">Qty Received</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches && batches.content.length > 0 ? (
                    batches.content.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.drugName}</TableCell>
                        <TableCell>{b.branchName}</TableCell>
                        <TableCell className="font-mono text-xs">{b.batchNumber}</TableCell>
                        <TableCell>{b.expiryDate}</TableCell>
                        <TableCell className="text-right">{b.initialQuantity}</TableCell>
                        <TableCell>
                          <Badge variant={b.status === "Active" ? "secondary" : "outline"}>{b.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {batches ? "No batches yet. Use Add batch, or add an expiry date when you adjust stock or receive an order." : "Loading…"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reorder recommendations */}
        <TabsContent value="reorders">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-500" />
                Smart Reorder Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drug</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Avg Daily Usage</TableHead>
                    <TableHead className="text-right">Days Left</TableHead>
                    <TableHead className="text-right">Order Qty</TableHead>
                    <TableHead>Urgency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reorders && reorders.length > 0 ? (
                    reorders.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.drugName}</TableCell>
                        <TableCell>{r.branchName}</TableCell>
                        <TableCell className="text-right">{r.currentStock}</TableCell>
                        <TableCell className="text-right">{r.avgDailyUsage.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{r.daysOfStockRemaining}</TableCell>
                        <TableCell className="text-right font-semibold">{r.suggestedQuantity}</TableCell>
                        <TableCell>{urgencyBadge(r.urgency)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No reorder recommendations at this time.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

/**
 * Gives units an expiry date. For stock already counted, only the batch is recorded; for units that have
 * just arrived, "also add to stock" records both together so the quantity and the batch always agree.
 */
function AddBatchDialog({
  pharmacyId,
  open,
  onClose,
  onSaved,
}: {
  pharmacyId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [drugId, setDrugId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [addToStock, setAddToStock] = useState(false);

  const { data: drugs } = useQuery({
    queryKey: ["drugs", pharmacyId, "all"],
    queryFn: () => drugApi.list(pharmacyId, { size: 500 }),
    enabled: open,
  });
  const { data: branches } = useQuery({
    queryKey: ["branches", pharmacyId],
    queryFn: () => branchApi.list(pharmacyId),
    enabled: open,
  });

  const save = useMutation({
    mutationFn: async () => {
      const units = Number(quantity);
      if (addToStock) {
        await inventoryApi.adjust(pharmacyId, { drugId, branchId, movementType: "Adjustment", adjustmentQuantity: units, expiryDate, batchNumber, notes: "Added with expiry date" });
      } else {
        await expiryApi.registerBatch(pharmacyId, { drugId, branchId, batchNumber: batchNumber.trim() || undefined, expiryDate, initialQuantity: units });
      }
    },
    onSuccess: () => {
      toast.success(addToStock ? "Stock and batch added" : "Batch added");
      onSaved();
      setDrugId("");
      setBatchNumber("");
      setExpiryDate("");
      setQuantity("");
      setAddToStock(false);
      onClose();
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Could not add the batch")),
  });

  const units = Number(quantity);
  const valid = !!drugId && !!branchId && !!expiryDate && Number.isInteger(units) && units > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add batch with expiry date</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 px-6 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) save.mutate();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="ab-drug">Drug *</Label>
            <select id="ab-drug" className={selectClass} value={drugId} onChange={(e) => setDrugId(e.target.value)}>
              <option value="">Select drug…</option>
              {drugs?.content?.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ab-branch">Branch *</Label>
            <select id="ab-branch" className={selectClass} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Select branch…</option>
              {branches?.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ab-expiry">Expiry date *</Label>
              <Input id="ab-expiry" type="date" min={new Date().toISOString().split("T")[0]} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ab-qty">Units with this date *</Label>
              <Input id="ab-qty" type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ab-batch">Batch number</Label>
            <Input id="ab-batch" placeholder="Optional, generated if empty" maxLength={100} value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} />
          </div>
          <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
            <input type="checkbox" className="mt-1" checked={addToStock} onChange={(e) => setAddToStock(e.target.checked)} />
            <span>
              <span className="font-medium">These units are new, add them to stock too</span>
              <span className="block text-xs text-muted-foreground">
                Leave this off for stock you already have counted. Only the expiry date is recorded, and the stock quantity stays the same.
              </span>
            </span>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!valid || save.isPending}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add batch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
