import type { ShiftReport } from "@/types";

const PAYMENT_LABELS: Record<string, string> = {
  Cash: "Cash",
  MobileMoney: "Mobile money",
  Card: "Card",
  Insurance: "Insurance",
};

const tzs = (v: string | number | null | undefined) => `TZS ${Math.round(Number(v ?? 0)).toLocaleString("en-TZ")}`;

function day(ymd: string | null | undefined): string {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/** The end-of-day report as plain text, ready for WhatsApp (*bold* is WhatsApp's own markup). */
export function dayReportText(r: ShiftReport): string {
  const s = r.shift;
  const lines: string[] = [];
  lines.push(`*${r.pharmacyName ?? "Pharmacy"}${r.branchName ? ` – ${r.branchName}` : ""}*`);
  lines.push(`End of day: ${day(s.businessDate)}`);
  lines.push("");
  lines.push(`*Sales:* ${r.salesCount} · ${tzs(r.salesTotal)}`);
  for (const m of r.byPaymentMethod) lines.push(`  • ${PAYMENT_LABELS[m.method] ?? m.method}: ${tzs(m.amount)} (${m.count})`);
  if (r.voidedCount > 0) lines.push(`Voided: ${r.voidedCount} · ${tzs(r.voidedAmount)}`);
  if (r.expensesCount > 0) lines.push(`Expenses: ${r.expensesCount} · ${tzs(r.expensesTotal)}`);
  lines.push("");
  lines.push("*Cash*");
  lines.push(`  Opening: ${tzs(s.openingCash)}`);
  if (s.expectedCash != null) lines.push(`  Expected: ${tzs(s.expectedCash)}`);
  if (s.closingCash != null) {
    const diff = Number(s.cashDiscrepancy ?? 0);
    lines.push(`  Counted: ${tzs(s.closingCash)}`);
    lines.push(`  Difference: ${diff === 0 ? "none" : `${diff > 0 ? "+" : "−"}${tzs(Math.abs(diff))}`}`);
  } else if (s.status === "Closed") {
    lines.push("  Counted: not counted");
  } else {
    lines.push("  The day is still open.");
  }
  if (r.topItems.length > 0) {
    lines.push("");
    lines.push("*Best sellers*");
    r.topItems.forEach((t, i) => lines.push(`  ${i + 1}. ${t.name} ×${t.quantity} – ${tzs(t.amount)}`));
  }
  const by = [r.openedByName && `opened by ${r.openedByName}`, r.closedByName && `closed by ${r.closedByName}`].filter(Boolean).join(", ");
  if (by) {
    lines.push("");
    lines.push(by.charAt(0).toUpperCase() + by.slice(1));
  }
  return lines.join("\n");
}
