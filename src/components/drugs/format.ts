import type { DrugBulkResult, DrugIssue, DrugResponse } from "@/types";

/**
 * Stored names look like "Panadol (Paracetamol 500mg tablet, 10x10)". The part before " (" is shown bold
 * and the rest in grey. Names without brackets fall back to generic name and strength for the grey line.
 */
export function splitDrugName(drug: Pick<DrugResponse, "name" | "genericName" | "unitSize" | "unitsPerPack" | "packUnit" | "unit">) {
  const name = drug.name.trim();
  const open = name.indexOf(" (");
  if (open > 0 && name.endsWith(")")) {
    return { main: name.slice(0, open), detail: name.slice(open + 2, -1) };
  }
  const parts: string[] = [];
  if (drug.genericName && drug.genericName.trim().toLowerCase() !== name.toLowerCase()) parts.push(drug.genericName.trim());
  if (drug.unitSize && !name.toLowerCase().includes(drug.unitSize.toLowerCase())) parts.push(drug.unitSize);
  if (drug.unitsPerPack > 1) parts.push(`${drug.packUnit ?? "pack"} of ${drug.unitsPerPack} ${drug.unit}`);
  return { main: name, detail: parts.join(" · ") };
}

export const ISSUE_LABELS: Record<DrugIssue, string> = {
  noBuyingPrice: "No buying price, so profit can't be worked out",
  noSellingPrice: "No selling price (0), so it can't be sold",
  noCategory: "No category (or only \"Other Medicines\")",
  genericSameAsName: "Generic name is the same as the name, so add the real generic name",
};

const SKIP_REASONS: Record<string, string> = {
  NOT_FOUND: "not found",
  DUPLICATE_IN_REQUEST: "listed twice",
  NO_CHANGE: "nothing to change",
  NO_BUYING_PRICE: "no buying price to change",
  HALF_DOSE_PRICE_DOES_NOT_FIT: "half-dose price would not fit the new price",
  NO_SELLING_PRICE: "selling price is 0, so set a price first",
  ALREADY_ADDED: "you already have it",
  BARCODE_IN_USE: "barcode already used by another drug",
};

export const skipReasonLabel = (reason: string) => SKIP_REASONS[reason] ?? reason.toLowerCase().replace(/_/g, " ");

/** "Updated 12. Skipped 3: 2 nothing to change, 1 not found." */
export function bulkResultText(result: DrugBulkResult): string {
  const head = `Updated ${result.updated}.`;
  if (result.skipped.length === 0) return head;
  const counts = new Map<string, number>();
  for (const s of result.skipped) counts.set(s.reason, (counts.get(s.reason) ?? 0) + 1);
  const parts = [...counts.entries()].map(([reason, n]) => `${n} ${skipReasonLabel(reason)}`);
  return `${head} Skipped ${result.skipped.length}: ${parts.join(", ")}.`;
}

export function fmtUnits(n: number | string | undefined | null) {
  const v = Number(n ?? 0);
  return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1);
}

export const DUPLICATE_REASONS: Record<string, string> = {
  SAME_BARCODE: "Same barcode",
  SAME_BRAND_STRENGTH: "Same brand and strength",
  SAME_BRAND_NAME: "Same brand and name",
  SAME_NAME: "Same name",
  SAME_BRAND: "Same brand",
  SIMILAR_NAME: "Similar name",
};

export const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";
