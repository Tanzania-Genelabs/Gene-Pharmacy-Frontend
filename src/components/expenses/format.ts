import type { ExpensePaymentMethod } from "@/types";

export const money = (value: string | number | null | undefined) =>
  value === null || value === undefined ? "—" : `TZS ${Number(value).toLocaleString()}`;

export const PAYMENT_METHODS: { value: ExpensePaymentMethod; label: string }[] = [
  { value: "Cash", label: "Cash" },
  { value: "MobileMoney", label: "Mobile money" },
  { value: "Bank", label: "Bank" },
  { value: "Other", label: "Other" },
];

export const methodLabel = (m: string) => PAYMENT_METHODS.find((p) => p.value === m)?.label ?? m;

export const isoToday = () => new Date().toISOString().split("T")[0];

export const firstOfMonth = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1)).toISOString().split("T")[0];
};

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
