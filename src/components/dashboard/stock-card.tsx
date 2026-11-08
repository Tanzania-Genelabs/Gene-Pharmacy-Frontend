import Link from "next/link";
import { Boxes } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/components/expenses/format";
import type { OwnerDashboardResponse } from "@/types";

/** What the stock on the shelves is worth, at cost and at selling price. */
export function StockCard({ stock, pharmacyId }: { stock: OwnerDashboardResponse["stock"]; pharmacyId: string }) {
  const gain = Number(stock.retailValue) - Number(stock.costValue);
  return (
    <Card className="gap-3">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Boxes className="h-4 w-4 text-muted-foreground" /> Stock on the shelves
        </CardTitle>
        <Link href={`/${pharmacyId}/inventory`} className="text-sm text-primary hover:underline">Inventory</Link>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-muted-foreground">Worth at cost</span>
          <span className="font-semibold tabular-nums">{money(stock.costValue)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-muted-foreground">Worth if all sold</span>
          <span className="font-semibold tabular-nums">{money(stock.retailValue)}</span>
        </div>
        {gain > 0 && (
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground">Profit waiting on the shelves</span>
            <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{money(gain)}</span>
          </div>
        )}
        <p className="border-t pt-2 text-xs text-muted-foreground">
          {stock.inStock.toLocaleString()} of {stock.products.toLocaleString()} products in stock
        </p>
      </CardContent>
    </Card>
  );
}
