import type { DrugResponse, UpdateDrugRequest } from "@/types";

/**
 * The part of a drug that matters while stocking it: how it is counted, what it costs and sells for,
 * and whether it can be sold by the half dose. Fields are text so they can be emptied while typing.
 */
export interface DrugDetailsForm {
  unit: string;
  unitsPerPack: string;
  packUnit: string;
  sellingPrice: string;
  buyingPrice: string;
  allowsHalfDose: boolean;
  /** Empty means half of the selling price. */
  halfDosePrice: string;
}

export function detailsFromDrug(drug: DrugResponse): DrugDetailsForm {
  return {
    unit: drug.unit,
    unitsPerPack: String(drug.unitsPerPack ?? 1),
    packUnit: drug.packUnit ?? "",
    sellingPrice: String(drug.sellingPrice),
    buyingPrice: drug.buyingPrice == null ? "" : String(drug.buyingPrice),
    allowsHalfDose: drug.allowsHalfDose ?? false,
    halfDosePrice: drug.halfDosePrice == null ? "" : String(drug.halfDosePrice),
  };
}

/** Numbers the form currently holds; NaN where a field is empty or not a number. */
export function detailsNumbers(form: DrugDetailsForm) {
  const selling = form.sellingPrice.trim() === "" ? NaN : Number(form.sellingPrice);
  const buying = form.buyingPrice.trim() === "" ? null : Number(form.buyingPrice);
  const unitsPerPack = form.unitsPerPack.trim() === "" ? NaN : Number(form.unitsPerPack);
  const sellsInPacks = Number.isInteger(unitsPerPack) && unitsPerPack > 1;
  const halfDosePrice = form.halfDosePrice.trim() === "" ? selling / 2 : Number(form.halfDosePrice);
  return { selling, buying, unitsPerPack, sellsInPacks, halfDosePrice };
}

/** A comparable snapshot, so "typed the same number another way" does not count as a change. */
function snapshot(form: DrugDetailsForm): string {
  const n = detailsNumbers(form);
  return JSON.stringify([
    form.unit,
    n.unitsPerPack,
    n.sellsInPacks ? form.packUnit.trim() : "",
    n.selling,
    n.buying,
    form.allowsHalfDose,
    form.allowsHalfDose ? n.halfDosePrice : null,
  ]);
}

export function detailsChanged(form: DrugDetailsForm, drug: DrugResponse): boolean {
  return snapshot(form) !== snapshot(detailsFromDrug(drug));
}

/** The update to send, or the message to show when something is not valid. */
export function detailsToUpdate(form: DrugDetailsForm): { update: UpdateDrugRequest } | { error: string } {
  const { selling, buying, unitsPerPack, sellsInPacks, halfDosePrice } = detailsNumbers(form);

  if (!form.unit.trim()) return { error: "Choose how this drug is counted (tablet, blister, …)" };
  if (!Number.isFinite(selling) || selling < 0) return { error: "Enter a selling price of 0 or more" };
  if (buying !== null && (!Number.isFinite(buying) || buying < 0)) {
    return { error: "The buying price must be 0 or more (or left empty)" };
  }
  if (!Number.isInteger(unitsPerPack) || unitsPerPack < 1) return { error: "Units per pack must be a whole number, 1 or more" };
  if (form.allowsHalfDose && (!Number.isFinite(halfDosePrice) || halfDosePrice <= 0)) {
    return { error: "Enter a half-dose price above 0, or leave it empty for half of the selling price" };
  }

  return {
    update: {
      unit: form.unit,
      unitsPerPack,
      packUnit: sellsInPacks ? form.packUnit.trim() || null : null,
      sellingPrice: selling,
      buyingPrice: buying,
      allowsHalfDose: form.allowsHalfDose,
      halfDosePrice: form.allowsHalfDose ? halfDosePrice : null,
    },
  };
}
