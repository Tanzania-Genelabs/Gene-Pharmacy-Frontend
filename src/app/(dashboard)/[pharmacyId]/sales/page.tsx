"use client";

import { use, useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { salesApi } from "@/api/sales.api";
import { drugApi, drugCategoryApi } from "@/api/drug.api";
import { branchApi } from "@/api/branch.api";
import { inventoryApi } from "@/api/inventory.api";
import { insightsApi } from "@/api/insights.api";
import { PeriodPicker } from "@/components/insights/period-picker";
import { money } from "@/components/expenses/format";
import { dayHeading, isValidRange, parseYmd, presetRange, rangeLabel, ymd, type DateRange, type PeriodPreset } from "@/lib/periods";
import { useBusinessToday } from "@/lib/business-day";
import { RequestHelpDialog, type HelpContext } from "@/components/support/request-help-dialog";
import { useAuthStore } from "@/store/auth.store";
import { toast } from "sonner";
import {
  ShoppingCart, Search, Plus, Minus, Trash2, X, Receipt,
  Printer, History, Monitor, MoreHorizontal, Pill, Package, AlertCircle, CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canSplitPack, formatQuantity, hasPacks, packInfo, packLabel, type PackInfo } from "@/lib/packs";
import { cn } from "@/lib/utils";
import { SALE_PAYMENT_PROVIDERS, salePaymentProviderLabel } from "@/types";
import type { SalePaymentProvider, DrugResponse, SaleResponse, SaleSummaryResponse, SaleStatus, SalePaymentMethod, CreateSaleRequest, SalesDayRow } from "@/types";

interface PageProps { params: Promise<{ pharmacyId: string }> }

interface CartItem {
  drugId: string; drugName: string;
  unitPrice: number; quantity: number; discountPct: number;
  /** Sold by the half dose: quantity counts halves and unitPrice is the half-dose price. */
  halfDose: boolean;
  /** A service (injection, dressing): never counted as stock. manualPrice: the seller types the price here. */
  isService: boolean; manualPrice: boolean;
  /** Quantity and unitPrice are per single unit (e.g. tablet); info lets the till also sell whole packs. */
  info: PackInfo;
}

const PAYMENT_METHODS: SalePaymentMethod[] = ["Cash", "Card", "MobileMoney", "Insurance", "Credit"];
const STATUS_VARIANT: Record<SaleStatus, "default" | "secondary" | "destructive" | "outline"> = {
  Completed: "default", Voided: "destructive", Pending: "secondary",
};

/** A drug can be in the cart twice: whole units and half doses. */
const cartKey = (drugId: string, halfDose: boolean) => `${drugId}:${halfDose ? "half" : "whole"}`;
/** How much stock a cart line takes, in whole units. */
const stockUnitsOf = (i: Pick<CartItem, "quantity" | "halfDose">) => (i.halfDose ? i.quantity / 2 : i.quantity);

function fmt(n: number) { return n.toLocaleString("en-TZ"); }

const HISTORY_PRESETS: PeriodPreset[] = ["today", "yesterday", "7d", "month", "custom"];

/** Stock counts can be halves (5.5 tablets) when a drug is sold by the half dose. */
function fmtUnits(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** How much is left to sell: green when plenty, amber at/under the reorder level, red when none. */
function StockBadge({ left, onShelf, reorderLevel, unit, className }: {
  left: number; onShelf: number; reorderLevel: number; unit: string; className?: string;
}) {
  const none = left <= 0;
  const low = !none && left <= reorderLevel;
  const title = `On the shelf: ${fmtUnits(onShelf)} ${unit}${onShelf === left ? "" : ` · after this cart: ${fmtUnits(Math.max(0, left))}`}`;
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
        none ? "bg-red-600 text-white" : low ? "bg-amber-500 text-white" : "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
        className,
      )}
    >
      {onShelf <= 0 ? "Out" : none ? "0 left" : `${fmtUnits(left)} left`}
    </span>
  );
}
function fmtDate(s: string) {
  return new Date(s).toLocaleString("en-TZ", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** What was sold on a receipt, e.g. "Panadol ×2" ("½" marks half doses); the first few lines, then a count. */
function SaleItemsCell({ sale }: { sale: SaleSummaryResponse }) {
  const items = sale.items ?? [];
  if (items.length === 0) return <span className="text-muted-foreground">{sale.totalItems} item{sale.totalItems === 1 ? "" : "s"}</span>;
  return (
    <div className="space-y-0.5 text-sm">
      {items.slice(0, 3).map((item, i) => (
        <div key={i} className="max-w-[260px] truncate" title={item.drugName ?? "Unknown drug"}>
          {item.drugName ?? "Unknown drug"} <span className="text-muted-foreground">×{item.quantity}{item.isHalfDose ? " (½)" : ""}</span>
        </div>
      ))}
      {items.length > 3 && <div className="text-xs text-muted-foreground">+{items.length - 3} more</div>}
    </div>
  );
}

interface SalesTableProps {
  sales: SaleSummaryResponse[] | undefined;
  loading: boolean;
  emptyText: string;
  isSeller: boolean;
  onView: (saleId: string) => void;
  onVoid: (sale: SaleSummaryResponse) => void;
  /** Gene Pharmacy support only: tick receipts to move them to another business day. */
  selected?: Set<string>;
  onSelect?: (ids: string[], on: boolean) => void;
}

/** The receipts list shared by "Today's Sales" and "Sales History". */
function SalesTable({ sales, loading, emptyText, isSeller, onView, onVoid, selected, onSelect }: SalesTableProps) {
  const selectable = !!onSelect && !!selected;
  const cols = selectable ? 9 : 8;
  const allTicked = selectable && !!sales?.length && sales.every((s) => selected.has(s.id));
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-8">
                  <input type="checkbox" aria-label="Select all receipts" className="h-4 w-4 accent-primary" checked={allTicked}
                    onChange={(e) => onSelect(sales?.map((s) => s.id) ?? [], e.target.checked)} />
                </TableHead>
              )}
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
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: cols }).map((_, j) => (
                  <TableCell key={j}><div className="h-4 w-full bg-muted animate-pulse rounded" /></TableCell>
                ))}</TableRow>
              ))
            ) : !sales?.length ? (
              <TableRow>
                <TableCell colSpan={cols} className="text-center py-16 text-muted-foreground">
                  <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-25" />
                  <p>{emptyText}</p>
                </TableCell>
              </TableRow>
            ) : sales.map((sale) => (
              <TableRow key={sale.id} className={cn("hover:bg-accent/40", sale.status === "Voided" && "opacity-60 [&_td:not(:last-child)]:line-through")}>
                {selectable && (
                  <TableCell>
                    <input type="checkbox" aria-label={`Select receipt ${sale.receiptNumber}`} className="h-4 w-4 accent-primary"
                      checked={selected.has(sale.id)} onChange={(e) => onSelect([sale.id], e.target.checked)} />
                  </TableCell>
                )}
                <TableCell className="font-mono text-xs">{sale.receiptNumber}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{sale.branchName ?? `${sale.branchId.slice(0, 8)}…`}</TableCell>
                <TableCell><SaleItemsCell sale={sale} /></TableCell>
                <TableCell className="tabular-nums font-medium text-sm">TZS {fmt(Number(sale.netAmount))}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{sale.paymentMethod}</Badge>
                  {(sale.paymentProvider || sale.paymentReference) && (
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {sale.paymentProvider ? salePaymentProviderLabel(sale.paymentProvider) : ""}
                      {sale.paymentProvider && sale.paymentReference ? " · " : ""}
                      <span className="font-mono">{sale.paymentReference}</span>
                    </div>
                  )}
                </TableCell>
                <TableCell><Badge variant={STATUS_VARIANT[sale.status] ?? "secondary"} className="text-xs">{sale.status}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {fmtDate(sale.saleDate)}
                  {sale.businessDate && sale.businessDate !== ymd(new Date(sale.saleDate)) && (
                    <div className="text-[11px]">Counted on {parseYmd(sale.businessDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}{sale.businessDateMovedAt ? " (moved by support)" : ""}</div>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onView(sale.id)}>
                        <Receipt className="h-4 w-4 mr-2" />View Receipt
                      </DropdownMenuItem>
                      {sale.status === "Completed" && !isSeller && (
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onVoid(sale)}>
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
  );
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
          ...(sale.paymentProvider ? [["Network", salePaymentProviderLabel(sale.paymentProvider)]] : []),
          ...(sale.paymentReference ? [["Reference", sale.paymentReference]] : []),
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
              <td className="py-0.5 pr-1">{drugNames?.[item.drugId] ?? item.drugId.slice(0, 8) + "…"}{item.isHalfDose ? " (½ dose)" : ""}</td>
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
  // Gene Pharmacy support (inside a support session) can move chosen receipts to another business day.
  const isSupport = user?.role === "SuperAdmin";
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  // Owners and managers ask Gene Pharmacy to correct a day (they may not move sales themselves).
  const canAskHelp = user?.role === "Owner" || user?.role === "Manager";
  const [help, setHelp] = useState<HelpContext | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveDate, setMoveDate] = useState("");
  const [moveReason, setMoveReason] = useState("");
  const pick = useCallback((ids: string[], on: boolean) => setPicked((prev) => {
    const next = new Set(prev);
    for (const id of ids) { if (on) next.add(id); else next.delete(id); }
    return next;
  }), []);

  const [tab, setTab] = useState<"pos" | "today" | "history">("pos");
  // Owners and managers pick a branch once; it is remembered on this device until they change it.
  const branchKey = `gene:sales-branch:${pharmacyId}:${user?.id ?? ""}`;
  const [branchId, setBranchIdState] = useState(user?.branchId ?? "");
  const setBranchId = (id: string) => {
    setBranchIdState(id);
    if (isSeller) return;
    try {
      if (id) localStorage.setItem(branchKey, id);
      else localStorage.removeItem(branchKey);
    } catch {
      /* private mode: the choice just isn't remembered */
    }
  };
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>("Cash");
  const [notes, setNotes] = useState("");
  const [paymentProvider, setPaymentProvider] = useState<SalePaymentProvider | "">("");
  const [paymentReference, setPaymentReference] = useState("");
  // "Find by payment reference" on the history tab: typed text, and the search that is applied.
  const [refInput, setRefInput] = useState("");
  const [refQuery, setRefQuery] = useState("");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedCatId, setSelectedCatId] = useState("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [receiptSale, setReceiptSale] = useState<SaleResponse | null>(null);
  const [receiptDrugNames, setReceiptDrugNames] = useState<Record<string, string>>({});
  // Sales history: a period (Today by default), a branch, and whether to split the list by day.
  const [histPreset, setHistPreset] = useState<PeriodPreset>("today");
  const [histCustom, setHistCustom] = useState<DateRange>(() => ({ from: ymd(new Date()), to: ymd(new Date()) }));
  /** null = follow the branch chosen for selling; "" = all branches. */
  const [histBranch, setHistBranch] = useState<string | null>(null);
  const [histByDay, setHistByDay] = useState(true);
  const [voidTarget, setVoidTarget] = useState<SaleSummaryResponse | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [detailSale, setDetailSale] = useState<SaleResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const { data: branches } = useQuery({ queryKey: ["branches", pharmacyId], queryFn: () => branchApi.list(pharmacyId) });
  // Restore the remembered branch once the list is known - and forget it if that branch was closed or removed.
  useEffect(() => {
    if (isSeller || !branches || branchId) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(branchKey);
    } catch {
      /* ignore */
    }
    const active = branches.filter((b) => b.status === "Active");
    const pick = active.find((b) => b.id === saved) ?? (active.length === 1 ? active[0] : undefined);
    if (pick) setBranchIdState(pick.id);
  }, [branches, isSeller, branchId, branchKey]);

  const { data: categories } = useQuery({ queryKey: ["drug-categories", pharmacyId], queryFn: () => drugCategoryApi.list(pharmacyId) });
  const { data: drugsPage, isLoading: drugsLoading } = useQuery({
    queryKey: ["drugs", pharmacyId, 0, search],
    queryFn: () => drugApi.list(pharmacyId, { page: 0, size: 200, search: search || undefined }),
    placeholderData: (prev) => prev,
  });
  // "Today" is the shop's business day from the server: after midnight a shop still trading stays on its day.
  const businessToday = useBusinessToday(pharmacyId);
  const businessNow = parseYmd(businessToday);
  const histRange = presetRange(histPreset, histCustom, businessNow);
  const histRangeValid = isValidRange(histRange);
  // Sellers only ever see their own branch; the server enforces this too.
  const histBranchId = isSeller ? (user?.branchId ?? "") : (histBranch ?? branchId);
  const histBranchParam = histBranchId || undefined;
  // Day headers and totals: one row per day that had sales, worked out on the server.
  const { data: histDays, isLoading: histDaysLoading, isError: histDaysError } = useQuery({
    queryKey: ["sales", pharmacyId, "days", histRange.from, histRange.to, histBranchParam ?? "all"],
    queryFn: () => insightsApi.salesDays(pharmacyId, { from: histRange.from, to: histRange.to, branchId: histBranchParam }),
    enabled: tab === "history" && histRangeValid,
    placeholderData: (prev) => prev,
  });
  // The receipts themselves, 200 at a time.
  const historyQuery = useInfiniteQuery({
    queryKey: ["sales", pharmacyId, "history", histRange.from, histRange.to, histBranchParam ?? "all", refQuery],
    queryFn: ({ pageParam }) =>
      // A reference search looks through all dates.
      salesApi.list(pharmacyId, refQuery
        ? { page: pageParam, size: 200, branchId: histBranchParam, paymentReference: refQuery }
        : { page: pageParam, size: 200, businessFrom: histRange.from, businessTo: histRange.to, branchId: histBranchParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.last || last.number + 1 >= last.totalPages ? undefined : last.number + 1),
    enabled: tab === "history" && histRangeValid,
  });
  const histSales = useMemo(() => historyQuery.data?.pages.flatMap((p) => p.content) ?? [], [historyQuery.data]);
  const histTotalReceipts = historyQuery.data?.pages[0]?.totalElements ?? 0;
  const histSalesByDay = useMemo(() => {
    const map = new Map<string, SaleSummaryResponse[]>();
    for (const sale of histSales) {
      // Grouped by the day the sale is counted on, the same day the totals above use.
      const key = sale.businessDate ?? ymd(new Date(sale.saleDate));
      const list = map.get(key);
      if (list) list.push(sale);
      else map.set(key, [sale]);
    }
    return map;
  }, [histSales]);
  // Every day from the server's list, plus any day that only shows up in the loaded receipts; newest first.
  const histDayRows = useMemo(() => {
    const rows = new Map<string, SalesDayRow | null>();
    for (const d of histDays?.days ?? []) rows.set(d.date, d);
    for (const key of histSalesByDay.keys()) if (!rows.has(key)) rows.set(key, null);
    return [...rows.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [histDays, histSalesByDay]);
  const histShowProfit = !isSeller && histDays?.totals.profit != null;

  // "Today" is the shop's business day, so sales made after midnight while the shop is still open stay on it.
  const { data: today, isLoading: todayLoading } = useQuery({
    queryKey: ["sales", pharmacyId, "today", businessToday],
    queryFn: () => salesApi.list(pharmacyId, { page: 0, size: 200, businessDate: businessToday }),
    placeholderData: (prev) => prev,
    enabled: tab === "today",
    refetchInterval: 30_000,
  });
  const todayCompleted = (today?.content ?? []).filter((sale) => sale.status === "Completed");
  const todayTotal = todayCompleted.reduce((sum, sale) => sum + Number(sale.netAmount), 0);
  const todayVoided = (today?.content ?? []).filter((sale) => sale.status === "Voided").length;

  const drugs = useMemo(() => {
    const all = drugsPage?.content.filter((d) => d.active) ?? [];
    return selectedCatId === "all" ? all : all.filter((d) => d.categoryId === selectedCatId);
  }, [drugsPage, selectedCatId]);

  const { subtotal, totalDiscount, netTotal } = useMemo(() => {
    const sub = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const disc = cart.reduce((s, i) => s + Math.round((i.unitPrice * i.quantity * i.discountPct) / 100), 0);
    return { subtotal: sub, totalDiscount: disc, netTotal: sub - disc };
  }, [cart]);

  // What is on the shelf at the chosen branch. A drug with no stock record there has none to sell.
  const { data: stockPage, isLoading: stockLoading } = useQuery({
    queryKey: ["inventory", pharmacyId, "branch", branchId, "all"],
    queryFn: () => inventoryApi.list(pharmacyId, { branchId, size: 500 }),
    enabled: !!branchId,
  });
  const stockByDrug = useMemo(() => new Map((stockPage?.content ?? []).map((s) => [s.drugId, s])), [stockPage]);

  /** How many units can be sold, whether it is running low, and whether that is known yet. */
  const stockOf = useCallback((drug: Pick<DrugResponse, "id" | "reorderLevel" | "isService">) => {
    // A service has no stock: it is never out, low or limited.
    if (drug.isService) return { known: false, quantity: Infinity, reorderLevel: 0, out: false, low: false };
    const row = stockByDrug.get(drug.id);
    const quantity = Math.max(0, row?.quantity ?? 0);
    const reorderLevel = row?.reorderLevel ?? drug.reorderLevel ?? 0;
    const known = !!branchId && !stockLoading;
    return { known, quantity, reorderLevel, out: known && quantity <= 0, low: known && quantity > 0 && quantity <= reorderLevel };
  }, [stockByDrug, stockLoading, branchId]);

  /** Stock the drug's cart lines take, optionally leaving out one line. */
  const stockUsedBy = useCallback(
    (drugId: string, exceptKey?: string) =>
      cart.filter((i) => i.drugId === drugId && cartKey(i.drugId, i.halfDose) !== exceptKey).reduce((s, i) => s + stockUnitsOf(i), 0),
    [cart],
  );

  /** `units` is in single units (halves when halfDose); pass the pack size to add a whole pack. */
  const addToCart = useCallback((drug: DrugResponse, units = 1, halfDose = false) => {
    if (!branchId) { toast.error("Select a branch first"); return; }
    if (halfDose && drug.halfDosePrice == null) { toast.error(`${drug.name} is not sold by the half dose`); return; }
    const stock = stockOf(drug);
    const key = cartKey(drug.id, halfDose);
    const inCartNow = cart.find((i) => cartKey(i.drugId, i.halfDose) === key)?.quantity ?? 0;
    if (stock.out) { toast.error(`${drug.name} is out of stock at this branch`); return; }
    const needed = stockUsedBy(drug.id, key) + stockUnitsOf({ quantity: inCartNow + units, halfDose });
    if (stock.known && needed > stock.quantity) {
      toast.warning(`Only ${stock.quantity} ${drug.unit}${stock.quantity === 1 ? "" : "s"} of ${drug.name} in stock`);
      return;
    }
    setCart((prev) => {
      const idx = prev.findIndex((i) => cartKey(i.drugId, i.halfDose) === key);
      if (idx >= 0) { const n = [...prev]; n[idx] = { ...n[idx], quantity: n[idx].quantity + units }; return n; }
      return [...prev, { drugId: drug.id, drugName: drug.name, unitPrice: halfDose ? (drug.halfDosePrice as number) : (drug.sellingPrice ?? 0), quantity: units, discountPct: 0, halfDose, isService: !!drug.isService, manualPrice: !!drug.isService && drug.priceMode === "Manual", info: packInfo(drug) }];
    });
  }, [branchId, cart, stockOf, stockUsedBy]);

  function updateQty(key: string, qty: number) {
    const line = cart.find((i) => cartKey(i.drugId, i.halfDose) === key);
    if (!line) return;
    if (qty <= 0) { setCart((p) => p.filter((i) => cartKey(i.drugId, i.halfDose) !== key)); return; }
    const row = stockByDrug.get(line.drugId);
    if (!line.isService && !stockLoading && branchId) {
      // The most this line can have is what is left after the drug's other line, counted in this line's doses.
      const room = Math.max(0, (row?.quantity ?? 0) - stockUsedBy(line.drugId, key));
      const max = Math.floor(line.halfDose ? room * 2 : room);
      if (qty > max) {
        toast.warning(`Only ${max} in stock`);
        qty = max;
        if (qty <= 0) { setCart((p) => p.filter((i) => cartKey(i.drugId, i.halfDose) !== key)); return; }
      }
    }
    setCart((p) => p.map((i) => cartKey(i.drugId, i.halfDose) === key ? { ...i, quantity: qty } : i));
  }
  function updateDiscountPct(key: string, pct: number) {
    setCart((p) => p.map((i) => cartKey(i.drugId, i.halfDose) === key ? { ...i, discountPct: Math.min(100, Math.max(0, pct)) } : i));
  }

  const completeSaleMutation = useMutation({
    mutationFn: (data: CreateSaleRequest) => salesApi.create(pharmacyId, data),
    onSuccess: (sale) => {
      toast.success(`Sale ${sale.receiptNumber} completed!`);
      if (sale.warnings?.includes("PAYMENT_REFERENCE_REUSED")) toast.warning("This payment reference was already used on another sale in the last 30 days.");
      qc.invalidateQueries({ queryKey: ["inventory", pharmacyId] });
      // Build drug name map from cart for receipt display
      const names: Record<string, string> = {};
      cart.forEach((i) => { names[i.drugId] = i.drugName; });
      setReceiptDrugNames(names);
      setReceiptSale(sale);
      setCart([]); setNotes(""); setAmountPaid(""); setPaymentReference("");
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

  const moveMutation = useMutation({
    mutationFn: () => salesApi.moveBusinessDay(pharmacyId, { saleIds: [...picked], targetDate: moveDate, reason: moveReason.trim() }),
    onSuccess: (r) => {
      toast.success(`${r.moved} sale${r.moved === 1 ? "" : "s"} moved to ${r.targetDate}${r.unchanged ? ` (${r.unchanged} already there)` : ""}`);
      setMoveOpen(false); setMoveReason(""); setPicked(new Set());
      qc.invalidateQueries({ queryKey: ["sales", pharmacyId] });
    },
    onError: (e) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Could not move the sales"),
  });
  const openMove = () => {
    // Suggest the day before the day the first chosen receipt is counted on: the usual "after midnight" fix.
    const first = histSales.find((sale) => picked.has(sale.id));
    const day = parseYmd(first?.businessDate ?? businessToday);
    setMoveDate(ymd(new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1)));
    setMoveOpen(true);
  };

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
    const unpriced = cart.find((i) => i.manualPrice && i.unitPrice <= 0);
    if (unpriced) { toast.error(`Type the price for ${unpriced.drugName}`); return; }
    const paid = parseFloat(amountPaid) || netTotal;
    if (paid < netTotal) { toast.error(`Amount paid (TZS ${fmt(paid)}) is less than total (TZS ${fmt(netTotal)})`); return; }
    completeSaleMutation.mutate({
      branchId,
      soldBy: user.id,
      receiptNumber: generateReceiptNumber(),
      paymentMethod,
      ...(paymentMethod === "MobileMoney" && paymentProvider ? { paymentProvider } : {}),
      ...((["MobileMoney", "Card", "Insurance"] as SalePaymentMethod[]).includes(paymentMethod) && paymentReference.trim()
        ? { paymentReference: paymentReference.trim().slice(0, 60) } : {}),
      amountPaid: paid,
      notes: notes.trim() || undefined,
      items: cart.map((i) => ({
        drugId: i.drugId,
        quantity: i.quantity,
        ...(i.halfDose ? { isHalfDose: true } : {}),
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
      <div className="flex items-center gap-1 mb-4 border-b border-border overflow-x-auto">
        {[
          { key: "pos" as const, label: "POS Terminal", icon: Monitor },
          { key: "today" as const, label: "Today's Sales", icon: CalendarDays },
          { key: "history" as const, label: "Sales History", icon: History },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {key === "pos" && cart.length > 0 && (
              <span className="ml-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">{cart.length}</span>
            )}
            {key === "today" && today && (
              <span className="text-xs text-muted-foreground ml-1">({today.totalElements})</span>
            )}
            {key === "history" && tab === "history" && histDays && (
              <span className="text-xs text-muted-foreground ml-1">({histDays.totals.salesCount})</span>
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
                <div data-guide="sales-branch" className="h-9 flex items-center gap-2 rounded-md border border-input bg-muted px-3 text-sm sm:w-52 flex-shrink-0">
                  <span className="text-muted-foreground text-xs">Branch:</span>
                  <span className="font-medium truncate">
                    {branches?.find((b) => b.id === branchId)?.name ?? "Your Branch"}
                  </span>
                </div>
              ) : (
                <select
                  data-guide="sales-branch"
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
                    const inCartLines = cart.filter((i) => i.drugId === drug.id);
                    const inCart = inCartLines.length ? { quantity: inCartLines.reduce((s, i) => s + i.quantity, 0) } : undefined;
                    const stock = stockOf(drug);
                    return (
                      <div
                        key={drug.id}
                        role="button"
                        tabIndex={stock.out ? -1 : 0}
                        aria-disabled={stock.out}
                        onClick={() => !stock.out && addToCart(drug)}
                        onKeyDown={(e) => { if (!stock.out && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); addToCart(drug); } }}
                        className={`group relative text-left rounded-xl border p-3 transition-all focus:outline-none ${
                          stock.out
                            ? "cursor-not-allowed border-border bg-card"
                            : "cursor-pointer hover:shadow-md hover:border-primary focus:ring-2 focus:ring-primary"
                        } ${hasPacks(packInfo(drug)) ? "pb-9" : ""} ${
                          inCart ? "border-primary bg-primary/5" : stock.out ? "" : "border-border bg-card hover:bg-accent/30"
                        }`}
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
                        {drug.isService && drug.priceMode === "Manual" ? (
                          <p className="text-sm font-bold text-primary">Price typed at sale</p>
                        ) : (
                          <p className="text-sm font-bold text-primary">TZS {fmt(drug.sellingPrice)}</p>
                        )}
                        {drug.isService
                          ? <span className="mt-1.5 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Service</span>
                          : <p className="text-[10px] text-muted-foreground">per {drug.unit}</p>}
                        {stock.known && (
                          <StockBadge
                            className="mt-1.5"
                            left={stock.quantity - stockUsedBy(drug.id)}
                            onShelf={stock.quantity}
                            reorderLevel={stock.reorderLevel}
                            unit={drug.unit}
                          />
                        )}
                        {drug.halfDosePrice != null && (
                          <button
                            type="button"
                            disabled={stock.out || (stock.known && stock.quantity < 0.5)}
                            onClick={(e) => { e.stopPropagation(); addToCart(drug, 1, true); }}
                            className="mt-1.5 w-full rounded-md border border-amber-500/60 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-amber-400"
                          >
                            + ½ dose · TZS {fmt(drug.halfDosePrice)}
                          </button>
                        )}
                        {hasPacks(packInfo(drug)) && (
                          <button
                            type="button"
                            disabled={stock.out || (stock.known && stock.quantity < drug.unitsPerPack)}
                            onClick={(e) => { e.stopPropagation(); addToCart(drug, drug.unitsPerPack); }}
                            className="mt-1.5 w-full rounded-md border border-primary/40 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                          >
                            + 1 {packLabel(packInfo(drug))} ({drug.unitsPerPack}) · TZS {fmt(drug.sellingPrice * drug.unitsPerPack)}
                          </button>
                        )}
                        {canSplitPack(packInfo(drug)) && (
                          <button
                            type="button"
                            disabled={stock.out || (stock.known && stock.quantity < drug.unitsPerPack / 2)}
                            onClick={(e) => { e.stopPropagation(); addToCart(drug, drug.unitsPerPack / 2); }}
                            className="mt-1 w-full rounded-md border border-primary/40 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                          >
                            + ½ {packLabel(packInfo(drug))} ({drug.unitsPerPack / 2}) · TZS {fmt(drug.sellingPrice * (drug.unitsPerPack / 2))}
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

            {(paymentMethod === "MobileMoney" || paymentMethod === "Card" || paymentMethod === "Insurance") && (
              <div className="space-y-1.5 flex-shrink-0">
                {paymentMethod === "MobileMoney" && (
                  <div className="flex flex-wrap gap-1">
                    {SALE_PAYMENT_PROVIDERS.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setPaymentProvider(paymentProvider === o.value ? "" : o.value)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                          paymentProvider === o.value ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent",
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
                <Input
                  placeholder="Payment reference (optional)"
                  maxLength={60}
                  className="h-8 text-xs"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
              </div>
            )}

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
                  const key = cartKey(item.drugId, item.halfDose);
                  return (
                    <div key={key} className="rounded-lg border border-border bg-card p-2.5 space-y-2">
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1">
                          <p className="text-xs font-semibold leading-tight">
                            {item.drugName}
                            {item.halfDose && <Badge variant="secondary" className="ml-1 align-middle text-[9px]">½ dose</Badge>}
                          </p>
                          {!item.halfDose && hasPacks(item.info) && (
                            <p className="text-[10px] text-muted-foreground">{formatQuantity(item.quantity, item.info)}</p>
                          )}
                          {item.isService && (
                            <span className="mt-1 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Service</span>
                          )}
                          {!item.isService && branchId && !stockLoading && (() => {
                            const row = stockByDrug.get(item.drugId);
                            const onShelf = Math.max(0, row?.quantity ?? 0);
                            return (
                              <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                                <StockBadge
                                  left={onShelf - stockUsedBy(item.drugId)}
                                  onShelf={onShelf}
                                  reorderLevel={row?.reorderLevel ?? 0}
                                  unit={item.info.unit}
                                />
                                <span>after this sale</span>
                              </div>
                            );
                          })()}
                        </div>
                        <button onClick={() => setCart((p) => p.filter((i) => cartKey(i.drugId, i.halfDose) !== key))} className="text-muted-foreground hover:text-destructive transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Qty stepper */}
                        <div className="flex items-center border border-input rounded-md overflow-hidden">
                          <button className="px-1.5 py-0.5 hover:bg-accent transition-colors" onClick={() => updateQty(key, item.quantity - 1)}>
                            <Minus className="h-3 w-3" />
                          </button>
                          <input
                            type="number" min={1}
                            className="w-10 text-center text-xs bg-transparent border-x border-input py-0.5 focus:outline-none"
                            value={item.quantity}
                            onChange={(e) => updateQty(key, Number(e.target.value))}
                          />
                          <button
                            className="px-1.5 py-0.5 hover:bg-accent transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={!item.isService && !stockLoading && !!branchId && stockUsedBy(item.drugId) + (item.halfDose ? 0.5 : 1) > Math.max(0, stockByDrug.get(item.drugId)?.quantity ?? 0)}
                            onClick={() => updateQty(key, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        {!item.halfDose && hasPacks(item.info) && (
                          <button
                            className="rounded-md border border-input px-1.5 py-0.5 text-[10px] hover:bg-accent transition-colors whitespace-nowrap"
                            onClick={() => updateQty(key, item.quantity + item.info.unitsPerPack)}
                          >
                            +{packLabel(item.info)}
                          </button>
                        )}
                        {!item.halfDose && canSplitPack(item.info) && (
                          <button
                            className="rounded-md border border-input px-1.5 py-0.5 text-[10px] hover:bg-accent transition-colors whitespace-nowrap"
                            onClick={() => updateQty(key, item.quantity + item.info.unitsPerPack / 2)}
                          >
                            +½ {packLabel(item.info)}
                          </button>
                        )}
                        {/* Discount */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">Disc%</span>
                          <input
                            type="number" min={0} max={100}
                            className="w-12 h-6 border border-input rounded text-xs text-center bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
                            value={item.discountPct}
                            onChange={(e) => updateDiscountPct(key, Number(e.target.value))}
                          />
                        </div>
                        <p className="text-xs font-bold text-primary ml-auto whitespace-nowrap">TZS {fmt(lineTotal)}</p>
                      </div>
                      {item.manualPrice && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">Price (TZS)</span>
                          <input
                            type="number" min={0}
                            className="w-24 h-6 border border-input rounded text-xs text-center bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
                            value={item.unitPrice || ""}
                            placeholder="Type price"
                            onChange={(e) => setCart((p) => p.map((i) => cartKey(i.drugId, i.halfDose) === key ? { ...i, unitPrice: Math.max(0, Number(e.target.value) || 0) } : i))}
                          />
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        {fmt(item.unitPrice)} × {item.quantity} {item.halfDose ? "½ dose" : item.info.unit}{item.discountPct > 0 ? ` − ${item.discountPct}% disc` : ""}
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
          TODAY'S SALES
      ════════════════════════════════════════════════════════════════════ */}
      {tab === "today" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Sales today</p>
              <p className="text-2xl font-bold tabular-nums">{todayCompleted.length}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total sold today</p>
              <p className="text-2xl font-bold tabular-nums">TZS {fmt(todayTotal)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Voided today</p>
              <p className="text-2xl font-bold tabular-nums">{todayVoided}</p>
            </CardContent></Card>
          </div>
          <p className="text-sm text-muted-foreground">
            {businessNow.toLocaleDateString("en-TZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {today && today.totalElements > today.content.length && ` · showing the latest ${today.content.length} of ${today.totalElements}; totals cover only these`}
          </p>
          <SalesTable
            sales={today?.content}
            loading={todayLoading}
            emptyText="No sales yet today"
            isSeller={isSeller}
            onView={viewDetail}
            onVoid={(sale) => { setVoidTarget(sale); setVoidReason(""); }}
          />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SALES HISTORY
      ════════════════════════════════════════════════════════════════════ */}
      {tab === "history" && (
        <div className="space-y-4">
          {/* Which days, which branch */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <PeriodPicker
              presets={HISTORY_PRESETS}
              preset={histPreset}
              onPresetChange={setHistPreset}
              custom={histCustom}
              onCustomChange={setHistCustom}
            />
            <div className="flex flex-wrap items-center gap-2">
              {!isSeller && (
                <select
                  aria-label="Branch"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={histBranchId}
                  onChange={(e) => setHistBranch(e.target.value)}
                >
                  <option value="">All branches</option>
                  {branches?.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              )}
              <div className="flex rounded-md border border-input p-0.5 text-sm">
                {[
                  { value: true, label: "By day" },
                  { value: false, label: "One list" },
                ].map((v) => (
                  <button
                    key={v.label}
                    type="button"
                    onClick={() => setHistByDay(v.value)}
                    className={cn(
                      "rounded px-3 py-1 font-medium transition-colors",
                      histByDay === v.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <form
            className="flex items-center gap-2"
            onSubmit={(e) => { e.preventDefault(); setRefQuery(refInput.trim()); }}
          >
            <Input
              placeholder="Find by payment reference"
              aria-label="Find by payment reference"
              className="h-9 max-w-xs"
              maxLength={60}
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
            />
            <Button type="submit" variant="outline" size="sm" className="h-9">Find</Button>
            {refQuery && (
              <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => { setRefInput(""); setRefQuery(""); }}>
                Clear
              </Button>
            )}
          </form>
          {refQuery && <p className="text-sm text-muted-foreground">Showing sales with payment reference “{refQuery}” (all dates).</p>}

          {histRangeValid && (
            <>
              {/* Summary for the whole period */}
              <p className="text-sm text-muted-foreground">
                {rangeLabel(histRange)} · {histBranchId ? (branches?.find((b) => b.id === histBranchId)?.name ?? "One branch") : "All branches"}
              </p>
              <div className={cn("grid grid-cols-2 gap-3", histShowProfit ? "lg:grid-cols-4" : "sm:grid-cols-3")}>
                <Card><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Sales</p>
                  <p className="text-2xl font-bold tabular-nums">{histDays ? histDays.totals.salesCount : "—"}</p>
                  <p className="text-[11px] text-muted-foreground">Receipts that were not voided</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Total sold</p>
                  <p className="text-2xl font-bold tabular-nums">{histDays ? money(histDays.totals.revenue) : "—"}</p>
                  <p className="text-[11px] text-muted-foreground">Money from those sales</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Voided</p>
                  <p className="text-2xl font-bold tabular-nums">{histDays ? histDays.totals.voidedCount : "—"}</p>
                  <p className="text-[11px] text-muted-foreground">Cancelled; not in the totals</p>
                </CardContent></Card>
                {histShowProfit && histDays && (
                  <Card><CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Profit</p>
                    <p className={cn("text-2xl font-bold tabular-nums", Number(histDays.totals.profit) < 0 ? "text-red-600" : "text-emerald-600")}>
                      {money(histDays.totals.profit)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Total sold − buying price of what was sold</p>
                  </CardContent></Card>
                )}
              </div>
              {histDaysError && (
                <p className="text-sm text-red-600">Could not load the totals for these days. Check your connection and try again.</p>
              )}
            </>
          )}

          {isSupport && picked.size > 0 && (
            <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 px-4 py-2 text-sm">
              <span><strong>{picked.size}</strong> receipt{picked.size === 1 ? "" : "s"} selected (support)</span>
              <span className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setPicked(new Set())}>Clear</Button>
                <Button size="sm" onClick={openMove}>Move to another day…</Button>
              </span>
            </div>
          )}

          {!histRangeValid ? null : historyQuery.isLoading || (histByDay && !refQuery && histDaysLoading) ? (
            <SalesTable sales={undefined} loading emptyText="" isSeller={isSeller} onView={viewDetail} onVoid={() => {}} />
          ) : (!histByDay || !!refQuery) ? (
            <SalesTable
              sales={histSales}
              loading={false}
              emptyText="No sales on these days"
              isSeller={isSeller}
              onView={viewDetail}
              onVoid={(sale) => { setVoidTarget(sale); setVoidReason(""); }}
              selected={isSupport ? picked : undefined}
              onSelect={isSupport ? pick : undefined}
            />
          ) : histDayRows.length === 0 ? (
            <Card><CardContent className="py-16 text-center text-muted-foreground">
              <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-25" />
              <p>No sales on these days</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-5">
              {histDayRows.map(([date, day]) => {
                const rows = histSalesByDay.get(date) ?? [];
                const completed = rows.filter((r) => r.status === "Completed");
                const count = day ? day.salesCount : completed.length;
                const total = day ? Number(day.revenue) : completed.reduce((sum, r) => sum + Number(r.netAmount), 0);
                return (
                  <section key={date} className="space-y-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-1">
                      <h3 className="font-semibold">{dayHeading(date, businessNow)}</h3>
                      <div className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                        <span>{count} sale{count === 1 ? "" : "s"}</span>
                        <span className="font-semibold text-foreground tabular-nums">{money(total)}</span>
                        {histShowProfit && day?.profit != null && (
                          <span className={cn("tabular-nums", Number(day.profit) < 0 ? "text-red-600" : "text-emerald-600")}>
                            Profit {money(day.profit)}
                          </span>
                        )}
                        {day && day.voidedCount > 0 && <span>{day.voidedCount} voided</span>}
                        {canAskHelp && (
                          <button
                            type="button"
                            className="text-xs underline underline-offset-2 hover:text-foreground"
                            onClick={() => setHelp({ kind: "MoveSales", businessDate: date, branchId: histBranchParam, saleIds: rows.map((r) => r.id).slice(0, 200), about: `Sales of ${dayHeading(date, businessNow)}` })}
                          >
                            Something wrong with this day?
                          </button>
                        )}
                      </div>
                    </div>
                    {rows.length > 0 ? (
                      <SalesTable
                        sales={rows}
                        loading={false}
                        emptyText=""
                        isSeller={isSeller}
                        onView={viewDetail}
                        onVoid={(sale) => { setVoidTarget(sale); setVoidReason(""); }}
                        selected={isSupport ? picked : undefined}
                        onSelect={isSupport ? pick : undefined}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">Press &quot;Load more&quot; below to see this day&apos;s receipts.</p>
                    )}
                  </section>
                );
              })}
            </div>
          )}

          {histRangeValid && historyQuery.hasNextPage && (
            <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <span>Showing {histSales.length} of {histTotalReceipts} receipts</span>
              <Button variant="outline" disabled={historyQuery.isFetchingNextPage} onClick={() => historyQuery.fetchNextPage()}>
                {historyQuery.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
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

      <RequestHelpDialog pharmacyId={pharmacyId} context={help} onClose={() => setHelp(null)} />

      {/* ── Move to another business day (Gene Pharmacy support only) ───── */}
      <Dialog open={moveOpen} onOpenChange={(o) => !o && setMoveOpen(false)}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Move {picked.size} receipt{picked.size === 1 ? "" : "s"} to another day</DialogTitle></DialogHeader>
          <div className="px-6 py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              Only the business day the sales are counted on changes. Sale time, money, stock and loyalty stay as they are.
              Each receipt is written to the pharmacy&apos;s audit log with your reason.
            </p>
            <div className="space-y-1">
              <Label>Count these sales on</Label>
              <Input type="date" value={moveDate} max={businessToday} onChange={(e) => setMoveDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Reason * (at least 10 characters)</Label>
              <Input placeholder="e.g. Shop open till 3am, forgot to open a shift" value={moveReason} maxLength={500} onChange={(e) => setMoveReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>Cancel</Button>
            <Button disabled={!moveDate || moveReason.trim().length < 10 || moveMutation.isPending} onClick={() => moveMutation.mutate()}>
              {moveMutation.isPending ? "Moving…" : "Move sales"}
            </Button>
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
