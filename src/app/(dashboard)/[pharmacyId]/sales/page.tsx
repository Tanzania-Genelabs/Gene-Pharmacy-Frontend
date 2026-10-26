"use client";

import { use, useState, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { salesApi } from "@/api/sales.api";
import { drugApi, drugCategoryApi } from "@/api/drug.api";
import { branchApi } from "@/api/branch.api";
import { useAuthStore } from "@/store/auth.store";
import { toast } from "sonner";
import {
  ShoppingCart, Search, Plus, Minus, Trash2, X, Receipt,
  Printer, History, Monitor, MoreHorizontal, Pill, Package, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatQuantity, hasPacks, packInfo, packLabel, type PackInfo } from "@/lib/packs";
import type { DrugResponse, SaleResponse, SaleSummaryResponse, SaleStatus, SalePaymentMethod, CreateSaleRequest } from "@/types";

interface PageProps { params: Promise<{ pharmacyId: string }> }

interface CartItem {
  drugId: string; drugName: string;
  unitPrice: number; quantity: number; discountPct: number;
  /** Quantity and unitPrice are per single unit (e.g. tablet); info lets the till also sell whole packs. */
  info: PackInfo;
}

const PAYMENT_METHODS: SalePaymentMethod[] = ["Cash", "Card", "MobileMoney", "Insurance", "Credit"];
const STATUS_VARIANT: Record<SaleStatus, "default" | "secondary" | "destructive" | "outline"> = {
  Completed: "default", Voided: "destructive", Pending: "secondary",
};

function fmt(n: number) { return n.toLocaleString("en-TZ"); }
function fmtDate(s: string) {
  return new Date(s).toLocaleString("en-TZ", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function ReceiptContent({ sale, drugNames }: { sale: SaleResponse; drugNames?: Record<string, string> }) {
  return (
    <div className="font-mono text-xs leading-relaxed">
      <div className="text-center mb-3">
        <p className="font-bold text-sm">GENE PHARMACY</p>
        <p className="text-muted-foreground">Official Receipt</p>
      </div>
      <div className="border-t border-dashed border-border my-2" />
      <div className="space-y-0.5 text-xs mb-2">
        {[
          ["Receipt #", sale.receiptNumber],
          ["Date", fmtDate(sale.saleDate)],
          ["Payment", sale.paymentMethod],
          ...(sale.notes ? [["Note", sale.notes]] : []),
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <span className="text-muted-foreground">{k}:</span>
            <span className="font-medium text-right">{v}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-dashed border-border my-2" />
      <table className="w-full text-xs mb-2">
        <thead>
          <tr className="border-b border-dashed border-border">
            <th className="text-left pb-1 font-medium">Item</th>
            <th className="text-center pb-1 font-medium">Qty</th>
            <th className="text-right pb-1 font-medium">Price</th>
            <th className="text-right pb-1 font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item, i) => (
            <tr key={i}>
              <td className="py-0.5 pr-1">{drugNames?.[item.drugId] ?? item.drugId.slice(0, 8) + "…"}</td>
              <td className="text-center py-0.5">{item.quantity}</td>
              <td className="text-right py-0.5">{fmt(item.unitPrice)}</td>
              <td className="text-right py-0.5 font-medium">{fmt(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-dashed border-border my-2" />
      <div className="space-y-0.5 text-xs mb-3">
        <div className="flex justify-between"><span>Subtotal:</span><span>TZS {fmt(sale.totalAmount)}</span></div>
        {sale.discountAmount > 0 && (
          <div className="flex justify-between text-destructive">
            <span>Discount:</span><span>− TZS {fmt(sale.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-sm border-t border-dashed border-border pt-1">
          <span>NET TOTAL:</span><span>TZS {fmt(sale.netAmount)}</span>
        </div>
        {sale.amountPaid > 0 && (
          <>
            <div className="flex justify-between"><span>Tendered:</span><span>TZS {fmt(sale.amountPaid)}</span></div>
            {sale.changeAmount > 0 && (
              <div className="flex justify-between font-semibold text-emerald-600">
                <span>Change:</span><span>TZS {fmt(sale.changeAmount)}</span>
              </div>
            )}
          </>
        )}
      </div>
      <div className="border-t border-dashed border-border my-2" />
      <p className="text-center text-muted-foreground text-[11px] mt-1">
        Thank you for your purchase!<br />Keep this receipt for your records.
      </p>
    </div>
  );
}

export default function SalesPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const qc = useQueryClient();
  const receiptRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);

  // Sellers are bound to a single branch at account creation — no choice needed.
  const isSeller = user?.role === "Seller";

  const [tab, setTab] = useState<"pos" | "history">("pos");
  const [branchId, setBranchId] = useState(user?.branchId ?? "");
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>("Cash");
  const [notes, setNotes] = useState("");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedCatId, setSelectedCatId] = useState("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [receiptSale, setReceiptSale] = useState<SaleResponse | null>(null);
  const [receiptDrugNames, setReceiptDrugNames] = useState<Record<string, string>>({});
  const [histPage, setHistPage] = useState(0);
  const [voidTarget, setVoidTarget] = useState<SaleSummaryResponse | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [detailSale, setDetailSale] = useState<SaleResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const { data: branches } = useQuery({ queryKey: ["branches", pharmacyId], queryFn: () => branchApi.list(pharmacyId) });
  const { data: categories } = useQuery({ queryKey: ["drug-categories", pharmacyId], queryFn: () => drugCategoryApi.list(pharmacyId) });
  const { data: drugsPage, isLoading: drugsLoading } = useQuery({
    queryKey: ["drugs", pharmacyId, 0, search],
    queryFn: () => drugApi.list(pharmacyId, { page: 0, size: 200, search: search || undefined }),
    placeholderData: (prev) => prev,
  });
  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: ["sales", pharmacyId, histPage],
    queryFn: () => salesApi.list(pharmacyId, { page: histPage, size: 20 }),
    placeholderData: (prev) => prev,
    enabled: tab === "history",
  });

  const drugs = useMemo(() => {
    const all = drugsPage?.content.filter((d) => d.active) ?? [];
    return selectedCatId === "all" ? all : all.filter((d) => d.categoryId === selectedCatId);
  }, [drugsPage, selectedCatId]);

  const { subtotal, totalDiscount, netTotal } = useMemo(() => {
    const sub = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const disc = cart.reduce((s, i) => s + Math.round((i.unitPrice * i.quantity * i.discountPct) / 100), 0);
    return { subtotal: sub, totalDiscount: disc, netTotal: sub - disc };
  }, [cart]);

  /** `units` is in single units; pass the pack size to add a whole pack. */
  const addToCart = useCallback((drug: DrugResponse, units = 1) => {
    if (!branchId) { toast.error("Select a branch first"); return; }
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.drugId === drug.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = { ...n[idx], quantity: n[idx].quantity + units }; return n; }
      return [...prev, { drugId: drug.id, drugName: drug.name, unitPrice: drug.sellingPrice, quantity: units, discountPct: 0, info: packInfo(drug) }];
    });
  }, [branchId]);

  function updateQty(drugId: string, qty: number) {
    if (qty <= 0) { setCart((p) => p.filter((i) => i.drugId !== drugId)); return; }
    setCart((p) => p.map((i) => i.drugId === drugId ? { ...i, quantity: qty } : i));
  }
  function updateDiscountPct(drugId: string, pct: number) {
    setCart((p) => p.map((i) => i.drugId === drugId ? { ...i, discountPct: Math.min(100, Math.max(0, pct)) } : i));
  }

  const completeSaleMutation = useMutation({
    mutationFn: (data: CreateSaleRequest) => salesApi.create(pharmacyId, data),
    onSuccess: (sale) => {
      toast.success(`Sale ${sale.receiptNumber} completed!`);
      // Build drug name map from cart for receipt display
      const names: Record<string, string> = {};
      cart.forEach((i) => { names[i.drugId] = i.drugName; });
      setReceiptDrugNames(names);
      setReceiptSale(sale);
      setCart([]); setNotes(""); setAmountPaid("");
      qc.invalidateQueries({ queryKey: ["sales", pharmacyId] });
    },
    onError: (err: unknown) => {
      // Surface backend error message (e.g. INSUFFICIENT_STOCK, STOCK_NOT_FOUND)
      const axiosErr = err as { response?: { data?: { message?: string; errorCode?: string } } };
      const msg = axiosErr?.response?.data?.message ?? "Failed to complete sale";
      toast.error(msg);
    },
  });

  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => salesApi.void(pharmacyId, id, { reason }),
    onSuccess: () => {
      toast.success("Sale voided"); setVoidTarget(null); setVoidReason("");
      qc.invalidateQueries({ queryKey: ["sales", pharmacyId] });
    },
    onError: () => toast.error("Failed to void sale"),
  });

  async function viewDetail(saleId: string) {
    setDetailLoading(true);
    try { setDetailSale(await salesApi.getById(pharmacyId, saleId)); }
    catch { toast.error("Failed to load sale details"); }
    finally { setDetailLoading(false); }
  }

  function generateReceiptNumber(): string {
    const now = new Date();
    const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
    const hms = now.toTimeString().slice(0, 8).replace(/:/g, "");
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `RCP-${ymd}-${hms}-${rand}`;
  }

  function handleCompleteSale() {
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    if (!branchId) { toast.error("Select a branch first"); return; }
    if (!user?.id) { toast.error("Not authenticated"); return; }
    const paid = parseFloat(amountPaid) || netTotal;
    if (paid < netTotal) { toast.error(`Amount paid (TZS ${fmt(paid)}) is less than total (TZS ${fmt(netTotal)})`); return; }
    completeSaleMutation.mutate({
      branchId,
      soldBy: user.id,
      receiptNumber: generateReceiptNumber(),
      paymentMethod,
      amountPaid: paid,
      notes: notes.trim() || undefined,
      items: cart.map((i) => ({
        drugId: i.drugId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        // Convert percentage discount to fixed monetary amount
        discountAmount: Math.round((i.unitPrice * i.quantity * i.discountPct) / 100),
      })),
    });
  }

  function handlePrint(sale: SaleResponse) {
    const content = receiptRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank", "width=420,height=700");
    if (!win) { toast.error("Allow popups to print"); return; }
    win.document.write(`<html><head><title>Receipt ${sale.receiptNumber}</title>
      <style>body{font-family:"Courier New",monospace;font-size:12px;padding:20px;max-width:320px;margin:0 auto}
      table{width:100%;border-collapse:collapse}th,td{padding:2px 0}.right{text-align:right}.center{text-align:center}</style>
      </head><body>${content}</body></html>`);
    win.document.close(); win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  }

  return (
    <div className="flex flex-col">
      {/* ── Tab Bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 mb-4 border-b border-border">
        {[
          { key: "pos" as const, label: "POS Terminal", icon: Monitor },
          { key: "history" as const, label: "Sales History", icon: History },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {key === "pos" && cart.length > 0 && (
              <span className="ml-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">{cart.length}</span>
            )}
            {key === "history" && history && (
              <span className="text-xs text-muted-foreground ml-1">({history.totalElements})</span>
            )}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          POS TERMINAL
      ════════════════════════════════════════════════════════════════════ */}
      {tab === "pos" && (
        <div className="flex gap-4" style={{ height: "calc(100vh - 185px)" }}>

          {/* ── Left: Drug Catalogue ─────────────────────────────────────── */}
          <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-hidden">
            {/* Branch + Search */}
            <div className="flex flex-col sm:flex-row gap-2">
              {isSeller ? (
                // Seller is locked to their assigned branch — no selector shown
                <div className="h-9 flex items-center gap-2 rounded-md border border-input bg-muted px-3 text-sm sm:w-52 flex-shrink-0">
                  <span className="text-muted-foreground text-xs">Branch:</span>
                  <span className="font-medium truncate">
                    {branches?.find((b) => b.id === branchId)?.name ?? "Your Branch"}
                  </span>
                </div>
              ) : (
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring sm:w-52 flex-shrink-0"
                  value={branchId}
                  onChange={(e) => { setBranchId(e.target.value); setCart([]); }}
                >
                  <option value="">— Select Branch —</option>
                  {branches?.filter((b) => b.status === "Active").map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              )}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input placeholder="Search drugs…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>

            {/* Category chips */}
            <div className="flex gap-2 flex-wrap">
              {[{ id: "all", name: "All" }, ...(categories?.filter((c) => c.active) ?? [])].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    selectedCatId === cat.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-input hover:border-primary hover:text-foreground"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Drug Cards */}
            <div className="flex-1 overflow-y-auto">
              {!branchId && !isSeller && (
                <div className="flex items-center justify-center h-20 text-sm text-muted-foreground bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                  ⬆ Select a branch to start selling
                </div>
              )}
              {drugsLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 mt-2">
                  {Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />)}
                </div>
              ) : drugs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <Package className="h-10 w-10 mb-2 opacity-25" />
                  <p className="text-sm">No drugs found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 mt-2">
                  {drugs.map((drug) => {
                    const inCart = cart.find((i) => i.drugId === drug.id);
                    return (
                      <div
                        key={drug.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => addToCart(drug)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); addToCart(drug); } }}
                        className={`group relative cursor-pointer text-left rounded-xl border p-3 transition-all hover:shadow-md hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary ${
                          hasPacks(packInfo(drug)) ? "pb-9" : ""
                        } ${inCart ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-accent/30"}`}
                      >
                        {inCart && (
                          <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                            {inCart.quantity}
                          </div>
                        )}
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                          <Pill className="h-4 w-4 text-primary" />
                        </div>
                        <p className="font-semibold text-xs leading-tight line-clamp-2 mb-1">{drug.name}</p>
                        {drug.genericName && <p className="text-[10px] text-muted-foreground truncate mb-1">{drug.genericName}</p>}
                        <p className="text-sm font-bold text-primary">TZS {fmt(drug.sellingPrice)}</p>
                        <p className="text-[10px] text-muted-foreground">per {drug.unit}</p>
                        {hasPacks(packInfo(drug)) && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); addToCart(drug, drug.unitsPerPack); }}
                            className="mt-1.5 w-full rounded-md border border-primary/40 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
                          >
                            + 1 {packLabel(packInfo(drug))} ({drug.unitsPerPack}) · TZS {fmt(drug.sellingPrice * drug.unitsPerPack)}
                          </button>
                        )}
                        {drug.requiresPrescription && (
                          <div className="flex items-center gap-1 mt-1">
                            <AlertCircle className="h-3 w-3 text-amber-500" />
                            <span className="text-[10px] text-amber-600 dark:text-amber-400">Rx required</span>
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center h-7 bg-primary/90 text-primary-foreground text-xs font-medium rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus className="h-3 w-3 mr-1" /> Add to Cart
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Cart ───────────────────────────────────────────────── */}
          <div className="w-80 xl:w-96 flex-shrink-0 flex flex-col gap-3 border-l border-border pl-4 overflow-hidden">
            {/* Cart header */}
            <div className="flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <span className="font-semibold">Cart</span>
                {cart.length > 0 && <Badge variant="secondary" className="text-xs">{cart.length}</Badge>}
              </div>
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-7 px-2 text-xs" onClick={() => setCart([])}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
                </Button>
              )}
            </div>

            {/* Notes + Payment */}
            <div className="grid grid-cols-2 gap-2 flex-shrink-0">
              <div className="space-y-1">
                <Label className="text-xs">Notes (optional)</Label>
                <Input placeholder="e.g. patient name" className="h-8 text-xs" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Payment Method</Label>
                <select
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as SalePaymentMethod)}
                >
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border-2 border-dashed rounded-xl">
                  <ShoppingCart className="h-8 w-8 mb-1 opacity-25" />
                  <p className="text-xs">Cart is empty</p>
                  <p className="text-[11px] opacity-60">Click a drug card to add</p>
                </div>
              ) : (
                cart.map((item) => {
                  const lineTotal = Math.round(item.unitPrice * item.quantity * (1 - item.discountPct / 100));
                  return (
                    <div key={item.drugId} className="rounded-lg border border-border bg-card p-2.5 space-y-2">
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1">
                          <p className="text-xs font-semibold leading-tight">{item.drugName}</p>
                          {hasPacks(item.info) && (
                            <p className="text-[10px] text-muted-foreground">{formatQuantity(item.quantity, item.info)}</p>
                          )}
                        </div>
                        <button onClick={() => setCart((p) => p.filter((i) => i.drugId !== item.drugId))} className="text-muted-foreground hover:text-destructive transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Qty stepper */}
                        <div className="flex items-center border border-input rounded-md overflow-hidden">
                          <button className="px-1.5 py-0.5 hover:bg-accent transition-colors" onClick={() => updateQty(item.drugId, item.quantity - 1)}>
                            <Minus className="h-3 w-3" />
                          </button>
                          <input
                            type="number" min={1}
                            className="w-10 text-center text-xs bg-transparent border-x border-input py-0.5 focus:outline-none"
                            value={item.quantity}
                            onChange={(e) => updateQty(item.drugId, Number(e.target.value))}
                          />
                          <button className="px-1.5 py-0.5 hover:bg-accent transition-colors" onClick={() => updateQty(item.drugId, item.quantity + 1)}>
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        {hasPacks(item.info) && (
                          <button
                            className="rounded-md border border-input px-1.5 py-0.5 text-[10px] hover:bg-accent transition-colors whitespace-nowrap"
                            onClick={() => updateQty(item.drugId, item.quantity + item.info.unitsPerPack)}
                          >
                            +{packLabel(item.info)}
                          </button>
                        )}
                        {/* Discount */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">Disc%</span>
                          <input
                            type="number" min={0} max={100}
                            className="w-12 h-6 border border-input rounded text-xs text-center bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
                            value={item.discountPct}
                            onChange={(e) => updateDiscountPct(item.drugId, Number(e.target.value))}
                          />
                        </div>
                        <p className="text-xs font-bold text-primary ml-auto whitespace-nowrap">TZS {fmt(lineTotal)}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {fmt(item.unitPrice)} × {item.quantity} {item.info.unit}{item.discountPct > 0 ? ` − ${item.discountPct}% disc` : ""}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Totals + Complete */}
            <div className="border-t border-border pt-3 space-y-2 flex-shrink-0">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span><span>TZS {fmt(subtotal)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>Discount</span><span>− TZS {fmt(totalDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t border-border pt-1">
                  <span>TOTAL</span>
                  <span className="text-primary">TZS {fmt(netTotal)}</span>
                </div>
              </div>
              {/* Amount paid + change */}
              <div className="space-y-1">
                <Label className="text-xs">Amount Paid (TZS)</Label>
                <Input
                  type="number" min={netTotal} placeholder={fmt(netTotal)}
                  className="h-8 text-sm font-medium"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                />
                {amountPaid && parseFloat(amountPaid) >= netTotal && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    Change: TZS {fmt(parseFloat(amountPaid) - netTotal)}
                  </p>
                )}
                {amountPaid && parseFloat(amountPaid) < netTotal && (
                  <p className="text-xs text-destructive">
                    Shortfall: TZS {fmt(netTotal - parseFloat(amountPaid))}
                  </p>
                )}
              </div>
              <Button
                className="w-full" size="lg"
                onClick={handleCompleteSale}
                disabled={completeSaleMutation.isPending || !branchId || cart.length === 0}
              >
                {completeSaleMutation.isPending ? "Processing…" : (
                  <><Receipt className="h-4 w-4 mr-2" />Complete Sale · TZS {fmt(netTotal)}</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SALES HISTORY
      ════════════════════════════════════════════════════════════════════ */}
      {tab === "history" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{history?.totalElements ?? 0} total transactions</p>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt #</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {histLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}><div className="h-4 w-full bg-muted animate-pulse rounded" /></TableCell>
                      ))}</TableRow>
                    ))
                  ) : !history?.content.length ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                        <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-25" />
                        <p>No sales recorded yet</p>
                      </TableCell>
                    </TableRow>
                  ) : history.content.map((sale) => (
                    <TableRow key={sale.id} className="hover:bg-accent/40">
                      <TableCell className="font-mono text-xs">{sale.receiptNumber}</TableCell>
                      <TableCell className="text-sm font-mono text-xs text-muted-foreground">{sale.branchId.slice(0, 8)}…</TableCell>
                      <TableCell className="tabular-nums text-sm">{sale.totalItems}</TableCell>
                      <TableCell className="tabular-nums font-medium text-sm">TZS {fmt(sale.netAmount)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{sale.paymentMethod}</Badge></TableCell>
                      <TableCell><Badge variant={STATUS_VARIANT[sale.status] ?? "secondary"} className="text-xs">{sale.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(sale.saleDate)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => viewDetail(sale.id)}>
                              <Receipt className="h-4 w-4 mr-2" />View Receipt
                            </DropdownMenuItem>
                            {sale.status === "Completed" && !isSeller && (
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { setVoidTarget(sale); setVoidReason(""); }}>
                                Void Sale
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {history && history.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Page {histPage + 1} of {history.totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={history.first} onClick={() => setHistPage((p) => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={history.last} onClick={() => setHistPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Receipt Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!receiptSale || !!detailSale} onOpenChange={(o) => !o && (setReceiptSale(null), setDetailSale(null))}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              {receiptSale ? "Sale Complete" : "Sale Receipt"}
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 py-2">
            {detailLoading ? (
              <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-4 bg-muted animate-pulse rounded" />)}</div>
            ) : (receiptSale ?? detailSale) ? (
              <div ref={receiptRef}>
                <ReceiptContent sale={(receiptSale ?? detailSale)!} drugNames={receiptSale ? receiptDrugNames : undefined} />
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setReceiptSale(null); setDetailSale(null); }}>Close</Button>
            {(receiptSale ?? detailSale) && (
              <Button onClick={() => handlePrint((receiptSale ?? detailSale)!)}>
                <Printer className="h-4 w-4 mr-2" />Print Receipt
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Void Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={!!voidTarget} onOpenChange={(o) => !o && setVoidTarget(null)}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader><DialogTitle className="text-destructive">Void Sale</DialogTitle></DialogHeader>
          <div className="px-6 py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              Void receipt <span className="font-mono font-semibold text-foreground">{voidTarget?.receiptNumber}</span>? This cannot be undone.
            </p>
            <div className="space-y-1">
              <Label>Reason *</Label>
              <Input placeholder="e.g. Customer returned items" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!voidReason.trim() || voidMutation.isPending}
              onClick={() => { if (voidTarget) voidMutation.mutate({ id: voidTarget.id, reason: voidReason.trim() }); }}>
              {voidMutation.isPending ? "Voiding…" : "Void Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
