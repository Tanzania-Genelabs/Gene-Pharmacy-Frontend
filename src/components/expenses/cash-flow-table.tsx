"use client";

import { useQuery } from "@tanstack/react-query";
import { reportApi } from "@/api/report.api";
import { apiErrorMessage } from "@/lib/errors";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CashFlowDay } from "@/types";
import { money } from "./format";

const tone = (value: string | null) => (value !== null && Number(value) < 0 ? "text-destructive" : "");
const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-TZ", { weekday: "short", day: "2-digit", month: "short" });

function Cells({ row }: { row: Omit<CashFlowDay, "date"> }) {
  return (
    <>
      <TableCell className="text-right tabular-nums">{money(row.moneyIn.cash)}</TableCell>
      <TableCell className="text-right tabular-nums">{money(row.moneyIn.mobileMoney)}</TableCell>
      <TableCell className="text-right tabular-nums">{money(Number(row.moneyIn.card) + Number(row.moneyIn.other))}</TableCell>
      <TableCell className="text-right tabular-nums font-medium">{money(row.moneyIn.total)}</TableCell>
      <TableCell className="text-right tabular-nums">{row.moneyOut ? money(row.moneyOut.total) : "—"}</TableCell>
      <TableCell className={`text-right tabular-nums font-semibold ${tone(row.net)}`}>{money(row.net)}</TableCell>
      <TableCell className={`text-right tabular-nums ${tone(row.netCash)}`}>{money(row.netCash)}</TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">{Number(row.onAccount) > 0 ? money(row.onAccount) : "—"}</TableCell>
    </>
  );
}

/** Every day in the range: what came in by how it was paid, what went out, and what was left. */
export function CashFlowTable({ pharmacyId, from, to }: { pharmacyId: string; from: string; to: string }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["reports", "cash-flow", pharmacyId, from, to],
    queryFn: () => reportApi.cashFlow(pharmacyId, { from, to }),
    enabled: !!from && !!to,
    retry: false,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (isError || !data) return <p className="text-sm text-destructive">{apiErrorMessage(error, "Could not load the cash flow")}</p>;

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Day</TableHead>
              <TableHead className="text-right">Cash in</TableHead>
              <TableHead className="text-right">Mobile money in</TableHead>
              <TableHead className="text-right">Card &amp; other in</TableHead>
              <TableHead className="text-right">Total in</TableHead>
              <TableHead className="text-right">Expenses out</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead className="text-right">Net cash</TableHead>
              <TableHead className="text-right">On account</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.days.map((d) => (
              <TableRow key={d.date}>
                <TableCell className="whitespace-nowrap">{day(d.date)}</TableCell>
                <Cells row={d} />
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="font-semibold">
              <TableCell>Total</TableCell>
              <Cells row={data.totals} />
            </TableRow>
          </TableFooter>
        </Table>
        <p className="border-t p-3 text-xs text-muted-foreground">
          Money in is what customers paid at the till (cash, mobile money, card). <strong>Net</strong> is money in less expenses.{" "}
          <strong>Net cash</strong> is cash sales less expenses paid in cash, which is what the drawer gained or lost. <strong>On account</strong> is
          credit and insurance sales: income, but the money has not arrived yet. Voided sales and voided expenses are not counted.
          {!data.expensesIncluded && " Expenses are not tracked on your plan, so only money in is shown."}
        </p>
      </CardContent>
    </Card>
  );
}
